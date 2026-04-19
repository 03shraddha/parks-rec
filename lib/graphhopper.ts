/**
 * Mappls (MapmyIndia) Routing API client.
 * Exports the same types and fetchRoutes() signature as the old GraphHopper client
 * so no downstream code needs to change.
 */

export interface Coordinate {
  lng: number;
  lat: number;
}

export interface GHRoute {
  distance: number;       // metres
  time: number;           // milliseconds
  points: GeoJSONLineString;
  instructions: GHInstruction[];
}

export interface GHInstruction {
  text: string;
  distance: number;
  time: number;
  interval: [number, number]; // [startIdx, endIdx] into route coordinates
  sign: number; // 0=straight, -2=left, 2=right, -3=sharp-left, 3=sharp-right, 4=arrive, 5=u-turn, 7=roundabout
}

export interface GeoJSONLineString {
  type: "LineString";
  coordinates: [number, number][];
}

// ── Mappls OSRM response types ─────────────────────────────────────────────

interface MapplsStep {
  distance: number;
  duration: number;
  name: string;
  maneuver: {
    type: string;
    modifier?: string;
    location: [number, number]; // [lng, lat]
  };
}

interface MapplsRoute {
  distance: number;
  duration: number;
  geometry: GeoJSONLineString;
  legs: Array<{ steps: MapplsStep[] }>;
}

interface MapplsResponse {
  code: string;
  routes?: MapplsRoute[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function maneuverToSign(type: string, modifier?: string): number {
  if (type === "arrive") return 4;
  if (type === "roundabout" || type === "rotary") return 7;
  if (type === "uturn") return 5;
  switch (modifier) {
    case "sharp left":   return -3;
    case "left":         return -2;
    case "slight left":  return -1;
    case "straight":     return 0;
    case "slight right": return 1;
    case "right":        return 2;
    case "sharp right":  return 3;
    default:             return 0;
  }
}

function stepText(step: MapplsStep): string {
  const { type, modifier } = step.maneuver;
  const name = step.name;
  if (type === "depart") return name ? `Head toward ${name}` : "Depart";
  if (type === "arrive") return "Arrive at destination";
  if (type === "roundabout" || type === "rotary")
    return name ? `Take roundabout onto ${name}` : "Take roundabout";
  if (modifier === "straight") return name ? `Continue onto ${name}` : "Continue straight";
  if (modifier) {
    const dir = modifier.charAt(0).toUpperCase() + modifier.slice(1);
    return name ? `${dir} onto ${name}` : dir;
  }
  return name ? `Continue onto ${name}` : "Continue";
}

// Find the index of the closest point in coords to the given [lng, lat]
function closestPointIndex(loc: [number, number], coords: [number, number][]): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const dx = coords[i][0] - loc[0];
    const dy = coords[i][1] - loc[1];
    const d = dx * dx + dy * dy;
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

function convertRoute(r: MapplsRoute): GHRoute {
  const coords = r.geometry.coordinates;
  const steps = r.legs.flatMap((l) => l.steps);

  const startIndices = steps.map((s) => closestPointIndex(s.maneuver.location, coords));

  const instructions: GHInstruction[] = steps.map((step, i) => ({
    text: stepText(step),
    distance: step.distance,
    time: Math.round(step.duration * 1000),
    interval: [
      startIndices[i],
      i + 1 < startIndices.length ? startIndices[i + 1] : coords.length - 1,
    ],
    sign: maneuverToSign(step.maneuver.type, step.maneuver.modifier),
  }));

  return {
    distance: r.distance,
    time: Math.round(r.duration * 1000),
    points: r.geometry,
    instructions,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function fetchRoutes(
  origin: Coordinate,
  destination: Coordinate,
  maxPaths = 3
): Promise<GHRoute[]> {
  // OSRM public demo server — same response format, no API key required
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = new URL(`https://router.project-osrm.org/route/v1/foot/${coords}`);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", "true");
  if (maxPaths > 1) url.searchParams.set("alternatives", "true");

  const resp = await fetch(url.toString());
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Routing error ${resp.status}: ${body}`);
  }

  const data: MapplsResponse = await resp.json();
  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error("No route found between these points.");
  }

  return data.routes.slice(0, maxPaths).map(convertRoute);
}
