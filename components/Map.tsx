"use client";

/**
 * Map.tsx — MapLibre GL JS full-screen map.
 *
 * Responsibilities:
 *  - Render the base MapTiler style
 *  - Add all geo data sources (lakes, parks, trees, bus stops, heat tiles)
 *  - Render route lines when fastRoute / coolRoute are provided
 *  - Handle pin dropping (origin + destination)
 *  - Fire onSegmentClick when a route segment is tapped
 *  - Expose layer visibility controls via the `visibleLayers` prop
 */

import { useEffect, useRef, useCallback, useImperativeHandle, useState } from "react";
import type { Ref } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  BENGALURU_CENTER,
  DEFAULT_ZOOM,
  getBaseStyleUrl,
  COLORS,
  LAYER_IDS,
  SOURCE_IDS,
} from "@/lib/mapStyle";

export type Theme = "light" | "dark";
import type { ScoredRoute, SegmentInfo } from "@/lib/shadeScoring";
import type { Coordinate } from "@/lib/graphhopper";
import type { ParkInfo } from "./ParkPanel";
export type { ParkInfo };

/** Properties returned by /api/events for each event feature */
export interface EventInfo {
  title: string;
  date: string;
  time: string;
  venue: string;
  address: string;
  ticket_url: string | null;
  thumbnail: string | null;
  category: string;
  lng?: number;  // coordinate for "get directions" feature
  lat?: number;
}

/** Properties of a clicked heatmap hexbin */
export interface HeatmapInfo {
  tree_count: number;
  lng: number;
  lat: number;
}

/** Properties of a clicked trail feature */
export interface TrailInfo {
  name: string;
  surface: string;
  length_m: number;
}

/** A GeoJSON event feature with typed properties and coordinates */
export interface EventFeature {
  properties: EventInfo;
  geometry: { type: string; coordinates: [number, number] };
}

export type PinMode = "origin" | "destination" | null;

/** Imperative handle exposed to parent via ref */
export interface MapHandle {
  flyTo(lng: number, lat: number, zoom?: number): void;
}

export interface LayerVisibility {
  trees: boolean;
  parks: boolean;
  lakes: boolean;
  heat: boolean;
  busStops: boolean;
  trails: boolean;
  events: boolean;
}

interface MapProps {
  pinMode: PinMode;
  origin: Coordinate | null;
  destination: Coordinate | null;
  fastRoute: ScoredRoute | null;
  coolRoute: ScoredRoute | null;
  visibleLayers: LayerVisibility;
  theme: Theme;
  onPinDrop: (mode: "origin" | "destination", coord: Coordinate) => void;
  onSegmentClick: (info: SegmentInfo) => void;
  onEventClick: (info: EventInfo) => void;
  onHeatmapClick?: (info: HeatmapInfo) => void;
  onTrailClick?: (info: TrailInfo) => void;
  onEventsLoaded?: (features: EventFeature[]) => void;
  onParkClick?: (info: ParkInfo) => void;
  // React 19: ref is a regular prop, no forwardRef needed
  ref?: Ref<MapHandle>;
}

export default function Map({
  pinMode,
  origin,
  destination,
  fastRoute,
  coolRoute,
  visibleLayers,
  theme,
  onPinDrop,
  onSegmentClick,
  onEventClick,
  onHeatmapClick,
  onTrailClick,
  onEventsLoaded,
  onParkClick,
  ref,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [eventsError, setEventsError] = useState(false);
  const originMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  const pinModeRef = useRef<PinMode>(pinMode);
  pinModeRef.current = pinMode;

  // Keep latest state in refs so we can re-apply after a style swap
  const fastRouteRef = useRef(fastRoute);
  const coolRouteRef = useRef(coolRoute);
  const visibleLayersRef = useRef(visibleLayers);
  fastRouteRef.current = fastRoute;
  coolRouteRef.current = coolRoute;
  visibleLayersRef.current = visibleLayers;

  // Track whether the map has been initialised yet (skip the first theme effect run)
  const mapReadyRef = useRef(false);

  // ── Imperative handle — exposes flyTo to parent via ref ───────────────────
  useImperativeHandle(ref, () => ({
    flyTo(lng: number, lat: number, zoom = 15) {
      mapRef.current?.flyTo({ center: [lng, lat], zoom, speed: 1.4, curve: 1.4 });
    },
  }));

  // ── Init map ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getBaseStyleUrl(theme),
      center: BENGALURU_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }), "bottom-right");

    map.on("load", () => {
      addDataSources(map);
      addDataLayers(map);
      mapReadyRef.current = true;
    });

    // Click handler for pin dropping and segment taps
    map.on("click", (e) => {
      const mode = pinModeRef.current;
      if (mode) {
        onPinDrop(mode, { lng: e.lngLat.lng, lat: e.lngLat.lat });
        return;
      }

      // Check if an event pin was clicked (highest priority)
      const eventFeatures = map.queryRenderedFeatures(e.point, {
        layers: [LAYER_IDS.events],
      });
      if (eventFeatures.length > 0) {
        const feature = eventFeatures[0];
        const props = feature.properties as EventInfo;
        const geom = feature.geometry as { type: string; coordinates?: [number, number] };
        if (props) onEventClick({
          ...props,
          lng: geom.coordinates?.[0],
          lat: geom.coordinates?.[1],
        });
        return;
      }

      // Check if a park polygon was clicked (only fires when parks layer is visible)
      const parkFeatures = map.queryRenderedFeatures(e.point, {
        layers: [LAYER_IDS.parksFill],
      });
      if (parkFeatures.length > 0) {
        const props = parkFeatures[0].properties as { name?: string; type?: string };
        if (onParkClick) {
          onParkClick({
            name: props?.name ?? "Unknown Park",
            type: props?.type ?? "park",
            lng: e.lngLat.lng,
            lat: e.lngLat.lat,
          });
        }
        return;
      }

      // Check if a trail was clicked
      const trailFeatures = map.queryRenderedFeatures(e.point, {
        layers: [LAYER_IDS.trails],
      });
      if (trailFeatures.length > 0) {
        const props = trailFeatures[0].properties as TrailInfo;
        if (props && onTrailClick) onTrailClick(props);
        return;
      }

      // Check if a heatmap hexbin was clicked
      const heatFeatures = map.queryRenderedFeatures(e.point, {
        layers: [LAYER_IDS.heatRaster],
      });
      if (heatFeatures.length > 0) {
        const props = heatFeatures[0].properties as { tree_count: number };
        if (props && onHeatmapClick) {
          onHeatmapClick({ tree_count: props.tree_count ?? 0, lng: e.lngLat.lng, lat: e.lngLat.lat });
        }
        return;
      }

      // Check if a route line was clicked
      const features = map.queryRenderedFeatures(e.point, {
        layers: [LAYER_IDS.routeCool, LAYER_IDS.routeFast],
      });
      if (features.length > 0) {
        const props = features[0].properties as SegmentInfo;
        if (props) onSegmentClick(props);
      }
    });

    // Route cursor
    map.on("mouseenter", LAYER_IDS.routeCool, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", LAYER_IDS.routeCool, () => {
      map.getCanvas().style.cursor = pinModeRef.current ? "crosshair" : "";
    });
    map.on("mouseenter", LAYER_IDS.routeFast, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", LAYER_IDS.routeFast, () => {
      map.getCanvas().style.cursor = pinModeRef.current ? "crosshair" : "";
    });

    // Events layer cursor
    map.on("mouseenter", LAYER_IDS.events, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", LAYER_IDS.events, () => {
      map.getCanvas().style.cursor = pinModeRef.current ? "crosshair" : "";
    });

    // Parks layer cursor
    map.on("mouseenter", LAYER_IDS.parksFill, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", LAYER_IDS.parksFill, () => {
      map.getCanvas().style.cursor = pinModeRef.current ? "crosshair" : "";
    });

    // Trails cursor
    map.on("mouseenter", LAYER_IDS.trails, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", LAYER_IDS.trails, () => {
      map.getCanvas().style.cursor = pinModeRef.current ? "crosshair" : "";
    });

    // Heatmap cursor
    map.on("mouseenter", LAYER_IDS.heatRaster, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", LAYER_IDS.heatRaster, () => {
      map.getCanvas().style.cursor = pinModeRef.current ? "crosshair" : "";
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Theme / map style swap ────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    // Skip the very first run — map initialised with the correct style already
    if (!map || !mapReadyRef.current) return;

    map.setStyle(getBaseStyleUrl(theme));

    map.once("style.load", () => {
      addDataSources(map);
      addDataLayers(map);
      // Re-apply current route data
      updateRouteSource(map, SOURCE_IDS.routeFast, fastRouteRef.current);
      updateRouteSource(map, SOURCE_IDS.routeCool, coolRouteRef.current);
      // Re-apply layer visibility
      const vis = visibleLayersRef.current;
      setLayerVisibility(map, LAYER_IDS.treeDensity, vis.trees);
      setLayerVisibility(map, LAYER_IDS.parksFill, vis.parks);
      setLayerVisibility(map, LAYER_IDS.parksStroke, vis.parks);
      setLayerVisibility(map, LAYER_IDS.lakesFill, vis.lakes);
      setLayerVisibility(map, LAYER_IDS.lakesStroke, vis.lakes);
      setLayerVisibility(map, LAYER_IDS.heatRaster, vis.heat);
      setLayerVisibility(map, LAYER_IDS.busStops, vis.busStops);
      setLayerVisibility(map, LAYER_IDS.trails, vis.trails);
      setLayerVisibility(map, LAYER_IDS.events, vis.events);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  // ── Pin mode cursor ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.getCanvas().style.cursor = pinMode ? "crosshair" : "";
  }, [pinMode]);

  // ── Origin marker ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    originMarkerRef.current?.remove();
    if (origin) {
      const el = createPinEl(COLORS.coolRoute, "A");
      originMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([origin.lng, origin.lat])
        .addTo(mapRef.current);
    }
  }, [origin]);

  // ── Destination marker ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    destMarkerRef.current?.remove();
    if (destination) {
      const el = createPinEl(COLORS.fastRoute, "B");
      destMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([destination.lng, destination.lat])
        .addTo(mapRef.current);
    }
  }, [destination]);

  // ── Route lines ───────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    updateRouteSource(map, SOURCE_IDS.routeFast, fastRoute);
    updateRouteSource(map, SOURCE_IDS.routeCool, coolRoute);
  }, [fastRoute, coolRoute]);

  // ── Layer visibility ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    setLayerVisibility(map, LAYER_IDS.treeDensity, visibleLayers.trees);
    setLayerVisibility(map, LAYER_IDS.parksFill, visibleLayers.parks);
    setLayerVisibility(map, LAYER_IDS.parksStroke, visibleLayers.parks);
    setLayerVisibility(map, LAYER_IDS.lakesFill, visibleLayers.lakes);
    setLayerVisibility(map, LAYER_IDS.lakesStroke, visibleLayers.lakes);
    setLayerVisibility(map, LAYER_IDS.heatRaster, visibleLayers.heat);
    setLayerVisibility(map, LAYER_IDS.busStops, visibleLayers.busStops);
    setLayerVisibility(map, LAYER_IDS.trails, visibleLayers.trails);
    setLayerVisibility(map, LAYER_IDS.events, visibleLayers.events);
  }, [visibleLayers]);

  // ── Trails auto-fit ──────────────────────────────────────────────────────
  // When trails are toggled on, fit the map to show all trail locations across Bangalore.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (visibleLayers.trails) {
      // Pre-computed bbox of all 8 static trail features in Bangalore
      const TRAILS_BOUNDS: [[number, number], [number, number]] = [
        [77.5800, 12.9012], // sw corner (Sankey Tank / Bannerghatta)
        [77.6401, 13.0447], // ne corner (Indiranagar / Hebbal)
      ];
      map.fitBounds(TRAILS_BOUNDS, { padding: 60, duration: 800 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleLayers.trails]);

  // ── Events data fetch ─────────────────────────────────────────────────────
  // Fetch /api/events when the events layer is turned on; clear when turned off.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource(SOURCE_IDS.events) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    if (visibleLayers.events) {
      // On GitHub Pages (static export) the API route is removed; fall back to static GeoJSON.
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      const eventsUrl = basePath ? `${basePath}/data/events.geojson` : "/api/events";
      fetch(eventsUrl)
        .then((res) => {
          if (!res.ok) throw new Error(`Events API returned ${res.status}`);
          return res.json();
        })
        .then((geojson) => {
          // Re-acquire source after async — style may have swapped
          const s = mapRef.current?.getSource(SOURCE_IDS.events) as maplibregl.GeoJSONSource | undefined;
          s?.setData(geojson);
          // Notify parent with the loaded event features for the side panel
          if (onEventsLoaded) onEventsLoaded(geojson.features ?? []);
        })
        .catch((err) => {
          console.warn("Failed to load events:", err);
          setEventsError(true);
        });
    } else {
      source.setData({ type: "FeatureCollection", features: [] });
    }
  }, [visibleLayers.events]);

  return (
    <div className="absolute inset-0 w-full h-full">
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
        style={{ background: "var(--bg-deep)" }}
      />
      {eventsError && (
        <div
          className="absolute bottom-16 left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(248,113,113,0.25)",
            borderRadius: "999px",
            padding: "4px 12px",
            color: "rgba(252,165,165,0.85)",
            fontSize: "10px",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.1em",
            whiteSpace: "nowrap",
          }}
        >
          Events unavailable
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function addDataSources(map: maplibregl.Map) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  for (const [id, file] of [
    [SOURCE_IDS.lakes, "lakes.geojson"],
    [SOURCE_IDS.parks, "parks.geojson"],
    [SOURCE_IDS.trees, "tree-density.geojson"],
    [SOURCE_IDS.busStops, "bus-stops.geojson"],
    [SOURCE_IDS.trails, "trails.geojson"],
  ] as [string, string][]) {
    map.addSource(id, {
      type: "geojson",
      data: `${basePath}/data/${file}`,
    });
  }

  // Route sources (empty initially)
  for (const id of [SOURCE_IDS.routeFast, SOURCE_IDS.routeCool]) {
    map.addSource(id, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  // Events source (empty initially; populated on demand when layer is toggled on)
  map.addSource(SOURCE_IDS.events, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
}

function addDataLayers(map: maplibregl.Map) {
  // Heat layer — urban heat islands derived from tree density (sparse trees = hotter).
  // Uses the existing tree-density hexbins with an inverted colour scale so areas
  // lacking canopy show as orange/red. No external raster tiles needed.
  map.addLayer({
    id: LAYER_IDS.heatRaster,
    type: "fill",
    source: SOURCE_IDS.trees,
    paint: {
      "fill-color": [
        "interpolate", ["linear"],
        ["get", "tree_count"],
        0,   "#FF4500", // scorching — no tree cover
        50,  "#FF8C00", // hot
        150, "#FFD700", // warm
        300, "#90EE90", // cool — dense canopy
      ],
      "fill-opacity": 0.55,
    },
    layout: { visibility: "none" },
  });

  // Lakes
  map.addLayer({
    id: LAYER_IDS.lakesFill,
    type: "fill",
    source: SOURCE_IDS.lakes,
    paint: { "fill-color": COLORS.lakeFill, "fill-opacity": 0.55 },
    layout: { visibility: "none" },
  });
  map.addLayer({
    id: LAYER_IDS.lakesStroke,
    type: "line",
    source: SOURCE_IDS.lakes,
    paint: { "line-color": COLORS.lakeStroke, "line-width": 1 },
    layout: { visibility: "none" },
  });

  // Parks
  map.addLayer({
    id: LAYER_IDS.parksFill,
    type: "fill",
    source: SOURCE_IDS.parks,
    paint: { "fill-color": COLORS.parkFill, "fill-opacity": 0.5 },
    layout: { visibility: "none" },
  });
  map.addLayer({
    id: LAYER_IDS.parksStroke,
    type: "line",
    source: SOURCE_IDS.parks,
    paint: { "line-color": COLORS.parkStroke, "line-width": 1 },
    layout: { visibility: "none" },
  });

  // Tree density hexbins (choropleth: low → high density = light → dark green)
  map.addLayer({
    id: LAYER_IDS.treeDensity,
    type: "fill",
    source: SOURCE_IDS.trees,
    paint: {
      "fill-color": [
        "interpolate", ["linear"],
        ["get", "tree_count"],
        0,   COLORS.treeLow,
        50,  "#6BAE66",
        150, "#3D8B37",
        300, COLORS.treeHigh,
      ],
      "fill-opacity": 0.6,
    },
    layout: { visibility: "none" },
  });

  // Bus stops
  map.addLayer({
    id: LAYER_IDS.busStops,
    type: "circle",
    source: SOURCE_IDS.busStops,
    paint: {
      "circle-color": COLORS.busStop,
      "circle-radius": 4,
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 1.5,
    },
    layout: { visibility: "none" },
  });

  // Trails / walking paths — dashed green, drawn under route lines
  map.addLayer({
    id: LAYER_IDS.trails,
    type: "line",
    source: SOURCE_IDS.trails,
    paint: {
      "line-color": COLORS.trailLine,
      "line-width": 2.5,
      // Dashed pattern: 4px dash, 3px gap — distinct from solid route lines
      "line-dasharray": [4, 3],
      "line-opacity": 0.90,
    },
    layout: { "line-cap": "round", "line-join": "round", visibility: "none" },
  });

  // Events — pink circle pins, drawn above data layers but below route lines
  map.addLayer({
    id: LAYER_IDS.events,
    type: "circle",
    source: SOURCE_IDS.events,
    paint: {
      "circle-color": COLORS.eventPin,
      "circle-radius": 8,
      "circle-stroke-color": COLORS.eventPinBorder,
      "circle-stroke-width": 2,
      "circle-opacity": 0.9,
    },
    layout: { visibility: "none" },
  });

  // Fast route (amber, drawn under cool route)
  map.addLayer({
    id: LAYER_IDS.routeFastCasing,
    type: "line",
    source: SOURCE_IDS.routeFast,
    paint: { "line-color": COLORS.routeOutline, "line-width": 8, "line-opacity": 0.7 },
    layout: { "line-cap": "round", "line-join": "round", visibility: "visible" },
  });
  map.addLayer({
    id: LAYER_IDS.routeFast,
    type: "line",
    source: SOURCE_IDS.routeFast,
    paint: { "line-color": COLORS.fastRoute, "line-width": 5, "line-dasharray": [2, 2] },
    layout: { "line-cap": "round", "line-join": "round", visibility: "visible" },
  });

  // Cool route (deep green, on top)
  map.addLayer({
    id: LAYER_IDS.routeCoolCasing,
    type: "line",
    source: SOURCE_IDS.routeCool,
    paint: { "line-color": COLORS.routeOutline, "line-width": 10, "line-opacity": 0.8 },
    layout: { "line-cap": "round", "line-join": "round", visibility: "visible" },
  });
  map.addLayer({
    id: LAYER_IDS.routeCool,
    type: "line",
    source: SOURCE_IDS.routeCool,
    paint: { "line-color": COLORS.coolRoute, "line-width": 6 },
    layout: { "line-cap": "round", "line-join": "round", visibility: "visible" },
  });
}

function updateRouteSource(
  map: maplibregl.Map,
  sourceId: string,
  route: ScoredRoute | null
) {
  const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
  if (!source) return;

  if (!route) {
    source.setData({ type: "FeatureCollection", features: [] });
    return;
  }

  // Build feature collection where each segment carries its shade metadata
  const features = route.perSegment.map((seg) => ({
    type: "Feature" as const,
    geometry: { type: "LineString" as const, coordinates: seg.coordinates },
    properties: {
      shade_score: seg.shade_score,
      tree_count: seg.tree_count,
      dominant_species: seg.dominant_species,
      nearest_park: seg.nearest_park,
      nearest_park_dist_m: seg.nearest_park_dist_m,
      road_name: seg.road_name,
    },
  }));

  source.setData({ type: "FeatureCollection", features });
}

function setLayerVisibility(
  map: maplibregl.Map,
  layerId: string,
  visible: boolean
) {
  if (!map.getLayer(layerId)) return;
  map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
}

function createPinEl(color: string, label: string): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = `
    width: 32px; height: 40px; cursor: default;
    display: flex; align-items: center; justify-content: center;
  `;
  el.innerHTML = `
    <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 24 16 24S32 26 32 16C32 7.163 24.837 0 16 0z"
            fill="${color}" stroke="white" stroke-width="2"/>
      <text x="16" y="20" text-anchor="middle" dominant-baseline="middle"
            fill="white" font-size="12" font-weight="bold" font-family="sans-serif">${label}</text>
    </svg>
  `;
  return el;
}
