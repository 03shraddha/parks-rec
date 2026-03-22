"""
03_lakes.py — KSRSAC Lakes KML → lakes.geojson

Downloads the Bengaluru Urban Lakes KML from the OpenCity portal
(KSRSAC data, ~840 lakes) and converts to a clean GeoJSON.

Output: ../public/data/lakes.geojson

Usage:
    pip install geopandas fiona requests
    python 03_lakes.py --kml path/to/lakes.kml
    # Or let the script download it:
    python 03_lakes.py
"""

import argparse
import json
import zipfile
from pathlib import Path

import geopandas as gpd
import requests

# ── Config ──────────────────────────────────────────────────────────────────
LAKES_KML_URL = (
    "https://opencity.in/dataset/bengaluru-urban-lakes-2023/resource/"
    "bengaluru-urban-lakes.kml"  # update if URL changes
)

OUTPUT_DIR = Path(__file__).parent.parent / "public" / "data"
OUTPUT_FILE = OUTPUT_DIR / "lakes.geojson"
TMP_DIR = Path(__file__).parent / "_tmp"
# ────────────────────────────────────────────────────────────────────────────


def download_file(url: str, dest: Path) -> Path:
    print(f"Downloading: {url}")
    resp = requests.get(url, stream=True, timeout=60)
    resp.raise_for_status()
    with open(dest, "wb") as f:
        for chunk in resp.iter_content(chunk_size=1024 * 32):
            f.write(chunk)
    print(f"Saved {dest.stat().st_size / 1024:.0f} KB → {dest}")
    return dest


def load_kml(kml_path: Path) -> gpd.GeoDataFrame:
    """Load all layers from a KML file, keep only polygon/multipolygon geometries."""
    import fiona
    layers = fiona.listlayers(str(kml_path))
    gdfs = []
    for layer in layers:
        gdf = gpd.read_file(str(kml_path), driver="KML", layer=layer)
        polys = gdf[gdf.geometry.geom_type.isin(["Polygon", "MultiPolygon"])]
        if len(polys):
            gdfs.append(polys)
        # Also accept points (lake centroids) as fallback
        pts = gdf[gdf.geometry.geom_type == "Point"]
        if len(pts) and not polys.empty:
            pass  # prefer polygons
        elif len(pts):
            gdfs.append(pts)

    if not gdfs:
        raise ValueError("No polygon or point geometries found in KML.")

    result = gpd.pd.concat(gdfs, ignore_index=True).to_crs(epsg=4326)
    print(f"Loaded {len(result):,} lake features.")
    return result


def clean_columns(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Normalise column names and keep only useful attributes."""
    rename = {}
    for col in gdf.columns:
        lower = col.lower()
        if "name" in lower:
            rename[col] = "name"
        elif "area" in lower:
            rename[col] = "area_ha"
        elif "ward" in lower:
            rename[col] = "ward"
        elif "authority" in lower or "agency" in lower:
            rename[col] = "managing_agency"
        elif "status" in lower:
            rename[col] = "status"
    gdf = gdf.rename(columns=rename)

    keep = [c for c in ["name", "area_ha", "ward", "managing_agency", "status", "geometry"]
            if c in gdf.columns]
    return gdf[keep]


def main():
    parser = argparse.ArgumentParser(description="Build lakes.geojson")
    parser.add_argument("--kml", help="Local path to lakes KML (skips download)")
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(exist_ok=True)

    if args.kml:
        kml_path = Path(args.kml)
    else:
        kml_path = TMP_DIR / "bengaluru_lakes.kml"
        if not kml_path.exists():
            download_file(LAKES_KML_URL, kml_path)

    gdf = load_kml(kml_path)
    gdf = clean_columns(gdf)

    # Add centroid coordinates for popup label positioning
    centroids = gdf.geometry.centroid
    gdf["centroid_lng"] = centroids.x
    gdf["centroid_lat"] = centroids.y

    geojson = json.loads(gdf.to_json())
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(geojson, f, separators=(",", ":"))

    size_kb = OUTPUT_FILE.stat().st_size / 1024
    print(f"\nWrote {OUTPUT_FILE}  ({size_kb:.0f} KB)")
    print("Done. ✓")


if __name__ == "__main__":
    main()
