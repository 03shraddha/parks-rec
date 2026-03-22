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

import { useEffect, useRef, useCallback } from "react";
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
import type { ScoredRoute, SegmentInfo } from "@/lib/shadeScoring";
import type { Coordinate } from "@/lib/graphhopper";

export type PinMode = "origin" | "destination" | null;

export interface LayerVisibility {
  trees: boolean;
  parks: boolean;
  lakes: boolean;
  heat: boolean;
  busStops: boolean;
}

interface MapProps {
  pinMode: PinMode;
  origin: Coordinate | null;
  destination: Coordinate | null;
  fastRoute: ScoredRoute | null;
  coolRoute: ScoredRoute | null;
  visibleLayers: LayerVisibility;
  onPinDrop: (mode: "origin" | "destination", coord: Coordinate) => void;
  onSegmentClick: (info: SegmentInfo) => void;
}

export default function Map({
  pinMode,
  origin,
  destination,
  fastRoute,
  coolRoute,
  visibleLayers,
  onPinDrop,
  onSegmentClick,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const originMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  const pinModeRef = useRef<PinMode>(pinMode);
  pinModeRef.current = pinMode;

  // ── Init map ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getBaseStyleUrl(),
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
    });

    // Click handler for pin dropping and segment taps
    map.on("click", (e) => {
      const mode = pinModeRef.current;
      if (mode) {
        onPinDrop(mode, { lng: e.lngLat.lng, lat: e.lngLat.lat });
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

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const el = createPinEl("#2D6A1F", "A");
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
      const el = createPinEl("#C67C2B", "B");
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
  }, [visibleLayers]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full"
      style={{ background: "#F5F0E8" }}
    />
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function addDataSources(map: maplibregl.Map) {
  const heatTilesUrl = process.env.NEXT_PUBLIC_HEAT_TILES_URL ?? "/tiles/heat/{z}/{x}/{y}.png";

  map.addSource(SOURCE_IDS.heat, {
    type: "raster",
    tiles: [heatTilesUrl],
    tileSize: 256,
    minzoom: 8,
    maxzoom: 14,
  });

  for (const [id, file] of [
    [SOURCE_IDS.lakes, "lakes.geojson"],
    [SOURCE_IDS.parks, "parks.geojson"],
    [SOURCE_IDS.trees, "tree-density.geojson"],
    [SOURCE_IDS.busStops, "bus-stops.geojson"],
  ] as [string, string][]) {
    map.addSource(id, {
      type: "geojson",
      data: `/data/${file}`,
    });
  }

  // Route sources (empty initially)
  for (const id of [SOURCE_IDS.routeFast, SOURCE_IDS.routeCool]) {
    map.addSource(id, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
}

function addDataLayers(map: maplibregl.Map) {
  // Heat raster (bottom-most custom layer)
  map.addLayer({
    id: LAYER_IDS.heatRaster,
    type: "raster",
    source: SOURCE_IDS.heat,
    paint: { "raster-opacity": 0.55 },
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
