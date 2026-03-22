"""
05_roads_shade.py — OSM road network + tree hexbins → roads-shaded.geojson

Downloads the Bengaluru road network from OSM (via osmnx) and computes a
shade_score [0, 1] for each road segment based on how many trees from the
BBMP hexbin grid fall within a 15-metre buffer.

Also annotates each segment with the nearest park name and distance.

Output: ../public/data/roads-shaded.geojson

Usage:
    pip install osmnx geopandas shapely pyproj
    python 05_roads_shade.py

Runtime: ~10-20 min on first run (downloads OSM data). Subsequent runs use cache.
"""

import json
import math
from pathlib import Path

import geopandas as gpd
import osmnx as ox
import pandas as pd
from shapely.geometry import shape
from shapely.ops import transform
import pyproj

# ── Config ──────────────────────────────────────────────────────────────────
OUTPUT_DIR = Path(__file__).parent.parent / "public" / "data"
OUTPUT_FILE = OUTPUT_DIR / "roads-shaded.geojson"
DATA_DIR = Path(__file__).parent.parent / "public" / "data"
TMP_DIR = Path(__file__).parent / "_tmp"

TREE_DENSITY_FILE = DATA_DIR / "tree-density.geojson"
PARKS_FILE = DATA_DIR / "parks.geojson"

# Only include roads where pedestrians would walk
ROAD_FILTER = (
    '["highway"~"residential|tertiary|secondary|primary|unclassified|'
    'living_street|pedestrian|footway|path|steps|track"]'
)

BUFFER_METRES = 15          # tree proximity radius
SHADE_CAP = 5.0             # trees-per-metre value that maps to shade_score=1.0
BENGALURU_PLACE = "Bengaluru, Karnataka, India"

# UTM zone 43N for Bengaluru (metric CRS)
CRS_METRIC = pyproj.CRS("epsg:32643")
CRS_WGS84 = pyproj.CRS("epsg:4326")
to_metric = pyproj.Transformer.from_crs(CRS_WGS84, CRS_METRIC, always_xy=True).transform
to_wgs84 = pyproj.Transformer.from_crs(CRS_METRIC, CRS_WGS84, always_xy=True).transform
# ────────────────────────────────────────────────────────────────────────────


def load_or_download_roads() -> gpd.GeoDataFrame:
    """Download road network from OSM (cached to disk)."""
    cache = TMP_DIR / "bengaluru_roads.graphml"
    if cache.exists():
        print("Loading roads from cache...")
        G = ox.load_graphml(str(cache))
    else:
        print(f"Downloading road network for '{BENGALURU_PLACE}' …")
        print("(This may take 5–15 minutes on first run)")
        G = ox.graph_from_place(
            BENGALURU_PLACE,
            network_type="walk",
            custom_filter=ROAD_FILTER,
        )
        TMP_DIR.mkdir(exist_ok=True)
        ox.save_graphml(G, str(cache))
        print("Cached to", cache)

    edges = ox.graph_to_gdfs(G, nodes=False)
    edges = edges.to_crs(epsg=4326)
    print(f"Loaded {len(edges):,} road segments.")
    return edges.reset_index()


def load_tree_hexbins() -> gpd.GeoDataFrame:
    """Load the pre-computed tree density hexbins."""
    if not TREE_DENSITY_FILE.exists():
        raise FileNotFoundError(
            f"{TREE_DENSITY_FILE} not found. Run 01_trees.py first."
        )
    gdf = gpd.read_file(str(TREE_DENSITY_FILE))
    gdf = gdf.to_crs(epsg=4326)
    print(f"Loaded {len(gdf):,} tree hexbins.")
    return gdf


def load_parks() -> gpd.GeoDataFrame | None:
    if not PARKS_FILE.exists():
        print("parks.geojson not found — skipping nearest-park annotation.")
        return None
    gdf = gpd.read_file(str(PARKS_FILE)).to_crs(epsg=4326)
    print(f"Loaded {len(gdf):,} park polygons for annotation.")
    return gdf


def compute_shade_scores(
    edges: gpd.GeoDataFrame,
    hexbins: gpd.GeoDataFrame,
    parks: gpd.GeoDataFrame | None,
    batch_size: int = 5000,
) -> gpd.GeoDataFrame:
    """
    For each road segment, count trees within BUFFER_METRES and compute shade_score.
    Also find nearest park name and distance.
    """
    print("Projecting to metric CRS...")
    edges_m = edges.to_crs(epsg=32643)
    hexbins_m = hexbins.to_crs(epsg=32643)
    parks_m = parks.to_crs(epsg=32643) if parks is not None else None

    # Compute hex centroids for fast spatial join
    hexbins_m["centroid"] = hexbins_m.geometry.centroid
    hex_centroids = hexbins_m.set_geometry("centroid")

    shade_scores = []
    tree_counts = []
    dominant_species = []
    nearest_park_names = []
    nearest_park_dists = []

    total = len(edges_m)
    print(f"Computing shade scores for {total:,} segments (buffer={BUFFER_METRES}m)…")

    for i, (_, row) in enumerate(edges_m.iterrows()):
        if i % 5000 == 0:
            pct = i / total * 100
            print(f"  {i:,}/{total:,} ({pct:.0f}%)…")

        seg_geom = row.geometry
        seg_len = seg_geom.length  # metres

        # Buffer the segment and find intersecting hexbin centroids
        buf = seg_geom.buffer(BUFFER_METRES)
        possible = hex_centroids[hex_centroids.sindex.query(buf, predicate="intersects")]
        if not possible.empty:
            intersects = possible[possible.geometry.intersects(buf)]
            count = int(intersects["tree_count"].sum())
            dom = (
                intersects.loc[intersects["tree_count"].idxmax(), "dominant_species"]
                if not intersects.empty
                else None
            )
        else:
            count = 0
            dom = None

        # shade_score: trees per metre, capped at SHADE_CAP, normalised to [0,1]
        trees_per_m = count / max(seg_len, 1.0)
        score = round(min(trees_per_m / SHADE_CAP, 1.0), 3)

        shade_scores.append(score)
        tree_counts.append(count)
        dominant_species.append(dom)

        # Nearest park
        if parks_m is not None:
            seg_point = seg_geom.centroid
            dists = parks_m.geometry.distance(seg_point)
            idx_min = dists.idxmin()
            nearest_park_names.append(parks_m.loc[idx_min, "name"] if "name" in parks_m.columns else None)
            nearest_park_dists.append(round(dists[idx_min]))
        else:
            nearest_park_names.append(None)
            nearest_park_dists.append(None)

    edges["shade_score"] = shade_scores
    edges["tree_count"] = tree_counts
    edges["dominant_species"] = dominant_species
    edges["nearest_park"] = nearest_park_names
    edges["nearest_park_dist_m"] = nearest_park_dists

    print("Shade scoring complete.")
    return edges


def simplify_for_export(edges: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Keep only columns needed by the app; simplify geometry slightly."""
    keep_cols = [
        "geometry", "name", "highway", "shade_score",
        "tree_count", "dominant_species", "nearest_park", "nearest_park_dist_m",
        "osmid", "length",
    ]
    keep = [c for c in keep_cols if c in edges.columns]
    edges = edges[keep].copy()
    # Simplify geometry: 1m tolerance (preserves shape, reduces file size ~20%)
    edges_m = edges.to_crs(epsg=32643)
    edges_m["geometry"] = edges_m.geometry.simplify(1.0, preserve_topology=True)
    edges = edges_m.to_crs(epsg=4326)
    return edges


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(exist_ok=True)

    roads = load_or_download_roads()
    hexbins = load_tree_hexbins()
    parks = load_parks()

    roads = compute_shade_scores(roads, hexbins, parks)
    roads = simplify_for_export(roads)

    geojson = json.loads(roads.to_json())
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(geojson, f, separators=(",", ":"))

    size_mb = OUTPUT_FILE.stat().st_size / 1e6
    print(f"\nWrote {OUTPUT_FILE}  ({size_mb:.1f} MB)")
    print("Tip: if > 10 MB, run: gzip -k roads-shaded.geojson")
    print("Done. ✓")


if __name__ == "__main__":
    main()
