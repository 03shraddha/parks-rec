/**
 * POST /api/route
 * Body: { origin: { lng, lat }, destination: { lng, lat } }
 *
 * Returns cool route + fast route with shade scores.
 * Results are cached in Vercel KV for 24h to protect the
 * GraphHopper free-tier limit (750 req/day).
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchRoutes, type Coordinate } from "@/lib/graphhopper";
import { scoreRoute, pickRoutes, type ScoredRoute } from "@/lib/shadeScoring";
import fs from "fs";
import path from "path";

// ── Simple in-memory cache (per-process; resets on cold start) ──────────────
// For persistent caching across Vercel invocations, add Upstash Redis via
// the Vercel marketplace and replace this with @upstash/redis.
type CacheStore = { get(k: string): unknown; set(k: string, v: unknown): void };
const memCache = new Map<string, unknown>();
const inMemoryStore: CacheStore = {
  get: (k) => memCache.get(k) ?? null,
  set: (k, v) => memCache.set(k, v),
};

async function getKV(): Promise<CacheStore> {
  return inMemoryStore;
}

function cacheKey(origin: Coordinate, dest: Coordinate): string {
  // Round to 4 decimal places (~11m precision) so nearby pins reuse results
  const r = (n: number) => Math.round(n * 10_000) / 10_000;
  return `route:${r(origin.lat)},${r(origin.lng)}:${r(dest.lat)},${r(dest.lng)}`;
}
// ────────────────────────────────────────────────────────────────────────────

// Load roads-shaded.geojson once per server process
let roadsCache: ReturnType<typeof loadRoads> | null = null;

function loadRoads() {
  const filePath = path.join(process.cwd(), "public", "data", "roads-shaded.geojson");
  if (!fs.existsSync(filePath)) {
    // Return empty array - shade scoring will use default 0 scores
    console.warn("roads-shaded.geojson not found. Run scripts/05_roads_shade.py first.");
    return [];
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  const fc = JSON.parse(raw);
  return fc.features ?? [];
}

function getRoads() {
  if (!roadsCache) roadsCache = loadRoads();
  return roadsCache;
}

export async function POST(req: NextRequest) {
  let origin: Coordinate, destination: Coordinate;
  try {
    const body = await req.json();
    origin = body.origin;
    destination = body.destination;
    if (!origin?.lng || !origin?.lat || !destination?.lng || !destination?.lat) {
      return NextResponse.json({ error: "Invalid origin or destination." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const key = cacheKey(origin, destination);

  // 1. Check cache
  const store = await getKV();
  const cached = store.get(key);
  if (cached) {
    return NextResponse.json({ ...cached as object, cached: true });
  }

  // 2. Fetch routes from GraphHopper
  let paths;
  try {
    paths = await fetchRoutes(origin, destination, 3);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Routing failed.";
    console.error("GraphHopper error:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (!paths.length) {
    return NextResponse.json({ error: "No route found between these points." }, { status: 404 });
  }

  // 3. Score routes against shade data
  const roads = getRoads();
  const scored: ScoredRoute[] = paths.map((p) => scoreRoute(p, roads));

  // 4. Pick fast vs cool
  const { fastRoute, coolRoute } = pickRoutes(scored);

  const result = { fastRoute, coolRoute };

  // 5. Cache result
  store.set(key, result);

  return NextResponse.json(result);
}
