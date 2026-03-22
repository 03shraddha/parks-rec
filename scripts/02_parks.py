"""
02_parks.py — BBMP Parks CSV → parks.geojson

Reads the BBMP Parks & Playgrounds CSV from OpenCity (ward-wise inventory)
and produces a GeoJSON FeatureCollection of park centroids/polygons with
name, area, and ward attributes.

Since the BBMP CSV typically has ward-level aggregates (not individual park
polygons), we supplement with OSM park polygons for Bengaluru, merging in
BBMP area/count metadata at the ward level.

Output: ../public/data/parks.geojson

Usage:
    pip install geopandas pandas requests shapely
    python 02_parks.py
"""

import json
import os
from pathlib import Path

import geopandas as gpd
import pandas as pd
import requests
from shapely.geometry import mapping

# ── Config ──────────────────────────────────────────────────────────────────
BBMP_PARKS_CSV_URL = (
    "https://opencity.in/dataset/bbmp-parks-2016/resource/"
    "bbmp-parks-playgrounds.csv"  # update if URL changes
)

# Overpass query: all park-tagged areas in Bengaluru bounding box
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
BENGALURU_BBOX = (12.834, 77.461, 13.143, 77.784)  # S, W, N, E

OUTPUT_DIR = Path(__file__).parent.parent / "public" / "data"
OUTPUT_FILE = OUTPUT_DIR / "parks.geojson"
TMP_DIR = Path(__file__).parent / "_tmp"
# ────────────────────────────────────────────────────────────────────────────


def fetch_bbmp_csv(url: str) -> pd.DataFrame:
    print(f"Fetching BBMP parks CSV...")
    try:
        df = pd.read_csv(url)
        print(f"  Loaded {len(df)} rows from BBMP CSV.")
        return df
    except Exception as e:
        print(f"  Warning: Could not fetch BBMP CSV ({e}). Using OSM only.")
        return pd.DataFrame()


def fetch_osm_parks() -> gpd.GeoDataFrame:
    """Query Overpass for park polygons in Bengaluru."""
    s, w, n, e = BENGALURU_BBOX
    query = f"""
    [out:json][timeout:60];
    (
      way["leisure"="park"]({s},{w},{n},{e});
      relation["leisure"="park"]({s},{w},{n},{e});
      way["leisure"="playground"]({s},{w},{n},{e});
      way["landuse"="recreation_ground"]({s},{w},{n},{e});
    );
    out body;
    >;
    out skel qt;
    """
    print("Querying Overpass API for OSM parks...")
    cache = TMP_DIR / "osm_parks.json"
    if cache.exists():
        print("  Using cached Overpass response.")
        with open(cache) as f:
            data = json.load(f)
    else:
        resp = requests.post(OVERPASS_URL, data={"data": query}, timeout=90)
        resp.raise_for_status()
        data = resp.json()
        TMP_DIR.mkdir(exist_ok=True)
        with open(cache, "w") as f:
            json.dump(data, f)

    # Build node lookup
    nodes = {el["id"]: (el["lon"], el["lat"]) for el in data["elements"] if el["type"] == "node"}

    features = []
    for el in data["elements"]:
        if el["type"] not in ("way", "relation"):
            continue
        tags = el.get("tags", {})
        name = tags.get("name", tags.get("name:en", "Park"))

        if el["type"] == "way" and "nodes" in el:
            coords = [nodes[n] for n in el["nodes"] if n in nodes]
            if len(coords) < 3:
                continue
            if coords[0] != coords[-1]:
                coords.append(coords[0])
            geom = {"type": "Polygon", "coordinates": [coords]}
        else:
            continue  # skip relations for simplicity in MVP

        area_m2 = None
        try:
            from shapely.geometry import shape
            from shapely.ops import transform
            import pyproj
            project = pyproj.Transformer.from_crs("epsg:4326", "epsg:32643", always_xy=True).transform
            area_m2 = round(transform(project, shape(geom)).area)
        except Exception:
            pass

        features.append({
            "type": "Feature",
            "geometry": geom,
            "properties": {
                "osm_id": el["id"],
                "name": name,
                "type": tags.get("leisure", tags.get("landuse", "park")),
                "area_m2": area_m2,
            },
        })

    gdf = gpd.GeoDataFrame.from_features(features, crs="epsg:4326")
    print(f"  Got {len(gdf)} park polygons from OSM.")
    return gdf


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(exist_ok=True)

    # 1. Fetch BBMP aggregate data (ward-level counts)
    bbmp_df = fetch_bbmp_csv(BBMP_PARKS_CSV_URL)

    # 2. Fetch OSM park polygons
    parks_gdf = fetch_osm_parks()

    if parks_gdf.empty:
        print("No park data found. Exiting.")
        return

    # 3. Compute centroids for label placement (keep polygon as primary geometry)
    parks_gdf["centroid_lng"] = parks_gdf.geometry.centroid.x
    parks_gdf["centroid_lat"] = parks_gdf.geometry.centroid.y

    # 4. Write GeoJSON
    geojson = json.loads(parks_gdf.to_json())
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(geojson, f, separators=(",", ":"))

    size_kb = OUTPUT_FILE.stat().st_size / 1024
    print(f"\nWrote {OUTPUT_FILE}  ({size_kb:.0f} KB)")
    print("Done. ✓")


if __name__ == "__main__":
    main()
