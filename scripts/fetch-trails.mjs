/**
 * Fetch Bengaluru walking trails from Overpass API and save as GeoJSON.
 *
 * Fetches footways, paths, and tracks within Bengaluru's bounding box,
 * converts the Overpass way elements to GeoJSON LineString features,
 * and writes the result to /public/data/trails.geojson.
 *
 * Run: node scripts/fetch-trails.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../public/data");

// Bengaluru bounding box: S, W, N, E
const BBOX = "12.834,77.460,13.143,77.780";

const OVERPASS_MIRRORS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

async function query(q, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const url = OVERPASS_MIRRORS[attempt % OVERPASS_MIRRORS.length];
    try {
      console.log(`  Trying mirror: ${url}`);
      const resp = await fetch(url, {
        method: "POST",
        body: `data=${encodeURIComponent(q)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (resp.status === 429 || resp.status === 504) {
        console.log(`  Mirror ${url} rate-limited, waiting 10s...`);
        await new Promise((r) => setTimeout(r, 10000));
        continue;
      }
      if (!resp.ok) throw new Error(`Overpass ${resp.status} from ${url}`);
      const text = await resp.text();
      // Overpass can return XML error pages — detect and retry
      if (text.trimStart().startsWith("<")) {
        console.log(`  Mirror ${url} returned XML (error), trying next...`);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Failed to parse Overpass response as JSON. Raw: ${text.slice(0, 200)}`);
      }
    } catch (err) {
      if (attempt === retries - 1) throw err;
      console.log(`  Retrying (${attempt + 1}/${retries})...`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

// ── Trails ────────────────────────────────────────────────────────────────
async function fetchTrails() {
  console.log("Fetching trails (footways, paths, tracks) from Overpass...");

  // Query for footways, paths, and tracks — the three OSM highway types
  // most relevant to pedestrian / walking routes in Bengaluru.
  const q = `
    [out:json][timeout:60];
    (
      way["highway"="footway"](${BBOX});
      way["highway"="path"](${BBOX});
      way["highway"="track"](${BBOX});
    );
    out body;
    >;
    out skel qt;
  `;

  const data = await query(q);

  // Build a node lookup table (id → [lon, lat]) from the skeleton output
  const nodes = {};
  for (const el of data.elements) {
    if (el.type === "node") nodes[el.id] = [el.lon, el.lat];
  }

  const features = [];
  for (const el of data.elements) {
    if (el.type !== "way" || !el.nodes) continue;

    // Map node IDs to coordinates; skip any way that has missing nodes
    const coords = el.nodes.map((id) => nodes[id]).filter(Boolean);
    // A valid LineString needs at least 2 points
    if (coords.length < 2) continue;

    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: coords },
      properties: {
        name: el.tags?.name || el.tags?.["name:en"] || null,
        highway: el.tags?.highway || "path",
        surface: el.tags?.surface || null,
        osm_id: el.id,
      },
    });
  }

  console.log(`  → ${features.length} trail segments`);
  return { type: "FeatureCollection", features };
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  // Ensure output directory exists
  if (!fs.existsSync(OUT)) {
    fs.mkdirSync(OUT, { recursive: true });
  }

  const trails = await fetchTrails();
  const outPath = path.join(OUT, "trails.geojson");
  fs.writeFileSync(outPath, JSON.stringify(trails));
  console.log(`  Saved trails.geojson (${trails.features.length} features)`);
  console.log("\nDone! Refresh your browser and toggle the Trails layer.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
