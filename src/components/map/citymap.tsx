"use client";

import { useEffect, useRef } from "react";
import MapGL, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapRef,
} from "react-map-gl/maplibre";
import { setWorkerUrl } from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import { LocateFixed, MapPin } from "lucide-react";
import type { Coordinates } from "../../lib/places";
import type { WalkingRoute } from "../../lib/routing";

setWorkerUrl(
  new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString(),
);

interface CityMapProps {
  origin: Coordinates | null;
  destination: Coordinates | null;
  route: WalkingRoute | null;
  mapStyle: StyleSpecification;
}

export default function CityMap({
  origin,
  destination,
  route,
  mapStyle,
}: CityMapProps) {
  const mapRef = useRef<MapRef>(null);

  useEffect(() => {
    if (!route || !mapRef.current) return;

    const bounds = route.coordinates.reduce(
      (result, [longitude, latitude]) => ({
        west: Math.min(result.west, longitude),
        south: Math.min(result.south, latitude),
        east: Math.max(result.east, longitude),
        north: Math.max(result.north, latitude),
      }),
      {
        west: Number.POSITIVE_INFINITY,
        south: Number.POSITIVE_INFINITY,
        east: Number.NEGATIVE_INFINITY,
        north: Number.NEGATIVE_INFINITY,
      },
    );

    if (
      !Number.isFinite(bounds.west) ||
      !Number.isFinite(bounds.south) ||
      !Number.isFinite(bounds.east) ||
      !Number.isFinite(bounds.north)
    ) {
      return;
    }

    mapRef.current.fitBounds(
      [
        [bounds.west, bounds.south],
        [bounds.east, bounds.north],
      ],
      {
        padding: { top: 100, right: 90, bottom: 100, left: 90 },
        maxZoom: 17,
        duration: 700,
      },
    );
  }, [route]);

  if (!origin) {
    return (
      <div className="map-empty">
        <div className="map-empty-pattern" />
        <div className="map-empty-card">
          <span className="map-empty-icon"><LocateFixed size={21} /></span>
          <p className="map-empty-overline">YOUR WALK STARTS HERE</p>
          <h2>Choose a starting point</h2>
          <p>Use your current location or choose a city to see its real streets and walking routes.</p>
        </div>
      </div>
    );
  }

  const routeFeature = route
    ? {
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "LineString" as const,
          coordinates: route.coordinates,
        },
      }
    : null;

  return (
    <MapGL
      key={`${origin.latitude}:${origin.longitude}`}
      ref={mapRef}
      initialViewState={{
        longitude: origin.longitude,
        latitude: origin.latitude,
        zoom: 15,
      }}
      mapStyle={mapStyle}
      style={{ width: "100%", height: "100%" }}
      cooperativeGestures
    >
      <NavigationControl position="top-right" showCompass={false} />
      {routeFeature && (
        <Source id="walking-route" type="geojson" data={routeFeature}>
          <Layer
            id="walking-route-line"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{
              "line-color": "#16866e",
              "line-width": 6,
              "line-opacity": 0.9,
            }}
          />
        </Source>
      )}
      <Marker longitude={origin.longitude} latitude={origin.latitude} anchor="center">
        <span className="map-origin-marker" aria-label="Starting point"><span /></span>
      </Marker>
      {destination && (
        <Marker longitude={destination.longitude} latitude={destination.latitude} anchor="bottom">
          <span className="map-destination-marker" aria-label="Destination"><MapPin size={23} fill="currentColor" /></span>
        </Marker>
      )}
    </MapGL>
  );
}