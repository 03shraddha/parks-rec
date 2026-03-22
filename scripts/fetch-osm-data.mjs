/**
 * Quick Node.js data fetcher — no Python needed.
 * Fetches parks, lakes, and bus stops from Overpass API
 * and writes them to /public/data/ as GeoJSON.
 *
 * Run: node scripts/fetch-osm-data.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../public/data");

// Bengaluru bounding box: S, W, N, E
const BBOX = "12.834,77.461,13.143,77.784";
const OVERPASS_MIRRORS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

async function query(q, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const url = OVERPASS_MIRRORS[attempt % OVERPASS_MIRRORS.length];
    try {
      const resp = await fetch(url, {
        method: "POST",
        body: `data=${encodeURIComponent(q)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (resp.status === 429 || resp.status === 504) {
        console.log(`  Mirror ${url} rate-limited, waiting 10s...`);
        await new Promise(r => setTimeout(r, 10000));
        continue;
      }
      if (!resp.ok) throw new Error(`Overpass ${resp.status} from ${url}`);
      const text = await resp.text();
      if (text.trimStart().startsWith("<")) {
        console.log(`  Mirror ${url} returned XML (error), trying next...`);
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }
      return JSON.parse(text);
    } catch (err) {
      if (attempt === retries - 1) throw err;
      console.log(`  Retrying (${attempt + 1}/${retries})...`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// ── Parks ─────────────────────────────────────────────────────────────────
async function fetchParks() {
  console.log("Fetching parks...");
  const q = `
    [out:json][timeout:60];
    (
      way["leisure"="park"](${BBOX});
      way["leisure"="garden"](${BBOX});
      way["landuse"="recreation_ground"](${BBOX});
      relation["leisure"="park"](${BBOX});
    );
    out body; >; out skel qt;
  `;
  const data = await query(q);
  const nodes = {};
  for (const el of data.elements) {
    if (el.type === "node") nodes[el.id] = [el.lon, el.lat];
  }
  const features = [];
  for (const el of data.elements) {
    if (el.type !== "way" || !el.nodes) continue;
    const coords = el.nodes.map((id) => nodes[id]).filter(Boolean);
    if (coords.length < 3) continue;
    if (coords[0]?.join() !== coords[coords.length - 1]?.join()) coords.push(coords[0]);
    features.push({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [coords] },
      properties: {
        name: el.tags?.name || el.tags?.["name:en"] || "Park",
        type: el.tags?.leisure || el.tags?.landuse || "park",
        osm_id: el.id,
      },
    });
  }
  console.log(`  → ${features.length} parks`);
  return { type: "FeatureCollection", features };
}

// ── Lakes / Waterbodies ───────────────────────────────────────────────────
async function fetchLakes() {
  console.log("Fetching lakes & waterbodies...");
  const q = `
    [out:json][timeout:60];
    (
      way["natural"="water"](${BBOX});
      way["landuse"="reservoir"](${BBOX});
      way["water"="lake"](${BBOX});
      way["water"="reservoir"](${BBOX});
      way["water"="pond"](${BBOX});
      relation["natural"="water"](${BBOX});
    );
    out body; >; out skel qt;
  `;
  const data = await query(q);
  const nodes = {};
  for (const el of data.elements) {
    if (el.type === "node") nodes[el.id] = [el.lon, el.lat];
  }
  const features = [];
  for (const el of data.elements) {
    if (el.type !== "way" || !el.nodes) continue;
    const coords = el.nodes.map((id) => nodes[id]).filter(Boolean);
    if (coords.length < 3) continue;
    if (coords[0]?.join() !== coords[coords.length - 1]?.join()) coords.push(coords[0]);
    features.push({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [coords] },
      properties: {
        name: el.tags?.name || el.tags?.["name:en"] || "Lake",
        water: el.tags?.water || el.tags?.natural || "water",
        osm_id: el.id,
      },
    });
  }
  console.log(`  → ${features.length} waterbodies`);
  return { type: "FeatureCollection", features };
}

// ── Bus Stops ─────────────────────────────────────────────────────────────
async function fetchBusStops() {
  console.log("Fetching bus stops...");
  const q = `
    [out:json][timeout:60];
    (
      node["highway"="bus_stop"](${BBOX});
      node["public_transport"="stop_position"]["bus"="yes"](${BBOX});
      node["public_transport"="platform"]["bus"="yes"](${BBOX});
    );
    out body;
  `;
  const data = await query(q);
  const seen = new Set();
  const features = [];
  for (const el of data.elements) {
    if (el.type !== "node" || seen.has(el.id)) continue;
    seen.add(el.id);
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [el.lon, el.lat] },
      properties: {
        name: el.tags?.name || el.tags?.["name:en"] || "Bus Stop",
        operator: el.tags?.operator || "BMTC",
        osm_id: el.id,
      },
    });
  }
  console.log(`  → ${features.length} bus stops`);
  return { type: "FeatureCollection", features };
}

// ── Trees (OSM) ───────────────────────────────────────────────────────────
async function fetchTrees() {
  console.log("Fetching trees from OSM (hexbin approximation)...");
  const q = `
    [out:json][timeout:90];
    (
      node["natural"="tree"](${BBOX});
    );
    out body;
  `;
  const data = await query(q);
  const trees = data.elements.filter((el) => el.type === "node");
  console.log(`  → ${trees.length} individual trees found`);

  // Aggregate into ~250m hex grid using a simple grid approach
  const CELL = 0.0023; // ~250m in degrees at Bengaluru latitude
  const grid = {};
  for (const t of trees) {
    const gx = Math.floor(t.lon / CELL);
    const gy = Math.floor(t.lat / CELL);
    const key = `${gx}:${gy}`;
    if (!grid[key]) {
      grid[key] = {
        cx: (gx + 0.5) * CELL,
        cy: (gy + 0.5) * CELL,
        count: 0,
        species: {},
      };
    }
    grid[key].count++;
    const sp = t.tags?.species || t.tags?.["species:en"] || t.tags?.taxon || null;
    if (sp) grid[key].species[sp] = (grid[key].species[sp] || 0) + 1;
  }

  const features = Object.values(grid).map(({ cx, cy, count, species }) => {
    const dominant = Object.entries(species).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const half = CELL / 2;
    return {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [cx - half, cy - half],
          [cx + half, cy - half],
          [cx + half, cy + half],
          [cx - half, cy + half],
          [cx - half, cy - half],
        ]],
      },
      properties: { tree_count: count, dominant_species: dominant },
    };
  });

  console.log(`  → aggregated into ${features.length} grid cells`);
  return { type: "FeatureCollection", features };
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("Fetching Bengaluru OSM data from Overpass API...\n");

  // Sequential to avoid Overpass 429 rate limits — write each file immediately
  const parks = await fetchParks();
  fs.writeFileSync(path.join(OUT, "parks.geojson"), JSON.stringify(parks));
  console.log("  Saved parks.geojson");
  await new Promise(r => setTimeout(r, 5000));

  const lakes = await fetchLakes();
  fs.writeFileSync(path.join(OUT, "lakes.geojson"), JSON.stringify(lakes));
  console.log("  Saved lakes.geojson");
  await new Promise(r => setTimeout(r, 5000));

  const busStops = await fetchBusStops();
  fs.writeFileSync(path.join(OUT, "bus-stops.geojson"), JSON.stringify(busStops));
  console.log("  Saved bus-stops.geojson");
  await new Promise(r => setTimeout(r, 5000));

  const trees = await fetchTrees();
  fs.writeFileSync(path.join(OUT, "tree-density.geojson"), JSON.stringify(trees));
  console.log("  Saved tree-density.geojson");

  console.log("\nAll done! Refresh your browser to see the layers.");
}

main().catch((err) => { console.error(err); process.exit(1); });
