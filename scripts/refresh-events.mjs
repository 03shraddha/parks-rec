/**
 * scripts/refresh-events.mjs
 *
 * Fetches free Bengaluru events via Exa AI, merges with the existing
 * curated events.geojson, filters past events, and overwrites the file.
 *
 * Run manually:   EXA_API_KEY=xxx node scripts/refresh-events.mjs
 * Runs via cron:  .github/workflows/refresh-events.yml  (every 2 days)
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import Exa from "exa-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EVENTS_FILE = join(__dirname, "..", "public", "data", "events.geojson");

// ── Config ────────────────────────────────────────────────────────────────────

const EXA_API_KEY = process.env.EXA_API_KEY;
if (!EXA_API_KEY) {
  console.error("EXA_API_KEY environment variable is required");
  process.exit(1);
}

// ── Helpers (mirrors app/api/events/route.ts) ─────────────────────────────────

const MONTH_NAMES = [
  "january","february","march","april","may","june",
  "july","august","september","october","november","december",
];
const MONTH_SHORT = [
  "jan","feb","mar","apr","may","jun",
  "jul","aug","sep","oct","nov","dec",
];

function parseEventDate(dateStr) {
  if (!dateStr) return null;

  let m = dateStr.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) {
    const idx = [...MONTH_NAMES, ...MONTH_SHORT].findIndex(
      (mn) => mn === m[1].toLowerCase()
    );
    const monthIdx = idx >= 12 ? idx - 12 : idx;
    if (monthIdx >= 0) return new Date(parseInt(m[3]), monthIdx, parseInt(m[2]));
  }

  m = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (m) {
    const idx = [...MONTH_NAMES, ...MONTH_SHORT].findIndex(
      (mn) => mn === m[2].toLowerCase()
    );
    const monthIdx = idx >= 12 ? idx - 12 : idx;
    if (monthIdx >= 0) return new Date(parseInt(m[3]), monthIdx, parseInt(m[1]));
  }

  m = dateStr.match(/(\w+)\s+(\d{1,2})(?:,?\s*(\d{4}))?/);
  if (m) {
    const idx = [...MONTH_NAMES, ...MONTH_SHORT].findIndex(
      (mn) => mn === m[1].toLowerCase()
    );
    const monthIdx = idx >= 12 ? idx - 12 : idx;
    const year = m[3] ? parseInt(m[3]) : new Date().getFullYear();
    if (monthIdx >= 0) return new Date(year, monthIdx, parseInt(m[2]));
  }

  return null;
}

function cleanTitle(raw) {
  return raw
    .replace(/\s*[|\-–—]\s*(Luma|Insider|Meetup|Eventbrite|BookMyShow|LinkedIn).*$/i, "")
    .trim();
}

function extractDateAndTime(text) {
  const timeMatch = text.match(/\b(\d{1,2}:\d{2}\s*(?:AM|PM)?(?:\s*IST)?|\d{2}:\d{2})\b/i);
  const time = timeMatch ? timeMatch[0].trim() : "";

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

function extractVenue(text, url) {
  if (url.includes("lu.ma")) {
    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const { date } = extractDateAndTime(lines[i]);
      if (date && i + 1 < lines.length) {
        const candidate = lines[i + 1];
        if (candidate.length < 80 && !/^https?:/i.test(candidate)) return candidate;
      }
    }
  }
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.length > 3 && line.length < 60 && !/^https?:/i.test(line) && /[A-Z]/.test(line[0])) {
      return line;
    }
  }
  return "";
}

async function geocodeAddress(address) {
  const query = encodeURIComponent(`${address} Bengaluru`);
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "walk-the-city-bangalore/1.0" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json[0]?.lon || !json[0]?.lat) return null;
    return [parseFloat(json[0].lon), parseFloat(json[0].lat)];
  } catch {
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Loading existing curated events...");
  let staticFeatures = [];
  try {
    const existing = JSON.parse(readFileSync(EVENTS_FILE, "utf-8"));
    staticFeatures = existing.features ?? [];
    console.log(`  Loaded ${staticFeatures.length} static events`);
  } catch {
    console.warn("  No existing events.geojson found, starting fresh");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter past events from static list
  const filteredStatic = staticFeatures.filter((f) => {
    const d = parseEventDate(f.properties?.date ?? "");
    return !d || d >= today;
  });
  console.log(`  ${filteredStatic.length} static events are upcoming`);

  const seenTitles = new Set(filteredStatic.map((f) => f.properties.title.toLowerCase()));

  console.log("Fetching live events from Exa...");
  const exa = new Exa(EXA_API_KEY);

  let exaResults = [];
  try {
    const [lumaRes, portalRes] = await Promise.all([
      exa.searchAndContents("free events Bangalore Bengaluru", {
        type: "auto",
        numResults: 15,
        includeDomains: ["lu.ma", "meetup.com"],
        contents: { text: { maxCharacters: 700 } },
        livecrawl: "fallback",
      }),
      exa.searchAndContents("free outdoor cultural events Bengaluru", {
        type: "auto",
        numResults: 10,
        includeDomains: ["insider.in", "bookmyshow.com", "eventbrite.com"],
        contents: { text: { maxCharacters: 700 } },
        livecrawl: "fallback",
      }),
    ]);
    exaResults = [...(lumaRes.results ?? []), ...(portalRes.results ?? [])];
    console.log(`  Got ${exaResults.length} raw results from Exa`);
  } catch (err) {
    console.error("Exa search failed:", err.message);
    process.exit(1);
  }

  console.log("Parsing and geocoding Exa results...");
  const exaFeatures = [];

  for (const result of exaResults) {
    const text = result.text ?? "";
    const title = cleanTitle(result.title ?? "");
    if (!title || seenTitles.has(title.toLowerCase())) continue;

    const { date, time } = extractDateAndTime(text);

    if (date) {
      const eventDate = parseEventDate(date);
      if (eventDate && eventDate < today) {
        console.log(`  Skipping past event: ${title} (${date})`);
        continue;
      }
    }

    const venue = extractVenue(text, result.url ?? "");
    const coords = venue ? await geocodeAddress(venue) : null;
    if (!coords) {
      console.log(`  Skipping (no coords): ${title}`);
      continue;
    }

    let category = "Community";
    if (result.url?.includes("lu.ma")) category = "Meetup";
    else if (result.url?.includes("meetup.com")) category = "Community";
    else if (result.url?.includes("insider.in")) category = "Cultural";

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
      },
    });
    console.log(`  Added: ${title} (${date || "no date"})`);
  }

  const merged = {
    type: "FeatureCollection",
    features: [...filteredStatic, ...exaFeatures],
  };

  writeFileSync(EVENTS_FILE, JSON.stringify(merged, null, 2), "utf-8");
  console.log(
    `\nDone. Wrote ${merged.features.length} events to public/data/events.geojson`,
    `(${filteredStatic.length} static + ${exaFeatures.length} from Exa)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
