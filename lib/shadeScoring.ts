/**
 * Shade scoring for route candidates.
 *
 * Given a route geometry (array of [lng, lat] coordinates) and the
 * pre-computed roads-shaded.geojson dataset, this module computes a
 * weighted average shade score for each route.
 *
 * The roads-shaded.geojson must be loaded once and cached server-side.
 */

import type { GHRoute } from "./graphhopper";
import type { Feature, FeatureCollection, LineString } from "geojson";

export interface ScoredRoute extends GHRoute {
  shadeScore: number;       // weighted average [0, 1]
  shadePct: number;         // shadeScore * 100, rounded
  perSegment: SegmentInfo[];
}

export interface SegmentInfo {
  coordinates: [number, number][];
  shade_score: number;
  tree_count: number;
  dominant_species: string | null;
  nearest_park: string | null;
  nearest_park_dist_m: number | null;
  road_name: string | null;
}

type RoadFeature = Feature<LineString, {
  shade_score: number;
  tree_count: number;
  dominant_species: string | null;
  nearest_park: string | null;
  nearest_park_dist_m: number | null;
  name?: string;
}>;

/** Squared Euclidean distance between two points (fast, no sqrt needed for comparison). */
function distSq(ax: number, ay: number, bx: number, by: number): number {
  return (ax - bx) ** 2 + (ay - by) ** 2;
}

/**
 * Find the nearest road feature to a midpoint coordinate.
 * Uses a simple linear scan — acceptable for server-side use with
 * ~150k features; for very large datasets consider an R-tree index.
 */
function findNearestRoad(
  lng: number,
  lat: number,
  roads: RoadFeature[]
): RoadFeature | null {
  let best: RoadFeature | null = null;
  let bestDist = Infinity;

  for (const road of roads) {
    const coords = road.geometry.coordinates;
    for (const [rlng, rlat] of coords) {
      const d = distSq(lng, lat, rlng, rlat);
      if (d < bestDist) {
        bestDist = d;
        best = road;
      }
    }
  }
  return best;
}

/**
 * Score a single route against the road shade dataset.
 * Samples every N-th coordinate pair from the route geometry as a midpoint,
 * finds the nearest pre-scored road segment, and computes a weighted average.
 */
export function scoreRoute(
  route: GHRoute,
  roads: RoadFeature[],
  sampleEvery = 5 // sample 1 in every N coordinate pairs
): ScoredRoute {
  const routeCoords = route.points.coordinates;
  const perSegment: SegmentInfo[] = [];

  let totalWeight = 0;
  let weightedScore = 0;

  for (let i = 0; i < routeCoords.length - 1; i += sampleEvery) {
    const [lng0, lat0] = routeCoords[i];
    const [lng1, lat1] = routeCoords[Math.min(i + 1, routeCoords.length - 1)];
    const midLng = (lng0 + lng1) / 2;
    const midLat = (lat0 + lat1) / 2;

    // Segment length in degrees (proxy for metres at Bengaluru latitude)
    const segLen = Math.sqrt(distSq(lng0, lat0, lng1, lat1));

    const road = findNearestRoad(midLng, midLat, roads);
    const score = road?.properties.shade_score ?? 0;

    weightedScore += score * segLen;
    totalWeight += segLen;

    perSegment.push({
      coordinates: [[lng0, lat0], [lng1, lat1]],
      shade_score: score,
      tree_count: road?.properties.tree_count ?? 0,
      dominant_species: road?.properties.dominant_species ?? null,
      nearest_park: road?.properties.nearest_park ?? null,
      nearest_park_dist_m: road?.properties.nearest_park_dist_m ?? null,
      road_name: road?.properties.name ?? null,
    });
  }

  const shadeScore = totalWeight > 0 ? weightedScore / totalWeight : 0;

  return {
    ...route,
    shadeScore,
    shadePct: Math.round(shadeScore * 100),
    perSegment,
  };
}

/**
 * From a list of candidate routes, return:
 *   fastRoute   — shortest travel time
 *   coolRoute   — highest shade score (may be the same route)
 */
export function pickRoutes(candidates: ScoredRoute[]): {
  fastRoute: ScoredRoute;
  coolRoute: ScoredRoute;
} {
  if (candidates.length === 0) {
    throw new Error("No route candidates to pick from.");
  }

  const fastRoute = candidates.reduce((a, b) => (a.time < b.time ? a : b));
  const coolRoute = candidates.reduce((a, b) =>
    a.shadeScore > b.shadeScore ? a : b
  );

  return { fastRoute, coolRoute };
}

/** Format milliseconds as "X min" or "X hr Y min". */
export function formatDuration(ms: number): string {
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

/** Format metres as "X m" or "X.X km". */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}
