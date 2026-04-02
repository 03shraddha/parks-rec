# Walk the City Without Melting · Bengaluru

Google Maps shows you the fastest route. This shows you the **shadiest** one.

Drop two pins, get two routes side-by-side — one fast, one cool. Every segment is scored against real tree canopy data so you can actually see where you'll be baking vs. walking under leaves.

---

## What makes it different

| Every other map app | This app |
|---|---|
| Fastest route only | Fastest *and* shadiest, side-by-side |
| No tree data | Shade % scored from real canopy data |
| Static tiles | Toggle trees, parks, lakes, heat map live |
| No personality | Witty park descriptions + Surprise Me button |

---

## Features

- **🌿 Cool Route** — walks you through the most tree-covered streets
- **⚡ Fast Route** — gets you there quickest
- **Tap any segment** — see exact shade %, tree count, species, nearest park
- **Layer toggles** — Tree Canopy, Parks, Waterbodies, Heat Map, Bus Stops, Trails, Events
- **Surprise Me** — flies you to a random unvisited park with a one-liner
- **Live events** — outdoor events in Bengaluru pulled from Google (server mode only)
- **Light / Dark theme** — Ghibli watercolour paper vs. midnight neon

---

## Tech stack

| What | Tool |
|---|---|
| Framework | Next.js 16 (App Router) |
| Map | MapLibre GL + MapTiler tiles |
| Routing | GraphHopper API |
| Shade scoring | Custom algorithm on pre-computed `roads-shaded.geojson` |
| Events | SerpApi → geocoded via MapTiler |
| Styling | Tailwind CSS v4 |

---

## Environment variables

```env
NEXT_PUBLIC_MAPTILER_KEY=           # Map tiles (required everywhere)
NEXT_PUBLIC_GRAPHHOPPER_API_KEY=    # Routing — client-side (GitHub Pages / static)
GRAPHHOPPER_API_KEY=                # Routing — server-side (Vercel / self-hosted)
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

**GitHub Pages (static)** — routing works, events layer is disabled (no server).
Push to `master` — the included GitHub Actions workflow builds and deploys automatically.
Add `NEXT_PUBLIC_MAPTILER_KEY` and `NEXT_PUBLIC_GRAPHHOPPER_API_KEY` as repository secrets.

**Vercel (recommended)** — all features including live events.
Connect the repo at vercel.com, add all four env vars, done.
