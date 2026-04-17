/**
 * GET /api/events
 *
 * Fetches live outdoor events in Bengaluru via SerpApi (Google Events),
 * geocodes each venue address via MapTiler, and returns a GeoJSON
 * FeatureCollection.  Results are cached in-memory for 24 hours.
 */

import { NextResponse } from "next/server";

// ── Types ────────────────────────────────────────────────────────────────────

interface EventProperties {
  title: string;
  date: string;
  time: string;
  venue: string;
  address: string;
  ticket_url: string | null;
  thumbnail: string | null;
  category: string;
}

interface GeoJSONFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: EventProperties;
}

interface FeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

// Raw shape coming back from SerpApi events_results
interface SerpEvent {
  title?: string;
  date?: { start_date?: string; when?: string };
  address?: string[];
  link?: string;
  thumbnail?: string;
  venue?: { name?: string };
  // SerpApi doesn't always return a category field, but it can
  type?: string;
}

// ── In-memory cache keyed by location string ─────────────────────────────────
const cacheMap = new Map<string, { data: FeatureCollection; expires: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Geocoding helper ─────────────────────────────────────────────────────────

/**
 * Converts an address string to [lng, lat] using the MapTiler Geocoding API.
 * Returns null if the address can't be resolved so the event can be skipped.
 */
async function geocodeAddress(
  address: string,
  maptilerKey: string
): Promise<[number, number] | null> {
  const encoded = encodeURIComponent(address);
  // Bias results toward central Bengaluru
  const url =
    `https://api.maptiler.com/geocoding/${encoded}.json` +
    `?key=${maptilerKey}&proximity=77.5946,12.9716&language=en&limit=1`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = await res.json();
    const center: [number, number] | undefined = json?.features?.[0]?.center;
    if (!center || center.length < 2) return null;

    return center; // [lng, lat]
  } catch {
    // Network or parse error — skip this event
    return null;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  const serpApiKey = process.env.SERPAPI_KEY;

  // Parse optional location query param (e.g. "Indiranagar" or "12.9716,77.5946")
  const { searchParams } = new URL(request.url);
  const locationParam = searchParams.get("location")?.trim() || "Bengaluru";

  // No SerpApi key — serve the curated static events as a fallback
  if (!serpApiKey) {
    try {
      const { readFile } = await import("fs/promises");
      const { join } = await import("path");
      const filePath = join(process.cwd(), "public", "data", "events.geojson");
      const content = await readFile(filePath, "utf-8");
      return NextResponse.json(JSON.parse(content));
    } catch {
      return NextResponse.json({ type: "FeatureCollection", features: [] });
    }
  }

  const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "";

  // Return cached response if still fresh (keyed by location)
  const cached = cacheMap.get(locationParam);
  if (cached && Date.now() < cached.expires) {
    return NextResponse.json(cached.data);
  }

  // ── Step 1: Fetch events from SerpApi ─────────────────────────────────────
  const query = encodeURIComponent(`outdoor events ${locationParam}`);
  const serpUrl =
    `https://serpapi.com/search.json` +
    `?engine=google_events` +
    `&q=${query}` +
    `&location=Bengaluru,Karnataka,India` +
    `&gl=in` +
    `&hl=en` +
    `&api_key=${serpApiKey}`;

  let events: SerpEvent[] = [];
  try {
    const res = await fetch(serpUrl);
    if (!res.ok) {
      return NextResponse.json(
        { error: `SerpApi returned ${res.status}` },
        { status: 502 }
      );
    }
    const json = await res.json();
    // events_results may be absent when there are no results — default to []
    events = json?.events_results ?? [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch events";
    console.error("SerpApi fetch error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // No events? Return empty FeatureCollection (not an error)
  if (!events.length) {
    const empty: FeatureCollection = { type: "FeatureCollection", features: [] };
    cacheMap.set(locationParam, { data: empty, expires: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(empty);
  }

  // ── Step 2: Geocode each event in parallel ────────────────────────────────
  const features: GeoJSONFeature[] = [];

  await Promise.all(
    events.map(async (event) => {
      // Build a single address string from the address array
      const addressParts = event.address ?? [];
      const address = addressParts.join(", ").trim();

      // We need an address to geocode; skip events without one
      if (!address) return;

      const coords = await geocodeAddress(address, maptilerKey);
      if (!coords) return; // geocoding failed — skip silently

      // Parse date and time out of SerpApi's date fields.
      // `start_date` is e.g. "Saturday, April 5"
      // `when`       is e.g. "Saturday, April 5 · 8:45 AM"
      const startDate = event.date?.start_date ?? "";
      const when = event.date?.when ?? startDate;

      // Extract time portion: anything after " · " in the `when` string
      const timePart = when.includes("·")
        ? when.split("·").slice(1).join("·").trim()
        : "";

      // Use start_date for the date field; fall back to the full `when` string
      const datePart = startDate || when;

      // Derive a category from SerpApi's `type` field, defaulting gracefully
      const category = event.type ?? "Outdoor";

      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: coords },
        properties: {
          title: event.title ?? "Untitled Event",
          date: datePart,
          time: timePart,
          venue: event.venue?.name ?? "",
          address,
          ticket_url: event.link ?? null,
          thumbnail: event.thumbnail ?? null,
          category,
        },
      });
    })
  );

  // ── Step 3: Cache and return ──────────────────────────────────────────────
  const featureCollection: FeatureCollection = {
    type: "FeatureCollection",
    features,
  };

  cacheMap.set(locationParam, { data: featureCollection, expires: Date.now() + CACHE_TTL_MS });

  return NextResponse.json(featureCollection);
}
