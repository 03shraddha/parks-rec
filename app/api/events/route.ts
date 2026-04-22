/**
 * GET /api/events
 *
 * Fetches live free events in Bengaluru via Exa AI search (Luma, Meetup,
 * Insider.in, etc.), merges them with the curated static events.geojson,
 * filters out past events, and returns a GeoJSON FeatureCollection.
 * Results are cached in-memory for 48 hours.
 *
 * Falls back to the static file only when no EXA_API_KEY is set.
 */

import { NextResponse } from "next/server";
import Exa from "exa-js";

// ── Types ────────────────────────────────────────────────────────────────────

interface EventProperties {
  title: string;
  date: string;
  time: string;
  venue: string;
  address: string;
  ticket_url: string | null;
  more_info_url: string | null;
  thumbnail: string | null;
  category: string;
  approximate?: boolean;
  organizer?: string;
  contact_phone?: string;
  contact_email?: string;
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

// ── In-memory cache keyed by location string ─────────────────────────────────
const cacheMap = new Map<string, { data: FeatureCollection; expires: number }>();
const CACHE_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

// ── Geocoding helper (Nominatim) ─────────────────────────────────────────────

async function geocodeAddress(address: string): Promise<[number, number] | null> {
  const query = encodeURIComponent(`${address} Bengaluru`);
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, {
      headers: { "User-Agent": "walk-the-city-bangalore/1.0" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json[0]?.lon || !json[0]?.lat) return null;
    return [parseFloat(json[0].lon), parseFloat(json[0].lat)];
  } catch {
    return null;
  }
}

// ── Date parsing helpers ──────────────────────────────────────────────────────

const MONTH_NAMES = [
  "january","february","march","april","may","june",
  "july","august","september","october","november","december",
];
const MONTH_SHORT = [
  "jan","feb","mar","apr","may","jun",
  "jul","aug","sep","oct","nov","dec",
];

function parseEventDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // "Apr 20, 2026" or "April 20, 2026"
  let m = dateStr.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) {
    const idx = [...MONTH_NAMES, ...MONTH_SHORT].findIndex(
      (mn) => mn === m![1].toLowerCase()
    );
    const monthIdx = idx >= 12 ? idx - 12 : idx;
    if (monthIdx >= 0) return new Date(parseInt(m[3]), monthIdx, parseInt(m[2]));
  }

  // "20 April 2026" or "20 Apr 2026"
  m = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (m) {
    const idx = [...MONTH_NAMES, ...MONTH_SHORT].findIndex(
      (mn) => mn === m![2].toLowerCase()
    );
    const monthIdx = idx >= 12 ? idx - 12 : idx;
    if (monthIdx >= 0) return new Date(parseInt(m[3]), monthIdx, parseInt(m[1]));
  }

  // "Sunday, April 20" or "Apr 20" (no year → assume current year)
  m = dateStr.match(/(\w+)\s+(\d{1,2})(?:,?\s*(\d{4}))?/);
  if (m) {
    const idx = [...MONTH_NAMES, ...MONTH_SHORT].findIndex(
      (mn) => mn === m![1].toLowerCase()
    );
    const monthIdx = idx >= 12 ? idx - 12 : idx;
    const year = m[3] ? parseInt(m[3]) : new Date().getFullYear();
    if (monthIdx >= 0) return new Date(year, monthIdx, parseInt(m[2]));
  }

  return null;
}

// ── Exa result → EventProperties ─────────────────────────────────────────────

function cleanTitle(raw: string): string {
  return raw
    .replace(/\s*[|\-–—]\s*(Luma|Insider|Meetup|Eventbrite|BookMyShow|LinkedIn).*$/i, "")
    .trim();
}

function extractDateAndTime(text: string): { date: string; time: string } {
  // Time: "5:00 PM IST", "10:30 AM", "17:00"
  const timeMatch = text.match(/\b(\d{1,2}:\d{2}\s*(?:AM|PM)?(?:\s*IST)?|\d{2}:\d{2})\b/i);
  const time = timeMatch ? timeMatch[0].trim() : "";

  // Date patterns
  const datePatterns = [
    /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i,
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i,
    /\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/i,
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}/i,
  ];
  for (const pat of datePatterns) {
    const m = text.match(pat);
    if (m) return { date: m[0].trim(), time };
  }
  return { date: "", time };
}

function extractVenue(text: string, url: string): string {
  if (url.includes("lu.ma")) {
    // Luma pages: venue name often appears after the date line
    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const { date } = extractDateAndTime(lines[i]);
      if (date && i + 1 < lines.length) {
        const candidate = lines[i + 1];
        if (candidate.length < 80 && !/^https?:/i.test(candidate)) return candidate;
      }
    }
  }
  // Generic: first line that looks like a venue (short, no URL)
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.length > 3 && line.length < 60 && !/^https?:/i.test(line) && /[A-Z]/.test(line[0])) {
      return line;
    }
  }
  return "";
}

function extractContact(text: string): { organizer?: string; phone?: string; email?: string } {
  // Email
  const emailMatch = text.match(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}\b/i);

  // Indian mobile / international phone
  const phoneMatch = text.match(/(?:\+91[\s-]?)?[6-9]\d{9}|\+91\s?\d{10}/);

  // Organizer name after common patterns
  const orgPatterns = [
    /(?:hosted|organized|organised|presented|by)\s+by\s+([\w\s&.'"-]{3,50?}?)(?:[,\n.]|$)/i,
    /(?:Organis(?:er|ed)|Organiz(?:er|ed)|Host)\s*[:\-]\s*([\w\s&.'"-]{3,50?}?)(?:[,\n.]|$)/i,
  ];
  let organizer: string | undefined;
  for (const pat of orgPatterns) {
    const m = text.match(pat);
    if (m?.[1]) { organizer = m[1].trim(); break; }
  }

  return {
    ...(organizer && { organizer }),
    ...(phoneMatch && { phone: phoneMatch[0].trim() }),
    ...(emailMatch && { email: emailMatch[0].toLowerCase().trim() }),
  };
}

// ── Load static curated events ────────────────────────────────────────────────

async function loadStaticEvents(): Promise<GeoJSONFeature[]> {
  try {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const filePath = join(process.cwd(), "public", "data", "events.geojson");
    const content = await readFile(filePath, "utf-8");
    const geojson = JSON.parse(content) as FeatureCollection;
    return geojson.features ?? [];
  } catch {
    return [];
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  const exaApiKey = process.env.EXA_API_KEY;

  const { searchParams } = new URL(request.url);
  const locationParam = searchParams.get("location")?.trim() || "Bengaluru";

  // No Exa key — return static curated events only
  if (!exaApiKey) {
    const features = await loadStaticEvents();
    return NextResponse.json({ type: "FeatureCollection", features });
  }

  // Return cached response if still fresh
  const cached = cacheMap.get(locationParam);
  if (cached && Date.now() < cached.expires) {
    return NextResponse.json(cached.data);
  }

  // ── Step 1: Load static curated events ───────────────────────────────────
  const staticFeatures = await loadStaticEvents();

  // ── Step 2: Fetch live events from Exa ───────────────────────────────────
  const exa = new Exa(exaApiKey);
  const locationQuery =
    locationParam === "Bengaluru"
      ? "free events Bangalore Bengaluru"
      : `free events ${locationParam} Bangalore`;

  let exaResults: Array<{
    title: string | null;
    url: string;
    publishedDate?: string;
    text?: string;
  }> = [];

  try {
    const portalQuery = locationParam === "Bengaluru"
      ? "free outdoor cultural events Bengaluru"
      : `free events ${locationParam} Bengaluru`;

    const [lumaRes, portalRes] = await Promise.all([
      // Luma + Meetup: best source for free community events
      exa.searchAndContents(locationQuery, {
        type: "auto",
        numResults: 8,
        includeDomains: ["lu.ma", "meetup.com"],
        contents: { text: { maxCharacters: 700 } },
        livecrawl: "fallback",
      }),
      // Indie event portals
      exa.searchAndContents(portalQuery, {
        type: "auto",
        numResults: 6,
        includeDomains: ["insider.in", "bookmyshow.com", "eventbrite.com"],
        contents: { text: { maxCharacters: 700 } },
        livecrawl: "fallback",
      }),
    ]);

    exaResults = [
      ...(lumaRes.results ?? []),
      ...(portalRes.results ?? []),
    ];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[events] Exa fetch failed:", msg);
    // Return static events with a header so the client can detect Exa failure
    return NextResponse.json(
      { type: "FeatureCollection", features: staticFeatures },
      { headers: { "X-Events-Source": "static-fallback", "X-Events-Error": msg.slice(0, 120) } }
    );
  }

  // ── Step 3: Parse Exa results → GeoJSON features ─────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const exaFeatures: GeoJSONFeature[] = [];
  const seenTitles = new Set(staticFeatures.map((f) => f.properties.title.toLowerCase()));

  await Promise.all(
    exaResults.map(async (result) => {
      const text = result.text ?? "";
      const title = cleanTitle(result.title ?? "");
      if (!title || seenTitles.has(title.toLowerCase())) return;

      const { date, time } = extractDateAndTime(text);

      // Skip past events (if we could parse the date)
      if (date) {
        const eventDate = parseEventDate(date);
        if (eventDate && eventDate < today) return;
      }

      const venue = extractVenue(text, result.url);
      const geocoded = venue ? await geocodeAddress(venue) : null;
      // Fall back to Bengaluru city center with small jitter so pins don't stack
      const jitter = () => (Math.random() - 0.5) * 0.04;
      const coords: [number, number] = geocoded ?? [77.5946 + jitter(), 12.9716 + jitter()];
      const approximate = !geocoded;

      // Derive category from URL domain
      let category = "Community";
      if (result.url.includes("lu.ma")) category = "Meetup";
      else if (result.url.includes("meetup.com")) category = "Community";
      else if (result.url.includes("insider.in")) category = "Cultural";

      const { organizer, phone, email } = extractContact(text);

      seenTitles.add(title.toLowerCase());
      exaFeatures.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: coords },
        properties: {
          title,
          date,
          time,
          venue,
          address: `${venue}, Bengaluru`,
          ticket_url: result.url ?? null,
          more_info_url: result.url ?? null,
          thumbnail: null,
          category,
          ...(approximate && { approximate: true }),
          ...(organizer && { organizer }),
          ...(phone && { contact_phone: phone }),
          ...(email && { contact_email: email }),
        },
      });
    })
  );

  // ── Step 4: Filter past events from static list too ───────────────────────
  const filteredStatic = staticFeatures.filter((f) => {
    const d = parseEventDate(f.properties.date);
    return !d || d >= today;
  });

  // ── Step 5: Cache and return merged result ────────────────────────────────
  const featureCollection: FeatureCollection = {
    type: "FeatureCollection",
    features: [...filteredStatic, ...exaFeatures],
  };

  cacheMap.set(locationParam, {
    data: featureCollection,
    expires: Date.now() + CACHE_TTL_MS,
  });

  return NextResponse.json(featureCollection);
}
