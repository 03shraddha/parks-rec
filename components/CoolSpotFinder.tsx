"use client";

import { useState } from "react";

interface Suggestion {
  name: string;
  lng: number;
  lat: number;
  walkMins: number;
}

interface CoolSpotFinderProps {
  onSelectDestination: (lng: number, lat: number) => void;
}

function ringCentroid(coords: number[][]): [number, number] {
  let sumLng = 0, sumLat = 0;
  for (const [lng, lat] of coords) { sumLng += lng; sumLat += lat; }
  return [sumLng / coords.length, sumLat / coords.length];
}

function haversineDist(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

export default function CoolSpotFinder({ onSelectDestination }: CoolSpotFinderProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);

  const handleFind = () => {
    if (open) { setOpen(false); return; }
    if (!navigator.geolocation) { setError("Geolocation not supported."); return; }
    setLoading(true);
    setError(null);
    setSuggestions([]);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        try {
          const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
          const res = await fetch(`${basePath}/data/parks.geojson`);
          const fc = await res.json();

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const features: any[] = fc.features ?? [];
          const ranked: Suggestion[] = features
            .filter((f) => f.properties?.name)
            .map((f) => {
              let centroid: [number, number];
              const geo = f.geometry;
              if (geo.type === "Polygon") {
                centroid = ringCentroid(geo.coordinates[0]);
              } else if (geo.type === "MultiPolygon") {
                centroid = ringCentroid(geo.coordinates[0][0]);
              } else {
                return null;
              }
              const dist = haversineDist(userLat, userLng, centroid[1], centroid[0]);
              return {
                name: f.properties.name as string,
                lng: centroid[0],
                lat: centroid[1],
                walkMins: Math.max(1, Math.round(dist / 80)),
              };
            })
            .filter((s): s is Suggestion => s !== null)
            .sort((a, b) => a.walkMins - b.walkMins)
            .slice(0, 3);

          setSuggestions(ranked);
          setOpen(true);
        } catch {
          setError("Could not load parks data.");
        }
        setLoading(false);
      },
      () => { setError("Location access denied."); setLoading(false); },
      { timeout: 8000 }
    );
  };

  return (
    <div className="relative pointer-events-auto flex flex-col gap-1.5">
      <button
        onClick={handleFind}
        disabled={loading}
        className="flex items-center gap-2.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-all duration-200"
        style={
          open
            ? {
                background: "linear-gradient(135deg, var(--jade), #059669)",
                border: "1px solid rgba(52,211,153,0.60)",
                color: "#fff",
                boxShadow: "0 0 14px var(--jade-glow), 0 4px 16px rgba(0,0,0,0.4)",
              }
            : {
                background: "var(--bg-card)",
                backdropFilter: "blur(16px)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
              }
        }
      >
        <span
          className="text-sm leading-none w-5 h-5 flex items-center justify-center rounded-md shrink-0"
          style={{ background: open ? "rgba(255,255,255,0.20)" : "var(--border-subtle)" }}
        >
          {loading ? (
            <span
              className="w-3 h-3 rounded-full border-2 border-current border-t-transparent"
              style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}
            />
          ) : "🌿"}
        </span>
        <span className="font-grotesk">Take me somewhere cool</span>
      </button>

      {error && (
        <p className="text-[10px] px-1" style={{ color: "#F87171" }}>{error}</p>
      )}

      {open && suggestions.length > 0 && (
        <div
          className="flex flex-col rounded-2xl overflow-hidden"
          style={{
            background: "var(--bg-card)",
            backdropFilter: "blur(16px) saturate(180%)",
            border: "1px solid var(--border-jade)",
            boxShadow: "0 0 14px var(--jade-glow), 0 8px 24px rgba(0,0,0,0.4)",
            animation: "slide-up 0.2s ease-out",
          }}
        >
          <p
            className="font-mono-ui uppercase tracking-[0.14em] px-3.5 pt-2.5 pb-1"
            style={{ fontSize: "9px", color: "var(--text-disabled)" }}
          >
            ✦ Nearest green spots
          </p>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => { setOpen(false); onSelectDestination(s.lng, s.lat); }}
              className="flex items-center justify-between px-3.5 py-2.5 text-xs text-left transition-colors duration-100"
              style={{ borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-surface)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <span className="font-grotesk font-semibold" style={{ color: "var(--text-primary)" }}>
                🌿 {s.name}
              </span>
              <span
                className="font-mono-ui uppercase tracking-[0.10em] shrink-0 ml-2"
                style={{ fontSize: "9px", color: "var(--text-disabled)" }}
              >
                ~{s.walkMins} min
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
