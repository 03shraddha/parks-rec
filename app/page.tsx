"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import SegmentPopup from "@/components/SegmentPopup";
import EventPopup from "@/components/EventPopup";
import TrailPopup from "@/components/TrailPopup";
import EventsPanel from "@/components/EventsPanel";
import OnboardingOverlay from "@/components/OnboardingOverlay";
import ParkPanel from "@/components/ParkPanel";
import NavigationPanel from "@/components/NavigationPanel";
import type { LayerVisibility, PinMode, Theme, MapHandle, EventInfo, TrailInfo, EventFeature } from "@/components/Map";
import type { ParkInfo } from "@/components/ParkPanel";
import type { ScoredRoute, SegmentInfo } from "@/lib/shadeScoring";
import { scoreRoute, pickRoutes } from "@/lib/shadeScoring";
import type { Coordinate } from "@/lib/graphhopper";
import { fetchRoutes } from "@/lib/graphhopper";

// Cache roads-shaded.geojson after the first fetch - it's ~several MB and never changes at runtime
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

// MapLibre uses browser APIs - must be client-only
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

  // ── UI mode: idle = layer pills + search bar, planning = From/To inputs ────
  const [uiMode, setUiMode] = useState<"idle" | "planning">("idle");

  // ── Navigation mode ───────────────────────────────────────────────────────
  const [activeNavRoute, setActiveNavRoute] = useState<{ route: ScoredRoute; type: "cool" | "fast" } | null>(null);

  // ── Map interaction state ────────────────────────────────────────────────
  const [pinMode, setPinMode] = useState<PinMode>(null);
  const [origin, setOrigin] = useState<Coordinate | null>(null);
  const [destination, setDestination] = useState<Coordinate | null>(null);
  const [originLabel, setOriginLabel] = useState("");
  const [destLabel, setDestLabel] = useState("");

  // ── Layer visibility ─────────────────────────────────────────────────────
  const [visibleLayers, setVisibleLayers] = useState<LayerVisibility>({
    trees: false,
    parks: false,
    lakes: false,
    busStops: false,
    trails: false,
    events: false,
  });

  // ── Route state ──────────────────────────────────────────────────────────
  const [fastRoute, setFastRoute] = useState<ScoredRoute | null>(null);
  const [coolRoute, setCoolRoute] = useState<ScoredRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  // ── Route coords for "Along route" event highlighting ────────────────────
  const routeCoords = useMemo<[number, number][] | null>(() => {
    const r = coolRoute ?? fastRoute;
    if (!r) return null;
    return r.points.coordinates;
  }, [coolRoute, fastRoute]);

  // ── Segment popup ────────────────────────────────────────────────────────
  const [segmentInfo, setSegmentInfo] = useState<SegmentInfo | null>(null);

  // ── Event popup ──────────────────────────────────────────────────────────
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);

  // ── Park popup ───────────────────────────────────────────────────────────
  const [parkInfo, setParkInfo] = useState<ParkInfo | null>(null);

  // ── Trail popup ───────────────────────────────────────────────────────────
  const [trailInfo, setTrailInfo] = useState<TrailInfo | null>(null);

  // ── Events panel list ─────────────────────────────────────────────────────
  const [eventsList, setEventsList] = useState<EventFeature[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsLocation, setEventsLocation] = useState<string | undefined>(undefined);

  // ── Onboarding ────────────────────────────────────────────────────────────
  const [showOnboarding, setShowOnboarding] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem("onboarding_done")) setShowOnboarding(true);
  }, []);

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
    async (mode: "origin" | "destination", coord: Coordinate, label?: string) => {
      setPinMode(null);

      let nextOrigin = origin;
      let nextDest = destination;

      if (mode === "origin") {
        setOrigin(coord);
        setOriginLabel(label ?? `${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}`);
        nextOrigin = coord;
      } else {
        setDestination(coord);
        setDestLabel(label ?? `${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}`);
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
      if (key === "events") {
        if (prev.events) {
          setEventsList([]);
          setEventsLoading(false);
        } else {
          setEventsLoading(true); // show panel immediately with skeleton
        }
      }
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setOrigin(null);
    setDestination(null);
    setOriginLabel("");
    setDestLabel("");
    setFastRoute(null);
    setCoolRoute(null);
    setRouteError(null);
    setSegmentInfo(null);
    setPinMode(null);
    setUiMode("idle");
  }, []);

  // ── UI ───────────────────────────────────────────────────────────────────
  return (
    <main className="relative w-screen overflow-hidden" style={{ background: "var(--bg-deep)", height: "100dvh" }}>
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
        eventsLocation={eventsLocation}
        onPinDrop={handlePinDrop}
        onSegmentClick={setSegmentInfo}
        onEventClick={setEventInfo}
        onTrailClick={setTrailInfo}
        onEventsLoaded={(features) => { setEventsList(features); setEventsLoading(false); }}
        onParkClick={setParkInfo}
      />

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pointer-events-none z-10" style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 1rem))" }}>
        {/* Brand */}
        <div
          className="pointer-events-auto anime-panel glow-violet rounded-2xl px-4 py-2.5 flex items-center gap-3"
          style={{ minWidth: 0 }}
        >
          {/* Nature icon */}
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, var(--jade), var(--cyan))",
              boxShadow: "0 0 12px var(--jade-glow)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
              <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
            </svg>
          </div>
          <div className="min-w-0">
            <p
              className="font-zen font-bold leading-tight text-base whitespace-nowrap"
              style={{ color: "var(--text-display)", letterSpacing: "-0.01em" }}
            >
              Walk the City
            </p>
            <p
              className="font-mono-ui leading-tight whitespace-nowrap"
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

      {/* ── Bottom sheet ──────────────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <BottomSheet
          uiMode={uiMode}
          origin={origin}
          destination={destination}
          originLabel={originLabel}
          destLabel={destLabel}
          visibleLayers={visibleLayers}
          fastRoute={fastRoute}
          coolRoute={coolRoute}
          routeLoading={routeLoading}
          routeError={routeError}
          onEnterPlanning={() => setUiMode("planning")}
          onBack={handleReset}
          onToggleLayer={toggleLayer}
          onPinDrop={handlePinDrop}
          onFetchRoute={fetchRoute}
          onSetPinMode={setPinMode}
          onStartNavigation={(route, type) => setActiveNavRoute({ route, type })}
        />
      </div>

      {/* ── Segment popup ─────────────────────────────────────────────────── */}
      {segmentInfo && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:top-20 md:right-4 z-20 pointer-events-none">
          <SegmentPopup info={segmentInfo} onClose={() => setSegmentInfo(null)} />
        </div>
      )}

      {/* ── Event popup ───────────────────────────────────────────────────── */}
      {eventInfo && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-4 z-30 pointer-events-none" style={{ maxHeight: "calc(100dvh - 6rem)" }}>
          <EventPopup
            info={eventInfo}
            onClose={() => setEventInfo(null)}
            onGetDirections={(lng, lat) => {
              setEventInfo(null);
              setDestination({ lng, lat });
              if (origin) {
                fetchRoute(origin, { lng, lat });
              } else {
                setPinMode("origin");
              }
            }}
          />
        </div>
      )}

      {/* ── Park popup ────────────────────────────────────────────────────── */}
      {parkInfo && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:top-20 md:right-4 z-20 pointer-events-none">
          <ParkPanel
            info={parkInfo}
            onClose={() => setParkInfo(null)}
            onRouteHere={(lng, lat) => {
              setParkInfo(null);
              setDestination({ lng, lat });
              if (origin) fetchRoute(origin, { lng, lat });
            }}
          />
        </div>
      )}

      {/* ── Events panel - mobile bottom sheet, desktop sidebar ── */}
      {visibleLayers.events && !eventInfo && !activeNavRoute && (
        <div
          className="absolute bottom-0 left-0 right-0 z-[25] pointer-events-none md:top-20 md:bottom-auto md:right-4 md:left-auto md:w-72 md:max-h-[calc(100dvh-6rem)] md:overflow-hidden md:flex md:flex-col"
        >
          <EventsPanel
            events={eventsList}
            isLoading={eventsLoading}
            onEventSelect={(lng, lat, info) => {
              mapHandleRef.current?.flyTo(lng, lat, 15);
              setEventInfo({ ...info, lng, lat });
            }}
            onClose={() => {
              setEventsList([]);
              setEventsLoading(false);
              toggleLayer("events");
            }}
            onLocationSearch={(location) => {
              setEventsLocation(location);
              setEventsList([]);
              setEventsLoading(true);
            }}
            routeCoords={routeCoords ?? undefined}
          />
        </div>
      )}

      {/* ── Trail popup ───────────────────────────────────────────────────── */}
      {trailInfo && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:bottom-40 md:left-4 md:translate-x-0 z-20 pointer-events-none">
          <TrailPopup info={trailInfo} onClose={() => setTrailInfo(null)} />
        </div>
      )}

      {/* ── Pin-drop instruction banner (shown when tapping map) ────────── */}
      {pinMode && (
        <div
          className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none z-20"
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
            }}
          >
            {pinMode === "origin" ? "✦ Tap map to set start" : "✦ Tap map to set destination"}
          </div>
        </div>
      )}

      {/* ── First-run onboarding overlay ──────────────────────────────────── */}
      {showOnboarding && <OnboardingOverlay onClose={() => setShowOnboarding(false)} />}

      {/* ── Turn-by-turn navigation panel ────────────────────────────────── */}
      {activeNavRoute && (
        <NavigationPanel
          route={activeNavRoute.route}
          routeType={activeNavRoute.type}
          onExit={() => {
            mapHandleRef.current?.stopFollowing();
            mapHandleRef.current?.clearLivePosition();
            setActiveNavRoute(null);
          }}
          onPositionUpdate={(coord) => {
            mapHandleRef.current?.updateLivePosition(coord.lng, coord.lat);
          }}
          onNavUpdate={(coord, bearing) => {
            mapHandleRef.current?.followUser(coord.lng, coord.lat, bearing);
          }}
        />
      )}
    </main>
  );
}

// ── Geocoding result type ──────────────────────────────────────────────────
interface GeoFeature {
  place_name: string;
  center: [number, number]; // [lng, lat]
}

// ── Layer pill config (used in BottomSheet idle mode) ──────────────────────
const LAYER_PILLS: {
  key: keyof LayerVisibility;
  icon: string;
  label: string;
  color: string;
  glow: string;
  border: string;
}[] = [
  { key: "trees",    icon: "🌳", label: "Walk in Shade",      color: "linear-gradient(135deg,#10B981,#059669)", glow: "rgba(16,185,129,.5)",  border: "rgba(52,211,153,.6)" },
  { key: "parks",    icon: "🏞", label: "Parks Near You",      color: "linear-gradient(135deg,#34D399,#10B981)", glow: "rgba(52,211,153,.5)",  border: "rgba(52,211,153,.6)" },
  { key: "lakes",    icon: "💧", label: "Lakes Near You",      color: "linear-gradient(135deg,#06B6D4,#0284C7)", glow: "rgba(6,182,212,.5)",   border: "rgba(103,232,249,.6)" },
  { key: "busStops", icon: "🚌", label: "Bus Stops Near You",  color: "linear-gradient(135deg,#A78BFA,#7C3AED)", glow: "rgba(124,58,237,.5)",  border: "rgba(167,139,250,.6)" },
  { key: "trails",   icon: "🥾", label: "Walking Paths",       color: "linear-gradient(135deg,#86EFAC,#22C55E)", glow: "rgba(134,239,172,.5)", border: "rgba(134,239,172,.6)" },
  { key: "events",   icon: "🎉", label: "BLR Events",          color: "linear-gradient(135deg,#F472B6,#EC4899)", glow: "rgba(244,114,182,.5)", border: "rgba(249,168,212,.6)" },
];

// ── Shared geocode search helper ───────────────────────────────────────────
async function geocodeQuery(value: string): Promise<GeoFeature[]> {
  // Nominatim - free, no key required, full Indian POI coverage
  const q = encodeURIComponent(value.trim());
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=5&countrycodes=in&bounded=1&viewbox=77.30,13.15,77.85,12.70&addressdetails=1`,
    { headers: { "User-Agent": "WalkTheCityBengaluru/1.0" } }
  );
  const data = await res.json();
  return data.map((r: { display_name: string; lon: string; lat: string }) => ({
    place_name: r.display_name,
    center: [parseFloat(r.lon), parseFloat(r.lat)] as [number, number],
  }));
}

// ── Bottom Sheet ───────────────────────────────────────────────────────────
// Two modes: "idle" (layer pills + search bar) and "planning" (From/To + routes).
function BottomSheet({
  uiMode,
  origin,
  destination,
  originLabel,
  destLabel,
  visibleLayers,
  fastRoute,
  coolRoute,
  routeLoading,
  routeError,
  onEnterPlanning,
  onBack,
  onToggleLayer,
  onPinDrop,
  onFetchRoute,
  onSetPinMode,
  onStartNavigation,
}: {
  uiMode: "idle" | "planning";
  origin: Coordinate | null;
  destination: Coordinate | null;
  originLabel: string;
  destLabel: string;
  visibleLayers: LayerVisibility;
  fastRoute: ScoredRoute | null;
  coolRoute: ScoredRoute | null;
  routeLoading: boolean;
  routeError: string | null;
  onEnterPlanning: () => void;
  onBack: () => void;
  onToggleLayer: (key: keyof LayerVisibility) => void;
  onPinDrop: (mode: "origin" | "destination", coord: Coordinate, label?: string) => void;
  onFetchRoute: (o: Coordinate, d: Coordinate) => void;
  onSetPinMode: (m: PinMode) => void;
  onStartNavigation: (route: ScoredRoute, type: "cool" | "fast") => void;
}) {
  const [activeInput, setActiveInput] = useState<"origin" | "destination" | null>(null);
  const [originQuery, setOriginQuery] = useState(originLabel);
  const [destQuery, setDestQuery] = useState(destLabel);
  const [suggestions, setSuggestions] = useState<GeoFeature[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);

  // Sync display text when parent sets labels (e.g. map tap or GPS)
  useEffect(() => { setOriginQuery(originLabel); }, [originLabel]);
  useEffect(() => { setDestQuery(destLabel); }, [destLabel]);

  // Auto-focus "From" input when entering planning mode
  useEffect(() => {
    if (uiMode === "planning" && !origin) {
      setActiveInput("origin");
      setTimeout(() => originInputRef.current?.focus(), 80);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiMode]);

  const handleSearch = (value: string) => {
    setSuggestions([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) return;
    debounceRef.current = setTimeout(async () => {
      try { setSuggestions(await geocodeQuery(value)); } catch { /* silently ignore */ }
    }, 350);
  };

  const handleSelectSuggestion = (f: GeoFeature) => {
    if (!activeInput) return;
    const [lng, lat] = f.center;
    const shortName = f.place_name.split(",")[0].trim();
    onPinDrop(activeInput, { lng, lat }, f.place_name);
    if (activeInput === "origin") {
      setOriginQuery(shortName);
      setSuggestions([]);
      setActiveInput("destination");
      setTimeout(() => destInputRef.current?.focus(), 50);
    } else {
      setDestQuery(shortName);
      setSuggestions([]);
      setActiveInput(null);
    }
  };

  const handleGPS = (mode: "origin" | "destination") => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coord = { lng: pos.coords.longitude, lat: pos.coords.latitude };
        onPinDrop(mode, coord, "Current location");
        if (mode === "origin") {
          setOriginQuery("Current location");
          setActiveInput("destination");
          setTimeout(() => destInputRef.current?.focus(), 50);
        } else {
          setDestQuery("Current location");
          setActiveInput(null);
        }
        setGeoLoading(false);
      },
      () => { setGeoError("Could not get your location."); setGeoLoading(false); },
      { timeout: 8000 }
    );
  };

  // ── Idle mode ────────────────────────────────────────────────────────────
  if (uiMode === "idle") {
    return (
      <div className="pointer-events-none px-3 pb-4">
        <div
          className="pointer-events-auto rounded-3xl overflow-hidden"
          style={{
            background: "var(--bg-card)",
            backdropFilter: "blur(20px) saturate(180%)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
          }}
        >
          {/* Layer pills - 3-column grid so all 6 are visible without scrolling */}
          <div className="grid grid-cols-3 gap-1.5 px-3 pt-3 pb-2">
            {LAYER_PILLS.map(({ key, icon, label, color, glow, border }) => {
              const on = visibleLayers[key];
              return (
                <button
                  key={key}
                  onClick={() => onToggleLayer(key)}
                  className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl font-semibold transition-all duration-200 w-full text-center"
                  style={
                    on
                      ? { background: color, border: `1px solid ${border}`, color: "#fff", boxShadow: `0 0 10px ${glow}` }
                      : { background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }
                  }
                >
                  <span className="text-base leading-none">{icon}</span>
                  <span className="font-grotesk leading-tight text-sm">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div style={{ height: "1px", background: "var(--border-subtle)", margin: "0 12px" }} />

          {/* Search bar CTA */}
          <button
            onClick={onEnterPlanning}
            className="flex items-center gap-3 px-4 py-3.5 w-full text-left"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg,var(--jade),var(--cyan))", boxShadow: "0 0 10px var(--jade-glow)" }}
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: "#fff" }}>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
            </div>
            <span className="font-grotesk font-semibold text-sm" style={{ color: "var(--text-secondary)" }}>
              Where do you want to walk?
            </span>
          </button>
        </div>
      </div>
    );
  }

  // ── Planning mode ────────────────────────────────────────────────────────
  const hasRoute = !!(coolRoute || fastRoute);

  return (
    <div className="pointer-events-none px-3 pb-4">
      <div
        className="pointer-events-auto rounded-3xl overflow-hidden flex flex-col"
        style={{
          background: "var(--bg-card)",
          backdropFilter: "blur(20px) saturate(180%)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
          animation: "slide-up 0.25s cubic-bezier(0.16,1,0.3,1)",
          maxHeight: "min(85dvh, calc(100dvh - 80px))",
          overflowY: "auto",
        }}
      >
        {/* Header row: back + title */}
        <div className="flex items-center gap-2.5 px-3 pt-3 pb-1">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-150 font-grotesk text-sm"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}
          >
            ←
          </button>
          <span className="font-grotesk font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
            Plan your walk
          </span>
        </div>

        {/* From / To inputs */}
        <div className="px-3 pt-1 pb-1 flex flex-col min-w-0 overflow-hidden">
          {/* ── A: From ── */}
          <div className="flex items-center gap-2 py-2.5 min-w-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
              style={{ background: "linear-gradient(135deg,var(--jade),#059669)", boxShadow: "0 0 8px var(--jade-glow)" }}
            >A</div>
            <input
              ref={originInputRef}
              type="text"
              value={originQuery}
              onChange={(e) => { setOriginQuery(e.target.value); handleSearch(e.target.value); }}
              onFocus={() => { setActiveInput("origin"); setSuggestions([]); }}
              placeholder="From - your start point"
              className="flex-1 bg-transparent text-sm outline-none min-w-0 font-grotesk"
              style={{ color: "var(--text-primary)" }}
            />
            {activeInput === "origin" && (
              <button
                onClick={() => handleGPS("origin")}
                disabled={geoLoading}
                className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all"
                style={{ background: "rgba(16,185,129,0.12)", border: "1px solid var(--border-jade)", color: "var(--jade-light)" }}
                title="Use current location"
              >
                {geoLoading
                  ? <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent" style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }} />
                  : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></svg>
                }
              </button>
            )}
            {/* Tap-map button for origin */}
            {activeInput === "origin" && (
              <button
                onClick={() => onSetPinMode("origin")}
                className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: "rgba(16,185,129,0.12)", border: "1px solid var(--border-jade)", color: "var(--jade-light)", fontSize: "12px" }}
                title="Tap on map"
              >📍</button>
            )}
          </div>

          {/* Dashed connector dots */}
          <div className="flex flex-col gap-0.5 py-1 ml-3">
            {[0,1,2].map(i => (
              <div key={i} className="w-1 h-1 rounded-full" style={{ background: "var(--border-subtle)" }} />
            ))}
          </div>

          {/* ── B: To ── */}
          <div className="flex items-center gap-2 py-2.5 min-w-0">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
              style={{ background: "linear-gradient(135deg,var(--amber),#D97706)", boxShadow: "0 0 8px var(--amber-glow)" }}
            >B</div>
            <input
              ref={destInputRef}
              type="text"
              value={destQuery}
              onChange={(e) => { setDestQuery(e.target.value); handleSearch(e.target.value); }}
              onFocus={() => { setActiveInput("destination"); setSuggestions([]); }}
              placeholder="To - a park or destination"
              className="flex-1 bg-transparent text-sm outline-none min-w-0 font-grotesk"
              style={{ color: "var(--text-primary)" }}
            />
            {activeInput === "destination" && (
              <button
                onClick={() => onSetPinMode("destination")}
                className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: "rgba(245,158,11,0.12)", border: "1px solid var(--border-amber)", color: "var(--amber-light)", fontSize: "12px" }}
                title="Tap on map"
              >📍</button>
            )}
          </div>
        </div>

        {/* Autocomplete suggestions */}
        {suggestions.length > 0 && activeInput && (
          <div className="mx-3 mb-2 rounded-2xl overflow-hidden" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", animation: "slide-up 0.15s ease-out" }}>
            {suggestions.slice(0, 5).map((f, i) => (
              <button
                key={i}
                onClick={() => handleSelectSuggestion(f)}
                className="w-full text-left px-3 py-2.5 flex items-start gap-2 transition-colors duration-100"
                style={{ borderBottom: i < Math.min(suggestions.length, 5) - 1 ? "1px solid var(--border-subtle)" : "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: activeInput === "origin" ? "var(--jade-light)" : "var(--amber-light)" }} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                <span className="text-xs leading-snug font-grotesk" style={{ color: "var(--text-primary)" }}>
                  {f.place_name.split(",").slice(0, 3).join(",")}
                </span>
              </button>
            ))}
          </div>
        )}

        {geoError && <p className="text-[10px] text-center px-3 pb-1" style={{ color: "#F87171" }}>{geoError}</p>}

        {/* Route action / loading / error / cards */}
        {!hasRoute && !routeLoading && !routeError && origin && destination && (
          <div className="px-3 pb-3">
            <button
              onClick={() => onFetchRoute(origin, destination)}
              className="w-full py-3 rounded-2xl font-grotesk text-sm font-bold"
              style={{
                background: "linear-gradient(135deg,var(--jade),#059669)",
                color: "#fff",
                border: "1px solid rgba(52,211,153,.4)",
                boxShadow: "0 0 16px var(--jade-glow), 0 4px 16px rgba(0,0,0,.4)",
              }}
            >
              🌳 Find Greenest Route
            </button>
          </div>
        )}

        {routeLoading && (
          <div className="px-3 pb-3 flex items-center justify-center gap-2 py-3">
            <span className="w-4 h-4 rounded-full border-2 border-t-transparent" style={{ animation: "spin 0.8s linear infinite", display: "inline-block", borderColor: "var(--jade)", borderTopColor: "transparent" }} />
            <span className="font-grotesk text-sm" style={{ color: "var(--text-secondary)" }}>Finding best routes…</span>
          </div>
        )}

        {routeError && (
          <div className="mx-3 mb-3 px-3 py-2 rounded-xl" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)" }}>
            <p className="font-grotesk text-xs" style={{ color: "#F87171" }}>{routeError}</p>
          </div>
        )}

        {hasRoute && (
          <div className="px-3 pb-3 flex flex-col gap-2">
            <div className="flex gap-2">
              {coolRoute && (
                <div className="flex-1 rounded-2xl p-3 flex flex-col gap-1" style={{ background: "rgba(16,185,129,.1)", border: "1px solid rgba(52,211,153,.3)", boxShadow: "0 0 10px rgba(16,185,129,.15)" }}>
                  <div className="flex items-center gap-1.5">
                    <span>🌳</span>
                    <span className="font-grotesk font-bold text-xs" style={{ color: "var(--jade-light)" }}>Shadiest</span>
                  </div>
                  <p className="font-grotesk font-bold text-2xl" style={{ color: "var(--text-display)" }}>{Math.round(coolRoute.time / 60000)} <span className="text-sm font-normal">min</span></p>
                  <p className="font-mono-ui text-[9px] uppercase tracking-[.10em]" style={{ color: "var(--text-disabled)" }}>
                    {(coolRoute.distance / 1000).toFixed(1)} km · {Math.round(coolRoute.shadePct)}% shade
                  </p>
                  <button
                    onClick={() => onStartNavigation(coolRoute, "cool")}
                    className="mt-1 w-full py-1.5 rounded-xl font-grotesk text-xs font-bold"
                    style={{ background: "rgba(16,185,129,.2)", color: "var(--jade-light)", border: "1px solid rgba(52,211,153,.4)" }}
                  >
                    Start
                  </button>
                </div>
              )}
              {fastRoute && (
                <div className="flex-1 rounded-2xl p-3 flex flex-col gap-1" style={{ background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.3)", boxShadow: "0 0 10px rgba(245,158,11,.15)" }}>
                  <div className="flex items-center gap-1.5">
                    <span>⚡</span>
                    <span className="font-grotesk font-bold text-xs" style={{ color: "var(--amber-light)" }}>Fastest</span>
                  </div>
                  <p className="font-grotesk font-bold text-2xl" style={{ color: "var(--text-display)" }}>{Math.round(fastRoute.time / 60000)} <span className="text-sm font-normal">min</span></p>
                  <p className="font-mono-ui text-[9px] uppercase tracking-[.10em]" style={{ color: "var(--text-disabled)" }}>
                    {(fastRoute.distance / 1000).toFixed(1)} km · {Math.round(fastRoute.shadePct)}% shade
                  </p>
                  <button
                    onClick={() => onStartNavigation(fastRoute, "fast")}
                    className="mt-1 w-full py-1.5 rounded-xl font-grotesk text-xs font-bold"
                    style={{ background: "rgba(245,158,11,.2)", color: "var(--amber-light)", border: "1px solid rgba(245,158,11,.4)" }}
                  >
                    Start
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
