"""
04_bus_stops.py — Overpass API → bus-stops.geojson

Fetches all BMTC bus stops in Bengaluru from OpenStreetMap via
the Overpass API and exports as GeoJSON.

Output: ../public/data/bus-stops.geojson

Usage:
    pip install requests
    python 04_bus_stops.py
"""

import json
from pathlib import Path

import requests

# ── Config ──────────────────────────────────────────────────────────────────
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
BENGALURU_BBOX = (12.834, 77.461, 13.143, 77.784)  # S, W, N, E

OUTPUT_DIR = Path(__file__).parent.parent / "public" / "data"
OUTPUT_FILE = OUTPUT_DIR / "bus-stops.geojson"
TMP_DIR = Path(__file__).parent / "_tmp"
CACHE_FILE = TMP_DIR / "osm_bus_stops.json"
# ────────────────────────────────────────────────────────────────────────────


def fetch_bus_stops() -> list[dict]:
    s, w, n, e = BENGALURU_BBOX
    query = f"""
    [out:json][timeout:60];
    (
      node["highway"="bus_stop"]({s},{w},{n},{e});
      node["public_transport"="stop_position"]["bus"="yes"]({s},{w},{n},{e});
      node["public_transport"="platform"]["bus"="yes"]({s},{w},{n},{e});
    );
    out body;
    """
    if CACHE_FILE.exists():
        print("Using cached Overpass bus stop response.")
        with open(CACHE_FILE) as f:
            data = json.load(f)
    else:
        print("Querying Overpass API for bus stops...")
        resp = requests.post(OVERPASS_URL, data={"data": query}, timeout=90)
        resp.raise_for_status()
        data = resp.json()
        TMP_DIR.mkdir(exist_ok=True)
        with open(CACHE_FILE, "w") as f:
            json.dump(data, f)

    features = []
    seen_ids = set()
    for el in data.get("elements", []):
        if el["type"] != "node" or el["id"] in seen_ids:
            continue
        seen_ids.add(el["id"])
        tags = el.get("tags", {})
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [el["lon"], el["lat"]]},
            "properties": {
                "osm_id": el["id"],
                "name": tags.get("name", tags.get("name:en", "Bus Stop")),
                "operator": tags.get("operator", "BMTC"),
                "ref": tags.get("ref", None),
            },
        })

    print(f"Found {len(features):,} bus stops.")
    return features


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(exist_ok=True)

    features = fetch_bus_stops()
    geojson = {"type": "FeatureCollection", "features": features}

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(geojson, f, separators=(",", ":"))

    size_kb = OUTPUT_FILE.stat().st_size / 1024
    print(f"\nWrote {OUTPUT_FILE}  ({size_kb:.0f} KB)")
    print("Done. ✓")


if __name__ == "__main__":
    main()
