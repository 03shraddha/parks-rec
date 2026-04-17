/**
 * MapLibre GL style configuration.
 * Uses MapTiler's "dataviz-dark" style as the cinematic base,
 * then we add custom layers on top with a neon anime palette.
 */

export const BENGALURU_CENTER: [number, number] = [77.5946, 12.9716]; // lng, lat
export const DEFAULT_ZOOM = 12;

/** Base style URLs — requires NEXT_PUBLIC_MAPTILER_KEY in env */
function _key(): string {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (!key) console.warn("NEXT_PUBLIC_MAPTILER_KEY not set — map tiles may not load.");
  return key ?? "";
}

/** Light base: warm dataviz-light matches the Ghibli paper aesthetic */
export function getLightStyleUrl(): string {
  return `https://api.maptiler.com/maps/dataviz-light/style.json?key=${_key()}`;
}

/** Dark base: deep midnight for the neon-anime dark mode */
export function getDarkStyleUrl(): string {
  return `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${_key()}`;
}

/** Convenience — returns the correct URL for the given theme */
export function getBaseStyleUrl(theme: "light" | "dark" = "light"): string {
  return theme === "dark" ? getDarkStyleUrl() : getLightStyleUrl();
}

/**
 * Anime-inspired colour palette.
 * All colours are designed to glow and pop against the dark base map.
 */
export const COLORS = {
  // Tree canopy — bioluminescent jade gradient stops
  treeLow:  "#1DE9B6", // cyan-jade (low density)
  treeHigh: "#00695C", // deep forest teal (high density)

  // Parks — glowing green
  parkFill:   "rgba(16, 185, 129, 0.22)",
  parkStroke: "#34D399",

  // Lakes / waterbodies — electric cyan
  lakeFill:   "rgba(6, 182, 212, 0.25)",
  lakeStroke: "#67E8F9",

  // Bus stops — violet nodes
  busStop: "#A78BFA",

  // Cool route — neon jade (Spirited Away forest trail)
  coolRoute: "#10B981",

  // Fast route — warm amber gold (lantern glow)
  fastRoute: "#F59E0B",

  // Route casing / outline
  routeOutline: "rgba(6, 10, 24, 0.90)",

  // Segment highlight on tap
  segmentHighlight: "#E879F9", // pink-violet pulse

  // Trails / walking paths — light dashed green, distinct from route lines
  trailLine: "#86EFAC", // pastel green, lighter than coolRoute (#10B981)

  // Events — hot pink pins
  eventPin:       "#F472B6",
  eventPinBorder: "#fff",
} as const;

/** Layer IDs used throughout the app */
export const LAYER_IDS = {
  lakesFill:       "lakes-fill",
  lakesStroke:     "lakes-stroke",
  parksFill:       "parks-fill",
  parksStroke:     "parks-stroke",
  treeDensity:     "tree-density-hex",
  busStops:        "bus-stops",
  routeFast:       "route-fast",
  routeFastCasing: "route-fast-casing",
  routeCool:       "route-cool",
  routeCoolCasing: "route-cool-casing",
  segmentHL:       "segment-highlight",
  pinOrigin:       "pin-origin",
  pinDest:         "pin-dest",
  trails:          "trails",
  events:          "events",
} as const;

/** Source IDs */
export const SOURCE_IDS = {
  lakes:     "lakes",
  parks:     "parks",
  trees:     "trees",
  busStops:  "bus-stops",
  routeFast: "route-fast",
  routeCool: "route-cool",
  pins:      "pins",
  trails:    "trails",
  events:    "events",
} as const;
