"""
01_trees.py — BBMP Tree Census → 250m H3 hexbin GeoJSON

Downloads the BBMP Tree Census KMZ from OpenCity and aggregates
the ~680k individual tree points into 250m H3 hexagons, each
carrying a tree count and the dominant species name.

Output: ../public/data/tree-density.geojson

Usage:
    pip install geopandas h3 shapely requests
    python 01_trees.py --kmz path/to/bbmp_trees.kmz
    # Or let the script download it:
    python 01_trees.py
"""

import argparse
import json
import os
import zipfile
from collections import Counter
from pathlib import Path

import geopandas as gpd
import h3
import requests
from shapely.geometry import Polygon, mapping

# ── Config ──────────────────────────────────────────────────────────────────
# OpenCity / CKAN direct download URL for the BBMP Tree Census KMZ.
# Replace with the latest snapshot URL if this changes.
TREE_KMZ_URL = (
    "https://opencity.in/dataset/bbmp-tree-census/resource/"
    "bbmp-tree-census-jul-2025.kmz"  # update as needed
)

OUTPUT_DIR = Path(__file__).parent.parent / "public" / "data"
OUTPUT_FILE = OUTPUT_DIR / "tree-density.geojson"

# H3 resolution 9 ≈ 174m edge length ≈ ~250m diameter hexagon
H3_RESOLUTION = 9

SPECIES_COL_CANDIDATES = ["species", "Species", "SPECIES", "common_name", "tree_type"]
# ────────────────────────────────────────────────────────────────────────────


def download_kmz(url: str, dest: Path) -> Path:
    """Download KMZ file with progress indication."""
    print(f"Downloading tree census KMZ from:\n  {url}")
    resp = requests.get(url, stream=True, timeout=120)
    resp.raise_for_status()
    with open(dest, "wb") as f:
        for chunk in resp.iter_content(chunk_size=1024 * 64):
            f.write(chunk)
    print(f"Saved to {dest} ({dest.stat().st_size / 1e6:.1f} MB)")
    return dest


def extract_kml(kmz_path: Path) -> Path:
    """Extract the first .kml file from a KMZ archive."""
    kml_dir = kmz_path.parent / "kml_extracted"
    kml_dir.mkdir(exist_ok=True)
    with zipfile.ZipFile(kmz_path, "r") as zf:
        kml_names = [n for n in zf.namelist() if n.lower().endswith(".kml")]
        if not kml_names:
            raise ValueError("No .kml file found inside the KMZ archive.")
        kml_path = kml_dir / Path(kml_names[0]).name
        zf.extract(kml_names[0], kml_dir)
    print(f"Extracted KML: {kml_path}")
    return kml_path


def load_trees(kml_path: Path) -> gpd.GeoDataFrame:
    """Load tree points from KML into a GeoDataFrame."""
    import fiona
    # KML may have multiple layers; iterate to find points
    layers = fiona.listlayers(str(kml_path))
    gdfs = []
    for layer in layers:
        gdf = gpd.read_file(str(kml_path), driver="KML", layer=layer)
        pts = gdf[gdf.geometry.geom_type == "Point"]
        if len(pts):
            gdfs.append(pts)
    if not gdfs:
        raise ValueError("No point geometries found in the KML file.")
    trees = gpd.pd.concat(gdfs, ignore_index=True)
    trees = trees.to_crs(epsg=4326)
    print(f"Loaded {len(trees):,} tree points.")
    return trees


def detect_species_col(gdf: gpd.GeoDataFrame) -> str | None:
    for col in SPECIES_COL_CANDIDATES:
        if col in gdf.columns:
            return col
    return None


def aggregate_to_hexbins(trees: gpd.GeoDataFrame) -> list[dict]:
    """
    Map each tree to an H3 cell, count trees, find dominant species.
    Returns a list of GeoJSON Feature dicts.
    """
    species_col = detect_species_col(trees)

    hex_counts: dict[str, int] = Counter()
    hex_species: dict[str, list[str]] = {}

    for _, row in trees.iterrows():
        lng, lat = row.geometry.x, row.geometry.y
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            continue
        h = h3.latlng_to_cell(lat, lng, H3_RESOLUTION)
        hex_counts[h] += 1
        if species_col and row.get(species_col):
            hex_species.setdefault(h, []).append(str(row[species_col]))

    features = []
    for h, count in hex_counts.items():
        boundary = h3.cell_to_boundary(h)
        # h3 returns (lat, lng) pairs; GeoJSON needs (lng, lat)
        coords = [(lng, lat) for lat, lng in boundary]
        coords.append(coords[0])  # close the ring

        dominant = None
        if h in hex_species:
            dominant = Counter(hex_species[h]).most_common(1)[0][0]

        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": [coords]},
                "properties": {
                    "h3_index": h,
                    "tree_count": count,
                    "dominant_species": dominant,
                },
            }
        )

    print(f"Aggregated into {len(features):,} hexbins (H3 res {H3_RESOLUTION}).")
    return features


def main():
    parser = argparse.ArgumentParser(description="Build tree-density.geojson")
    parser.add_argument(
        "--kmz",
        help="Local path to BBMP tree census KMZ (skips download if provided)",
    )
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    tmp_dir = Path(__file__).parent / "_tmp"
    tmp_dir.mkdir(exist_ok=True)

    # 1. Acquire KMZ
    if args.kmz:
        kmz_path = Path(args.kmz)
    else:
        kmz_path = tmp_dir / "bbmp_trees.kmz"
        if not kmz_path.exists():
            download_kmz(TREE_KMZ_URL, kmz_path)
        else:
            print(f"Using cached KMZ: {kmz_path}")

    # 2. Extract KML
    kml_path = extract_kml(kmz_path)

    # 3. Load tree points
    trees = load_trees(kml_path)

    # 4. Aggregate to hexbins
    features = aggregate_to_hexbins(trees)

    # 5. Write GeoJSON
    geojson = {"type": "FeatureCollection", "features": features}
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(geojson, f, separators=(",", ":"))  # compact output

    size_kb = OUTPUT_FILE.stat().st_size / 1024
    print(f"\nWrote {OUTPUT_FILE}  ({size_kb:.0f} KB)")
    print("Done. ✓")


if __name__ == "__main__":
    main()
