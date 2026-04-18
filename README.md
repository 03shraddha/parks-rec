# Walk the City Without Melting - Bengaluru

Google Maps shows you the fastest route. This shows you the **shadiest** one.

Drop two pins, get two routes side by side - one fast, one cool. Every segment is scored against real tree canopy data so you can actually see where you'll be baking vs. walking under leaves. Feels like navigating an anime movie.

---

## What makes it different

| Every other map app | This app |
|---|---|
| Fastest route only | Fastest and shadiest, side by side |
| No tree data | Shade % scored from real canopy data |
| Static tiles | Toggle trees, parks, lakes, bus stops, trails, events live |
| No personality | Witty park descriptions + Surprise Me button |
| No navigation | Turn-by-turn walking directions with live position tracking |

---

## Features

- **Cool Route** - walks you through the most tree-covered streets
- **Fast Route** - gets you there quickest
- **Tap any segment** - see exact shade %, tree count, species, nearest park
- **Layer toggles** - Tree Canopy, Parks, Waterbodies, Bus Stops, Trails, Events
- **Heat Map legend** - floating colour scale (Scorching to Cool); tap any hexbin to see tree count and shade tier
- **Trails** - toggle on to auto-zoom to all 8 Bangalore walking trails; tap a trail for name, surface and distance
- **Events side panel** - 35+ curated free and low-cost Bengaluru events (Sunday Soul Santhe, Cubbon Park bird walks, open mics, heritage walks, farmers markets and more); each event has category, venue, time, a Learn More link, and a Get Directions button
- **Turn-by-turn navigation** - tap Start Navigation on any route for step-by-step directions with live GPS tracking, compass heading, and auto-advance when you reach each waypoint
- **Location search** - restricted to Bangalore; type any address or apartment name for relevant results
- **Surprise Me** - flies you to a random unvisited park with a one-liner
- **Live events** - outdoor events pulled from Google (server mode only; falls back to curated static data on GitHub Pages)
- **Light / Dark theme** - Ghibli watercolour paper vs. midnight neon

---

## Where does the data come from?

| Feature | Data Source | Limitations |
|---|---|---|
| Map tiles (base map) | MapTiler (dataviz-light / dataviz-dark styles) | Requires a MapTiler API key; tile quota applies on the free plan |
| Parks | OpenStreetMap via pre-exported GeoJSON (`parks.geojson`) | Snapshot in time - new parks won't show until the file is re-exported |
| Waterbodies / Lakes | OpenStreetMap via pre-exported GeoJSON (`lakes.geojson`) | Same as parks - static snapshot, lake boundaries may not reflect recent changes |
| Tree canopy density | Pre-computed hexbin grid (`tree-density.geojson`) derived from OSM tree data | Sparse in areas with poor OSM coverage; does not reflect recent planting or felling |
| Bus stops | OpenStreetMap via pre-exported GeoJSON (`bus-stops.geojson`) | Only covers stops that volunteers have mapped in OSM; BMTC route numbers may be outdated |
| Walking trails | OpenStreetMap via pre-exported GeoJSON (`trails.geojson`) | Limited to 8 curated trails; informal paths not in OSM are missing |
| Road shade scoring | Pre-computed GeoJSON (`roads-shaded.geojson`) overlaying OSM roads with tree density | Pre-computed offline so shade scores do not update in real time |
| Routing and turn-by-turn directions | GraphHopper API (walking mode, alternative routes) | Free tier has a daily request cap; routing quality depends on OSM road data |
| Location search | MapTiler Geocoding API (biased toward Bengaluru) | Accuracy drops for very new buildings or informal locality names |
| Events (live, server mode) | SerpAPI Google Events engine, venue addresses geocoded via MapTiler | Requires a SerpAPI key and a server (not available on GitHub Pages); results depend on what Google indexes |
| Events (static, GitHub Pages) | Curated `events.geojson` with 35+ free and low-cost Bengaluru events | Manually maintained - new events won't appear until the file is updated |

---

## Tech stack

| What | Tool |
|---|---|
| Framework | Next.js (App Router) |
| Map | MapLibre GL + MapTiler tiles |
| Routing | GraphHopper API |
| Shade scoring | Custom algorithm on pre-computed `roads-shaded.geojson` |
| Events (server) | SerpAPI + MapTiler Geocoding |
| Styling | Tailwind CSS v4 |
| Fonts | Zen Kaku Gothic New (display), M PLUS Rounded 1c (body), Space Mono (badges) |

---

## Environment variables

```env
NEXT_PUBLIC_MAPTILER_KEY=           # Map tiles and geocoding (required everywhere)
NEXT_PUBLIC_GRAPHHOPPER_API_KEY=    # Routing - client-side (GitHub Pages / static)
GRAPHHOPPER_API_KEY=                # Routing - server-side (Vercel / self-hosted)
SERPAPI_KEY=                        # Live outdoor events (server-side only)
```

---

## Run locally

```bash
npm install
npm run dev
```

---

## Deploy

**GitHub Pages (static)** - routing and turn-by-turn navigation work; live events fall back to the curated static list.
Push to `master` and the included GitHub Actions workflow builds and deploys automatically.
Add `NEXT_PUBLIC_MAPTILER_KEY` and `NEXT_PUBLIC_GRAPHHOPPER_API_KEY` as repository secrets.

**Vercel (recommended)** - all features including live events.
Connect the repo at vercel.com, add all four env vars, done.
