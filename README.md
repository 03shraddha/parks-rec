# Walk the City Without Melting · Bengaluru

An interactive map that helps you find the **coolest, shadiest walking routes** in Bengaluru — because sometimes the shortest path is also the hottest one.

Drop two pins on the map and the app shows you two routes side-by-side:

- 🌿 **Cool Route** — maximises shade from trees, parks, and waterbodies
- ⚡ **Fast Route** — gets you there quickest

Tap any segment on a route to see exactly how many trees are nearby, which species dominate the canopy, and the nearest park.

---

## Tech Overview

| Layer | What it does |
|---|---|
| **Next.js 16** (App Router) | Framework — SSR for the API, client-only for the map |
| **MapLibre GL** | Renders the interactive map in the browser |
| **MapTiler** | Provides the dark base map tiles |
| **GraphHopper** | Walking route engine — returns up to 3 alternative paths |
| **Shade scoring** | Custom algorithm that samples each route against a pre-computed `roads-shaded.geojson` to calculate a weighted shade percentage |
| **Tailwind CSS v4** | Utility styling |
| **Vercel KV** | Optional server-side route caching |

### Data files (`public/data/`)

| File | Description |
|---|---|
| `roads-shaded.geojson` | Every road segment pre-scored with tree count, dominant species, and nearest park |
| `tree-density.geojson` | Hexbin aggregates of tree canopy coverage |
| `parks.geojson` | Park boundaries |
| `lakes.geojson` | Water body polygons |
| `bus-stops.geojson` | BMTC bus stop locations |

### API

`POST /api/route` — accepts `{ origin, destination }` coordinates, returns `{ fastRoute, coolRoute }` each with distance, walk time, shade percentage, and per-segment info.

### Environment variables

```
NEXT_PUBLIC_MAPTILER_KEY=   # MapTiler API key for map tiles
GRAPHHOPPER_URL=            # GraphHopper routing API endpoint
```

### Running locally

```bash
npm install
npm run dev
```
