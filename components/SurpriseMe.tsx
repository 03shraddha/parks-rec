"use client";

import { useState, useCallback } from "react";

interface SurpriseMeProps {
  /** Called with the park's centre coordinates so the map can fly there */
  onFlyTo: (lng: number, lat: number) => void;
}

// ── Fun one-liners for Bengaluru parks ──────────────────────────────────────
// One is picked at random each time the button is pressed.
const ONE_LINERS: Record<string, string> = {
  "Lalbagh Botanical Gardens":  "Where botanists and Sunday nappers coexist peacefully.",
  "Cubbon Park":                 "130 acres of 'I totally meant to exercise today' energy.",
  "Ulsoor Lake Park":            "Proof that Bengaluru remembers how to be serene.",
  "Sankey Tank":                 "The OG morning-walk circuit before it was cool.",
  "Hesaraghatta Grasslands":    "Where the city ends and the sky decides to stretch.",
  "Turahalli Forest":            "Bengaluru's secret lung - and an excellent excuse to cancel brunch.",
  "Agara Lake":                  "Silicon Valley views, Bengaluru prices, zero traffic.",
  "Bugle Rock Park":             "Ancient boulders judging your screen-time since 3000 BCE.",
  "Freedom Park":                "History in every corner - and chai right outside.",
  "Kadugodi Tree Park":          "East Bengaluru's quiet reward for surviving the Ring Road.",
  "Bannerghatta Biological Park":"Where the lions are better traffic-managed than on Hosur Road.",
  "JP Nagar Park":               "The neighbourhood park that peaked before the apartments did.",
  "Nagarbhavi Park":             "A green island in a concrete archipelago.",
  "Koramangala Lake Park":       "Surviving every real-estate boom since 1990.",
  "GKVK Campus":                 "A working farm that doubles as the city's finest picnic secret.",
  "Mallathahalli Lake":          "Where migratory birds chose Bengaluru over the rest of Karnataka.",
  "Whitefield Lake Park":        "The IT corridor's only legitimate reason to go outside.",
};

// ── Fallback one-liners used when a park has no specific entry ────────────
const FALLBACK_LINERS = [
  "A green patch the city forgot to pave over.",
  "Shade, silence, and zero meetings - what more do you need?",
  "Your steps won't count unless you actually take them.",
  "Bengaluru's answer to 'but where's the nature?'",
  "One bus, two autos, and a good excuse for fresh air.",
];

const VISITED_KEY = "parks-rec-visited";

// ── GeoJSON types (minimal) ──────────────────────────────────────────────
interface ParkFeature {
  type: "Feature";
  geometry: {
    type: string;
    coordinates: unknown;
  };
  properties: {
    name?: string;
    osm_id?: number | string;
  };
}

interface ParksGeoJSON {
  type: "FeatureCollection";
  features: ParkFeature[];
}

// ── Centroid helpers ─────────────────────────────────────────────────────

/** Average of a flat ring of [lng, lat] pairs */
function ringCentroid(ring: number[][]): [number, number] {
  let lngSum = 0;
  let latSum = 0;
  for (const [lng, lat] of ring) {
    lngSum += lng;
    latSum += lat;
  }
  return [lngSum / ring.length, latSum / ring.length];
}

/** Best-effort centroid for Polygon or MultiPolygon geometry */
function geometryCentroid(feature: ParkFeature): [number, number] | null {
  const { type, coordinates } = feature.geometry as {
    type: string;
    coordinates: unknown;
  };

  if (type === "Polygon") {
    // Use the outer ring (index 0)
    const outerRing = (coordinates as number[][][])[0];
    if (!outerRing?.length) return null;
    return ringCentroid(outerRing);
  }

  if (type === "MultiPolygon") {
    // Average centroids across all outer rings
    const polys = coordinates as number[][][][];
    const centroids = polys
      .map((poly) => poly[0])
      .filter(Boolean)
      .map(ringCentroid);
    if (!centroids.length) return null;
    const lng = centroids.reduce((s, c) => s + c[0], 0) / centroids.length;
    const lat = centroids.reduce((s, c) => s + c[1], 0) / centroids.length;
    return [lng, lat];
  }

  return null;
}

/** Unique stable ID for a park feature */
function parkId(f: ParkFeature): string {
  return String(f.properties?.osm_id ?? f.properties?.name ?? "unknown");
}

// ── Component ────────────────────────────────────────────────────────────

export default function SurpriseMe({ onFlyTo }: SurpriseMeProps) {
  const [toast, setToast] = useState<{ name: string; liner: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSurprise = useCallback(async () => {
    if (loading) return;
    setLoading(true);

    try {
      // Fetch the parks GeoJSON (browser will cache after the first call)
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      const res = await fetch(`${basePath}/data/parks.geojson`);
      const data: ParksGeoJSON = await res.json();

      if (!Array.isArray(data?.features)) {
        console.warn("parks.geojson: unexpected format");
        return;
      }

      // Read visited set from localStorage
      let visited: Set<string>;
      try {
        const raw = localStorage.getItem(VISITED_KEY);
        visited = new Set(raw ? (JSON.parse(raw) as string[]) : []);
      } catch (err) {
        console.warn("Could not load visited parks from localStorage:", err);
        visited = new Set();
      }

      // Filter to features that have a valid centroid + haven't been visited
      const candidates = data.features.filter((f) => {
        if (!f.properties?.name) return false;
        if (visited.has(parkId(f))) return false;
        return geometryCentroid(f) !== null;
      });

      // If everything's been visited, reset and try again with the full list
      const pool =
        candidates.length > 0
          ? candidates
          : data.features.filter((f) => f.properties?.name && geometryCentroid(f) !== null);

      if (!pool.length) return; // nothing to show (shouldn't happen)

      // Pick a random park
      const chosen = pool[Math.floor(Math.random() * pool.length)];
      const [lng, lat] = geometryCentroid(chosen)!;
      const name = chosen.properties.name!;

      // One-liner: check the lookup, then pick a random fallback
      const liner =
        ONE_LINERS[name] ??
        FALLBACK_LINERS[Math.floor(Math.random() * FALLBACK_LINERS.length)];

      // Mark as visited
      visited.add(parkId(chosen));
      try {
        localStorage.setItem(VISITED_KEY, JSON.stringify([...visited]));
      } catch {
        // localStorage may be unavailable in some browser contexts - ignore
      }

      // Fly the map
      onFlyTo(lng, lat);

      // Show toast, auto-dismiss after 4 s
      setToast({ name, liner });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setLoading(false);
    }
  }, [loading, onFlyTo]);

  return (
    <>
      {/* ── Button ── */}
      <button
        onClick={handleSurprise}
        disabled={loading}
        className="pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold transition-all duration-200"
        style={{
          background: loading
            ? "var(--bg-card)"
            : "linear-gradient(135deg, #7C3AED, #EC4899)",
          border: "1px solid rgba(167, 139, 250, 0.55)",
          color: loading ? "var(--text-muted)" : "#fff",
          boxShadow: loading ? "none" : "0 0 14px rgba(124,58,237,0.50), 0 4px 16px rgba(0,0,0,0.35)",
          opacity: loading ? 0.7 : 1,
        }}
        onMouseEnter={(e) => {
          if (!loading)
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "0 0 24px rgba(236,72,153,0.60), 0 4px 20px rgba(0,0,0,0.45)";
        }}
        onMouseLeave={(e) => {
          if (!loading)
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "0 0 14px rgba(124,58,237,0.50), 0 4px 16px rgba(0,0,0,0.35)";
        }}
      >
        {/* Spinning indicator while loading */}
        {loading ? (
          <span
            className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent shrink-0"
            style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}
          />
        ) : (
          <span className="shrink-0">✦</span>
        )}
        <span className="font-syne">Surprise Me</span>
      </button>

      {/* ── Toast ── */}
      {toast && (
        <div
          className="pointer-events-none fixed left-1/2 z-50"
          style={{
            bottom: "clamp(8rem, 30dvh, 14rem)",
            transform: "translateX(-50%)",
            animation: "surprise-toast 0.3s cubic-bezier(0.16,1,0.3,1)",
            maxWidth: "calc(100vw - 2rem)",
          }}
        >
          <div
            className="anime-panel rounded-2xl px-5 py-3.5 flex flex-col gap-1 max-w-xs"
            style={{
              border: "1px solid rgba(167, 139, 250, 0.45)",
              boxShadow: "0 0 20px rgba(124,58,237,0.40), 0 8px 32px rgba(0,0,0,0.25)",
              minWidth: "min(220px, calc(100vw - 2rem))",
            }}
          >
            {/* Park name */}
            <p
              className="font-syne font-bold text-sm leading-snug"
              style={{ color: "var(--text-primary)" }}
            >
              {toast.name}
            </p>
            {/* One-liner */}
            <p
              className="text-xs leading-snug"
              style={{ color: "var(--text-secondary)" }}
            >
              {toast.liner}
            </p>
            {/* Thin progress bar that drains over 4 s */}
            <div
              className="mt-1.5 h-0.5 rounded-full overflow-hidden"
              style={{ background: "var(--border-subtle)" }}
            >
              <div
                style={{
                  height: "100%",
                  width: "100%",
                  background: "linear-gradient(90deg, var(--violet), #EC4899)",
                  animation: "toast-drain 4s linear forwards",
                  transformOrigin: "left",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
