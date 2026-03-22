"""
06_sentinel_heat.py — Sentinel-2 → LST proxy raster tiles

Downloads a Sentinel-2 L2A scene for Bengaluru from the Copernicus
Data Space Ecosystem (CDSE), computes a Land Surface Temperature (LST)
proxy using NDVI and Band 11 (SWIR), then tiles the result as PNG
raster tiles for use as a MapLibre raster layer.

LST proxy formula (simplified, no atmospheric correction):
    NDVI = (B08 - B04) / (B08 + B04)
    FVC  = ((NDVI - NDVI_min) / (NDVI_max - NDVI_min)) ^ 2
    LST_proxy = B11 * (1 - 0.6 * FVC)   [relative, not absolute Kelvin]

Output: ../public/tiles/heat/{z}/{x}/{y}.png  (zoom 8–14)

Prerequisites:
    pip install rasterio rio-cogeo requests numpy gdal
    # gdal2tiles is part of GDAL — install via conda or OSGeo4W

    # CDSE account (free): https://dataspace.copernicus.eu/
    export CDSE_USER=your@email.com
    export CDSE_PASSWORD=yourpassword

Usage:
    python 06_sentinel_heat.py
    # Or provide a pre-downloaded B04/B08/B11 GeoTIFF:
    python 06_sentinel_heat.py --b04 B04.tif --b08 B08.tif --b11 B11.tif
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import requests

try:
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.merge import merge
    from rasterio.transform import from_bounds
    from rasterio.warp import calculate_default_transform, reproject
    from rasterio import MemoryFile
except ImportError:
    sys.exit("Install rasterio: pip install rasterio")

# ── Config ──────────────────────────────────────────────────────────────────
OUTPUT_DIR = Path(__file__).parent.parent / "public" / "tiles" / "heat"
TMP_DIR = Path(__file__).parent / "_tmp" / "sentinel"

# Bengaluru bounding box (WGS84)
BBOX = (77.461, 12.834, 77.784, 13.143)  # W, S, E, N
MIN_ZOOM = 8
MAX_ZOOM = 14

# CDSE credentials (set as env vars or fill here)
CDSE_USER = os.getenv("CDSE_USER", "")
CDSE_PASSWORD = os.getenv("CDSE_PASSWORD", "")

# Copernicus Data Space token endpoint
CDSE_TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
CDSE_SEARCH_URL = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products"
# ────────────────────────────────────────────────────────────────────────────


def get_cdse_token(user: str, password: str) -> str:
    resp = requests.post(CDSE_TOKEN_URL, data={
        "grant_type": "password",
        "client_id": "cdse-public",
        "username": user,
        "password": password,
    }, timeout=30)
    resp.raise_for_status()
    return resp.json()["access_token"]


def find_scene(token: str) -> dict:
    """Find a recent low-cloud Sentinel-2 L2A scene over Bengaluru."""
    w, s, e, n = BBOX
    footprint = f"POLYGON(({w} {s},{e} {s},{e} {n},{w} {n},{w} {s}))"
    params = {
        "$filter": (
            f"Collection/Name eq 'SENTINEL-2' "
            f"and Attributes/OData.CSC.StringAttribute/any(att:att/Name eq 'productType' "
            f"and att/OData.CSC.StringAttribute/Value eq 'S2MSI2A') "
            f"and OData.CSC.Intersects(area=geography'SRID=4326;{footprint}') "
            f"and Attributes/OData.CSC.DoubleAttribute/any(att:att/Name eq 'cloudCover' "
            f"and att/OData.CSC.DoubleAttribute/Value le 10)"
        ),
        "$orderby": "ContentDate/Start desc",
        "$top": 1,
        "$expand": "Assets",
    }
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(CDSE_SEARCH_URL, params=params, headers=headers, timeout=30)
    resp.raise_for_status()
    results = resp.json().get("value", [])
    if not results:
        raise RuntimeError("No suitable Sentinel-2 scene found. Try relaxing cloud cover filter.")
    scene = results[0]
    print(f"Found scene: {scene['Name']}  (cloud cover: {scene.get('Attributes', '')})")
    return scene


def download_band(scene: dict, band: str, token: str, dest: Path) -> Path:
    """Download a specific band GeoTIFF from the CDSE scene."""
    # In practice, Sentinel-2 bands are inside a SAFE archive.
    # This is a simplified placeholder — real implementation uses
    # the CDSE S3 or download API to fetch individual band files.
    # For a working alternative, use Google Earth Engine:
    #   ee.Image('COPERNICUS/S2_SR_HARMONIZED').filterBounds(bengaluru).first()
    raise NotImplementedError(
        "Auto-download of individual Sentinel-2 bands requires the CDSE S3 API or GEE. "
        "Please download B04.tif, B08.tif, and B11.tif manually from:\n"
        "  https://dataspace.copernicus.eu/\n"
        "Then run: python 06_sentinel_heat.py --b04 B04.tif --b08 B08.tif --b11 B11.tif"
    )


def compute_lst_proxy(b04_path: Path, b08_path: Path, b11_path: Path) -> Path:
    """
    Compute a relative LST proxy and save as a single-band GeoTIFF (float32).
    Values are normalised to [0, 1] where 1 = hottest.
    """
    print("Computing LST proxy...")
    with rasterio.open(b04_path) as src04, \
         rasterio.open(b08_path) as src08, \
         rasterio.open(b11_path) as src11:

        b04 = src04.read(1).astype(np.float32)
        b08 = src08.read(1).astype(np.float32)
        b11 = src11.read(1).astype(np.float32)
        profile = src11.profile.copy()

    # NDVI
    ndvi_denom = b08 + b04
    ndvi = np.where(ndvi_denom != 0, (b08 - b04) / ndvi_denom, 0).astype(np.float32)

    # Fractional vegetation cover
    ndvi_min, ndvi_max = np.percentile(ndvi, 5), np.percentile(ndvi, 95)
    fvc = np.clip((ndvi - ndvi_min) / max(ndvi_max - ndvi_min, 1e-6), 0, 1) ** 2

    # LST proxy: cooler where vegetation is dense
    lst = b11 * (1 - 0.6 * fvc)

    # Normalise to [0, 1]
    lst_min, lst_max = np.percentile(lst[lst > 0], 2), np.percentile(lst[lst > 0], 98)
    lst_norm = np.clip((lst - lst_min) / max(lst_max - lst_min, 1e-6), 0, 1).astype(np.float32)

    out_path = TMP_DIR / "lst_proxy.tif"
    profile.update(dtype=rasterio.float32, count=1, nodata=None)
    with rasterio.open(out_path, "w", **profile) as dst:
        dst.write(lst_norm, 1)

    print(f"Saved LST proxy: {out_path}")
    return out_path


def lst_to_rgba(lst_path: Path) -> Path:
    """
    Map normalised LST [0,1] to RGBA using a yellow → amber → red-orange palette.
    This is the colour layer that renders in the browser.
    """
    print("Converting LST to RGBA...")
    # Colour stops: [value, R, G, B]
    stops = [
        (0.0,  255, 253, 231),   # very cool: warm white-yellow
        (0.3,  255, 235, 59),    # mild:      yellow
        (0.6,  255, 152, 0),     # warm:      orange
        (0.85, 244, 81, 30),     # hot:       deep orange
        (1.0,  183, 28, 28),     # very hot:  dark red
    ]

    with rasterio.open(lst_path) as src:
        data = src.read(1)
        profile = src.profile.copy()
        crs = src.crs
        transform_ = src.transform

    h, w = data.shape
    rgba = np.zeros((4, h, w), dtype=np.uint8)

    for i in range(len(stops) - 1):
        v0, r0, g0, b0 = stops[i]
        v1, r1, g1, b1 = stops[i + 1]
        mask = (data >= v0) & (data < v1)
        t = np.where(mask, (data - v0) / (v1 - v0), 0)
        rgba[0] = np.where(mask, r0 + t * (r1 - r0), rgba[0]).astype(np.uint8)
        rgba[1] = np.where(mask, g0 + t * (g1 - g0), rgba[1]).astype(np.uint8)
        rgba[2] = np.where(mask, b0 + t * (b1 - b0), rgba[2]).astype(np.uint8)

    # Alpha: transparent where very cool (no heat to show)
    rgba[3] = np.clip(data * 220, 30, 200).astype(np.uint8)

    out_path = TMP_DIR / "lst_rgba.tif"
    profile.update(dtype=rasterio.uint8, count=4, compress="deflate")
    with rasterio.open(out_path, "w", **profile) as dst:
        dst.write(rgba)

    print(f"Saved RGBA raster: {out_path}")
    return out_path


def tile_raster(rgba_path: Path, output_dir: Path):
    """Generate XYZ PNG tiles using gdal2tiles."""
    output_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        "gdal2tiles.py",
        "--zoom", f"{MIN_ZOOM}-{MAX_ZOOM}",
        "--webviewer", "none",
        "--resampling", "average",
        str(rgba_path),
        str(output_dir),
    ]
    print(f"Running gdal2tiles (zoom {MIN_ZOOM}–{MAX_ZOOM})…")
    print(f"  Output: {output_dir}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print("gdal2tiles stderr:", result.stderr)
        raise RuntimeError("gdal2tiles failed. Make sure GDAL is installed.")
    print("Tiling complete.")


def main():
    parser = argparse.ArgumentParser(description="Build Sentinel heat tiles")
    parser.add_argument("--b04", help="Path to Band 4 (Red) GeoTIFF")
    parser.add_argument("--b08", help="Path to Band 8 (NIR) GeoTIFF")
    parser.add_argument("--b11", help="Path to Band 11 (SWIR) GeoTIFF")
    args = parser.parse_args()

    TMP_DIR.mkdir(parents=True, exist_ok=True)

    if args.b04 and args.b08 and args.b11:
        b04_path = Path(args.b04)
        b08_path = Path(args.b08)
        b11_path = Path(args.b11)
    else:
        if not CDSE_USER or not CDSE_PASSWORD:
            print(
                "ERROR: Set CDSE_USER and CDSE_PASSWORD environment variables,\n"
                "or provide --b04 --b08 --b11 paths to pre-downloaded band GeoTIFFs.\n\n"
                "To download manually:\n"
                "  1. Go to https://dataspace.copernicus.eu/\n"
                "  2. Search: Sentinel-2, Bengaluru, cloud cover < 10%, L2A product\n"
                "  3. Download the SAFE archive\n"
                "  4. Extract: GRANULE/*/IMG_DATA/R10m/T43PKR_*_B04_10m.jp2 → B04.tif\n"
                "              GRANULE/*/IMG_DATA/R10m/T43PKR_*_B08_10m.jp2 → B08.tif\n"
                "              GRANULE/*/IMG_DATA/R20m/T43PKR_*_B11_20m.jp2 → B11.tif\n"
                "  5. Re-run: python 06_sentinel_heat.py --b04 B04.tif --b08 B08.tif --b11 B11.tif"
            )
            sys.exit(1)
        print("Authenticating with Copernicus Data Space...")
        token = get_cdse_token(CDSE_USER, CDSE_PASSWORD)
        scene = find_scene(token)
        # Auto-download not yet implemented (see function docstring)
        download_band(scene, "B04", token, TMP_DIR / "B04.tif")

    lst_path = compute_lst_proxy(b04_path, b08_path, b11_path)
    rgba_path = lst_to_rgba(lst_path)
    tile_raster(rgba_path, OUTPUT_DIR)

    print(f"\nHeat tiles ready at: {OUTPUT_DIR}")
    print(f"MapLibre tile URL: /tiles/heat/{{z}}/{{x}}/{{y}}.png")
    print("Done. ✓")


if __name__ == "__main__":
    main()
