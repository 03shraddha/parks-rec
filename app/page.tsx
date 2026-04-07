"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useRef, useEffect } from "react";
import LayerControls from "@/components/LayerControls";
import SurpriseMe from "@/components/SurpriseMe";
import RoutePanel from "@/components/RoutePanel";
import SegmentPopup from "@/components/SegmentPopup";
import EventPopup from "@/components/EventPopup";
import HeatmapLegend from "@/components/HeatmapLegend";
import HeatmapPopup from "@/components/HeatmapPopup";
import TrailPopup from "@/components/TrailPopup";
import EventsPanel from "@/components/EventsPanel";
import type { LayerVisibility, PinMode, Theme, MapHandle, EventInfo, HeatmapInfo, TrailInfo, EventFeature } from "@/components/Map";
import type { ScoredRoute, SegmentInfo } from "@/lib/shadeScoring";
import { scoreRoute, pickRoutes } from "@/lib/shadeScoring";
import type { Coordinate } from "@/lib/graphhopper";
import { fetchRoutes } from "@/lib/graphhopper";

// Cache roads-shaded.geojson after the first fetch — it's ~several MB and never changes at runtime
let roadsCache: unknown[] | null = null;
async function loadRoads(): Promise<unknown[]> {
  if (roadsCache) return roadsCache;
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const res = await fetch(`${basePath}/data/roads-shaded.geojson`);
  if (!res.ok) throw new Error(`Failed to load shade data (${res.status})`);
  const fc = await res.json();
  const features: unknown[] = fc.features ?? [];
  roadsCache = features;
  return features;
}

// MapLibre uses browser APIs — must be client-only
const Map = dynamic(() => import("@/components/Map"), { ssr: false });

export default function HomePage() {
  // ── Map imperative handle (for flyTo) ────────────────────────────────────
  const mapHandleRef = useRef<MapHandle>(null);

  // ── Theme ────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<Theme>("light");

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      return next;
    });
  }, []);

  // ── Map interaction state ────────────────────────────────────────────────
  const [pinMode, setPinMode] = useState<PinMode>(null);
  const [origin, setOrigin] = useState<Coordinate | null>(null);
  const [destination, setDestination] = useState<Coordinate | null>(null);

  // ── Layer visibility ─────────────────────────────────────────────────────
  const [visibleLayers, setVisibleLayers] = useState<LayerVisibility>({
    trees: false,
    parks: false,
    lakes: false,
    heat: false,
    busStops: false,
    trails: false,
    events: false,
  });

  // ── Route state ──────────────────────────────────────────────────────────
  const [fastRoute, setFastRoute] = useState<ScoredRoute | null>(null);
  const [coolRoute, setCoolRoute] = useState<ScoredRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  // ── Segment popup ────────────────────────────────────────────────────────
  const [segmentInfo, setSegmentInfo] = useState<SegmentInfo | null>(null);

  // ── Event popup ──────────────────────────────────────────────────────────
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);

  // ── Heatmap popup ─────────────────────────────────────────────────────────
  const [heatmapInfo, setHeatmapInfo] = useState<HeatmapInfo | null>(null);

  // ── Trail popup ───────────────────────────────────────────────────────────
  const [trailInfo, setTrailInfo] = useState<TrailInfo | null>(null);

  // ── Events panel list ─────────────────────────────────────────────────────
  const [eventsList, setEventsList] = useState<EventFeature[]>([]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const fetchRoute = useCallback(
    async (orig: Coordinate, dest: Coordinate) => {
      setRouteLoading(true);
      setRouteError(null);
      setFastRoute(null);
      setCoolRoute(null);
      setSegmentInfo(null);

      try {
        // Fetch up to 3 alternative routes directly from GraphHopper (client-side)
        const paths = await fetchRoutes(orig, dest, 3);
        if (!paths.length) throw new Error("No route found between these points.");

        // Load shade data (cached after first fetch) and score each route
        const roads = await loadRoads();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const scored = paths.map((p) => scoreRoute(p, roads as any));
        const { fastRoute: fast, coolRoute: cool } = pickRoutes(scored);
        setFastRoute(fast);
        setCoolRoute(cool);
      } catch (err) {
        setRouteError(err instanceof Error ? err.message : "Could not find a route.");
      } finally {
        setRouteLoading(false);
      }
    },
    []
  );

  const handlePinDrop = useCallback(
    async (mode: "origin" | "destination", coord: Coordinate) => {
      setPinMode(null);

      let nextOrigin = origin;
      let nextDest = destination;

      if (mode === "origin") {
        setOrigin(coord);
        nextOrigin = coord;
      } else {
        setDestination(coord);
        nextDest = coord;
      }

      if (nextOrigin && nextDest) {
        await fetchRoute(nextOrigin, nextDest);
      }
    },
    [origin, destination, fetchRoute]
  );

  const toggleLayer = useCallback((key: keyof LayerVisibility) => {
    setVisibleLayers((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Clear events list when events layer is turned off
      if (key === "events" && prev.events) setEventsList([]);
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setOrigin(null);
    setDestination(null);
    setFastRoute(null);
    setCoolRoute(null);
    setRouteError(null);
    setSegmentInfo(null);
    setPinMode(null);
  }, []);

  // ── UI ───────────────────────────────────────────────────────────────────
  return (
    <main className="relative w-screen h-screen overflow-hidden" style={{ background: "var(--bg-deep)" }}>
      {/* Full-screen map */}
      <Map
        ref={mapHandleRef}
        pinMode={pinMode}
        origin={origin}
        destination={destination}
        fastRoute={fastRoute}
        coolRoute={coolRoute}
        visibleLayers={visibleLayers}
        theme={theme}
        onPinDrop={handlePinDrop}
        onSegmentClick={setSegmentInfo}
        onEventClick={setEventInfo}
        onHeatmapClick={setHeatmapInfo}
        onTrailClick={setTrailInfo}
        onEventsLoaded={setEventsList}
      />

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-4 pointer-events-none z-10">
        {/* Brand */}
        <div
          className="pointer-events-auto anime-panel glow-violet rounded-2xl px-4 py-2.5 flex items-center gap-3"
          style={{ minWidth: 0 }}
        >
          {/* Animated nature icon */}
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-lg"
            style={{
              background: "linear-gradient(135deg, var(--jade), var(--cyan))",
              boxShadow: "0 0 12px var(--jade-glow)",
            }}
          >
            🌿
          </div>
          <div>
            {/* PRIMARY — the one thing seen first in this panel */}
            <p
              className="font-grotesk font-bold leading-tight text-base"
              style={{ color: "var(--text-display)" }}
            >
              Walk the City
            </p>
            {/* TERTIARY — Space Mono ALL CAPS, pushed visually to background */}
            <p
              className="font-mono-ui leading-tight"
              style={{
                fontSize: "9px",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--text-disabled)",
              }}
            >
              Without melting · Bengaluru
            </p>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle light/dark mode"
            className="pointer-events-auto w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all duration-200"
            style={{
              background: "var(--bg-card)",
              backdropFilter: "blur(16px)",
              border: "1px solid var(--border-violet)",
              color: "var(--violet-light)",
              boxShadow: "0 0 10px var(--violet-glow)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "rgba(109, 40, 217, 0.18)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-card)";
            }}
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>

          {/* Reset button */}
          {(origin || destination) && (
          <button
            onClick={handleReset}
            className="pointer-events-auto font-grotesk text-xs font-semibold px-4 py-2 rounded-xl transition-all duration-200"
            style={{
              background: "rgba(124, 58, 237, 0.15)",
              border: "1px solid var(--border-violet)",
              color: "var(--violet-light)",
              backdropFilter: "blur(16px)",
              boxShadow: "0 0 10px var(--violet-glow)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(124, 58, 237, 0.30)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(124, 58, 237, 0.15)";
            }}
          >
            ↺ Reset
          </button>
          )}
        </div>
      </header>

      {/* ── Bottom layout ─────────────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 flex flex-col md:flex-row items-end justify-between p-4 gap-3 pointer-events-none z-10">

        {/* Layer controls + Surprise Me — bottom left */}
        <div className="w-full md:w-auto flex flex-col gap-2">
          {visibleLayers.heat && <HeatmapLegend />}
          <LayerControls visible={visibleLayers} onChange={toggleLayer} />
          <SurpriseMe
            onFlyTo={(lng, lat) => mapHandleRef.current?.flyTo(lng, lat)}
          />
        </div>

        {/* Pin controls + route panel — bottom right */}
        <div className="w-full md:w-72 flex flex-col gap-3">
          <PinControls
            origin={origin}
            destination={destination}
            pinMode={pinMode}
            onSetMode={setPinMode}
            onFetchRoute={fetchRoute}
            onPinDrop={handlePinDrop}
          />
          <RoutePanel
            fastRoute={fastRoute}
            coolRoute={coolRoute}
            loading={routeLoading}
            error={routeError}
          />
        </div>
      </div>

      {/* ── Segment popup ─────────────────────────────────────────────────── */}
      {segmentInfo && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:top-20 md:right-4 z-20">
          <SegmentPopup info={segmentInfo} onClose={() => setSegmentInfo(null)} />
        </div>
      )}

      {/* ── Event popup ───────────────────────────────────────────────────── */}
      {eventInfo && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:top-20 md:right-4 z-20">
          <EventPopup info={eventInfo} onClose={() => setEventInfo(null)} />
        </div>
      )}

      {/* ── Events side panel — shows when events layer is active ─────────── */}
      {visibleLayers.events && eventsList.length > 0 && !eventInfo && (
        <div className="absolute top-20 right-4 z-20 pointer-events-none">
          <EventsPanel
            events={eventsList}
            onEventSelect={(lng, lat, info) => {
              mapHandleRef.current?.flyTo(lng, lat, 15);
              setEventInfo(info);
            }}
            onClose={() => {
              setEventsList([]);
              toggleLayer("events");
            }}
          />
        </div>
      )}

      {/* ── Heatmap popup ─────────────────────────────────────────────────── */}
      {heatmapInfo && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:bottom-40 md:left-4 md:translate-x-0 z-20">
          <HeatmapPopup info={heatmapInfo} onClose={() => setHeatmapInfo(null)} />
        </div>
      )}

      {/* ── Trail popup ───────────────────────────────────────────────────── */}
      {trailInfo && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:bottom-40 md:left-4 md:translate-x-0 z-20">
          <TrailPopup info={trailInfo} onClose={() => setTrailInfo(null)} />
        </div>
      )}

      {/* ── Pin-drop instruction banner ───────────────────────────────────── */}
      {pinMode && (
        <div
          className="absolute top-20 left-1/2 pointer-events-none z-20"
          style={{ animation: "banner-float 2.4s ease-in-out infinite" }}
        >
          <div
            className="font-grotesk text-sm font-semibold px-5 py-2.5 rounded-full whitespace-nowrap"
            style={{
              background: "linear-gradient(135deg, rgba(124,58,237,0.90), rgba(236,72,153,0.80))",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(167, 139, 250, 0.4)",
              color: "#fff",
              boxShadow: "0 0 20px var(--violet-glow), 0 8px 32px rgba(0,0,0,0.5)",
              letterSpacing: "0.02em",
            }}
          >
            {pinMode === "origin"
              ? "✦ Tap the map to set your start"
              : "✦ Tap the map to set your destination"}
          </div>
        </div>
      )}
    </main>
  );
}

// ── Geocoding result type ──────────────────────────────────────────────────
interface GeoFeature {
  place_name: string;
  center: [number, number]; // [lng, lat]
}

// ── Pin Controls Component ─────────────────────────────────────────────────
function PinControls({
  origin,
  destination,
  pinMode,
  onSetMode,
  onFetchRoute,
  onPinDrop,
}: {
  origin: Coordinate | null;
  destination: Coordinate | null;
  pinMode: PinMode;
  onSetMode: (m: PinMode) => void;
  onFetchRoute: (o: Coordinate, d: Coordinate) => void;
  onPinDrop: (mode: "origin" | "destination", coord: Coordinate) => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeoFeature[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input when a pin mode becomes active
  useEffect(() => {
    if (pinMode) {
      setQuery("");
      setSuggestions([]);
      setGeoError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [pinMode]);

  // Debounced geocoding search via MapTiler
  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSuggestions([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) return;

    debounceRef.current = setTimeout(async () => {
      try {
        const key = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "";
        const encoded = encodeURIComponent(value.trim());
        // Restrict results to Bangalore bounding box + India only
        const url = `https://api.maptiler.com/geocoding/${encoded}.json?key=${key}&proximity=77.5946,12.9716&bbox=77.30,12.70,77.85,13.15&country=IN&language=en&limit=5`;
        const res = await fetch(url);
        const data = await res.json();
        setSuggestions(data.features ?? []);
      } catch {
        // silently ignore network errors on geocoding
      }
    }, 350);
  };

  const handleSelectSuggestion = (feature: GeoFeature) => {
    if (!pinMode) return;
    const [lng, lat] = feature.center;
    onPinDrop(pinMode, { lng, lat });
    setQuery("");
    setSuggestions([]);
  };

  const handleGPS = () => {
    if (!pinMode || !navigator.geolocation) return;
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onPinDrop(pinMode, { lng: pos.coords.longitude, lat: pos.coords.latitude });
        setGeoLoading(false);
      },
      () => {
        setGeoError("Could not get your location.");
        setGeoLoading(false);
      },
      { timeout: 8000 }
    );
  };

  const pinColor = (mode: "origin" | "destination") =>
    mode === "origin"
      ? { active: "linear-gradient(135deg, var(--jade), #059669)", glow: "var(--jade-glow)", border: "var(--border-jade)", setColor: "rgba(4,120,87,0.12)", textColor: "var(--jade-light)" }
      : { active: "linear-gradient(135deg, var(--amber), #D97706)", glow: "var(--amber-glow)", border: "var(--border-amber)", setColor: "rgba(180,83,9,0.12)", textColor: "var(--amber-light)" };

  const renderPinBtn = (mode: "origin" | "destination", coord: Coordinate | null) => {
    const label = mode === "origin" ? "A" : "B";
    const isActive = pinMode === mode;
    const isSet = !!coord;
    const c = pinColor(mode);
    return (
      <button
        key={mode}
        onClick={() => onSetMode(isActive ? null : mode)}
        className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200"
        style={
          isActive
            ? { background: c.active, border: `1px solid transparent`, color: "#fff", boxShadow: `0 0 14px ${c.glow}` }
            : isSet
            ? { background: c.setColor, border: `1px solid ${c.border}`, color: c.textColor }
            : { background: "var(--border-subtle)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }
        }
      >
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
          style={{
            background: isSet || isActive ? c.active : "var(--text-muted)",
            boxShadow: isSet || isActive ? `0 0 8px ${c.glow}` : "none",
          }}
        >
          {label}
        </span>
        {isSet ? (mode === "origin" ? "Start set" : "End set") : (mode === "origin" ? "Set start" : "Set end")}
      </button>
    );
  };

  const activeColor = pinMode ? pinColor(pinMode) : null;

  return (
    <div className="pointer-events-auto anime-panel glow-violet rounded-2xl p-3 flex flex-col gap-2.5">
      {/* Label — TERTIARY: Space Mono ALL CAPS, pushed to edge of importance */}
      <p className="font-mono-ui text-[10px] uppercase tracking-[0.15em]" style={{ color: "var(--text-disabled)" }}>
        ✦ Set your route
      </p>

      {/* Pin buttons */}
      <div className="flex gap-2">
        {renderPinBtn("origin", origin)}
        {renderPinBtn("destination", destination)}
      </div>

      {/* Expanded search panel — shown when a pin mode is active */}
      {pinMode && activeColor && (
        <div className="flex flex-col gap-2" style={{ animation: "slide-up 0.2s ease-out" }}>
          {/* Divider */}
          <div style={{ borderTop: "1px solid var(--border-subtle)" }} />

          {/* Search input */}
          <div className="relative">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{
                background: "var(--bg-surface)",
                border: `1px solid ${activeColor.border}`,
                boxShadow: `0 0 8px ${activeColor.glow}`,
              }}
            >
              {/* Search icon */}
              <svg className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder={pinMode === "origin" ? "Search start address…" : "Search destination…"}
                className="flex-1 bg-transparent text-xs outline-none min-w-0"
                style={{ color: "var(--text-primary)" }}
              />
              {query && (
                <button onClick={() => { setQuery(""); setSuggestions([]); }} style={{ color: "var(--text-muted)" }}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              )}
            </div>

            {/* Suggestions dropdown */}
            {suggestions.length > 0 && (
              <div
                className="absolute bottom-full left-0 right-0 mb-1 rounded-xl overflow-hidden z-30"
                style={{
                  background: "var(--bg-surface)",
                  border: `1px solid ${activeColor.border}`,
                  boxShadow: `0 0 16px ${activeColor.glow}, 0 8px 24px rgba(0,0,0,0.15)`,
                  animation: "slide-up 0.15s ease-out",
                }}
              >
                {suggestions.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectSuggestion(f)}
                    className="w-full text-left px-3 py-2.5 flex items-start gap-2 transition-colors duration-100"
                    style={{ borderBottom: i < suggestions.length - 1 ? "1px solid var(--border-subtle)" : "none" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-deep)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <svg className="w-3 h-3 mt-0.5 shrink-0" style={{ color: activeColor.textColor }} fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </svg>
                    <span className="text-xs leading-snug" style={{ color: "var(--text-primary)" }}>
                      {f.place_name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* GPS button */}
          <button
            onClick={handleGPS}
            disabled={geoLoading}
            className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-semibold transition-all duration-200"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-secondary)",
              opacity: geoLoading ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!geoLoading) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = activeColor.border;
                (e.currentTarget as HTMLButtonElement).style.color = activeColor.textColor;
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-subtle)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
            }}
          >
            {geoLoading ? (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent" style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }} />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /><path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" opacity="0" />
              </svg>
            )}
            {geoLoading ? "Getting location…" : "Use my current location"}
          </button>

          {geoError && (
            <p className="text-[10px] text-center" style={{ color: "#F87171" }}>{geoError}</p>
          )}

          {/* Tap-on-map hint — TERTIARY */}
          <p className="font-mono-ui text-[9px] text-center uppercase tracking-[0.10em]" style={{ color: "var(--text-disabled)" }}>
            — or tap anywhere on the map —
          </p>
        </div>
      )}

      {/* Refetch button — only when both pins are set */}
      {origin && destination && (
        <button
          onClick={() => onFetchRoute(origin, destination)}
          className="w-full py-2.5 rounded-xl font-grotesk text-sm font-bold transition-all duration-200"
          style={{
            background: "linear-gradient(135deg, var(--violet), #6D28D9)",
            color: "#fff",
            border: "1px solid rgba(167, 139, 250, 0.4)",
            boxShadow: "0 0 16px var(--violet-glow), 0 4px 16px rgba(0,0,0,0.4)",
            letterSpacing: "0.03em",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 28px var(--violet-glow), 0 4px 24px rgba(0,0,0,0.5)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 16px var(--violet-glow), 0 4px 16px rgba(0,0,0,0.4)";
          }}
        >
          ✦ Find Cool Routes
        </button>
      )}
    </div>
  );
}
