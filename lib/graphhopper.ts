/**
 * GraphHopper Routing API client.
 * Fetches up to 3 alternative walking routes between two coordinates.
 */

export interface Coordinate {
  lng: number;
  lat: number;
}

export interface GHRoute {
  distance: number;         // metres
  time: number;             // milliseconds
  points: GeoJSONLineString;
  instructions: GHInstruction[];
}

export interface GHInstruction {
  text: string;
  distance: number;
  time: number;
  interval: [number, number];
  sign: number; // 0=straight, -2=left, 2=right, -3=sharp-left, 3=sharp-right, 4=arrive, 5=u-turn, 7=roundabout
}

export interface GeoJSONLineString {
  type: "LineString";
  coordinates: [number, number][];
}

export interface GHResponse {
  paths: GHRoute[];
  info?: { took: number };
}

const GH_BASE = "https://graphhopper.com/api/1";

export async function fetchRoutes(
  origin: Coordinate,
  destination: Coordinate,
  maxPaths = 3
): Promise<GHRoute[]> {
  // Works server-side (GRAPHHOPPER_API_KEY) and client-side (NEXT_PUBLIC_GRAPHHOPPER_API_KEY)
  const key = process.env.GRAPHHOPPER_API_KEY ?? process.env.NEXT_PUBLIC_GRAPHHOPPER_API_KEY;
  if (!key) throw new Error("GRAPHHOPPER_API_KEY env var not set.");

  const url = new URL(`${GH_BASE}/route`);
  url.searchParams.set("key", key);
  url.searchParams.set("vehicle", "foot");
  url.searchParams.set("locale", "en");
  url.searchParams.set("points_encoded", "false");
  url.searchParams.set("algorithm", "alternative_route");
  url.searchParams.set("alternative_route.max_paths", String(maxPaths));
  url.searchParams.set("alternative_route.max_weight_factor", "1.6");
  url.searchParams.set("alternative_route.max_share_factor", "0.7");
  url.searchParams.set("instructions", "true");

  // GraphHopper expects point[]=lat,lng (note: lat first)
  url.searchParams.append("point", `${origin.lat},${origin.lng}`);
  url.searchParams.append("point", `${destination.lat},${destination.lng}`);

  const resp = await fetch(url.toString());

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`GraphHopper error ${resp.status}: ${body}`);
  }

  const data: GHResponse = await resp.json();
  return data.paths ?? [];
}
