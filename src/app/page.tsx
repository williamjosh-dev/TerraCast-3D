"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import MapGL, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapRef,
} from "react-map-gl/maplibre";
import type { StyleSpecification } from "maplibre-gl";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  Clock3,
  Coffee,
  Footprints,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Navigation,
  Route as RouteIcon,
  Search,
  ShieldCheck,
  Store,
  TreePine,
  X,
} from "lucide-react";
import { reverseGeocode, searchPlaces } from "../lib/places";
import type { Coordinates, PlaceResult } from "../lib/places";
import { searchNearbyPlaces } from "../lib/overpass";
import type { PlaceCategory } from "../lib/overpass";
import { calculateWalkingRoutes } from "../lib/routing";
import type { WalkingRoute } from "../lib/routing";

type SearchTarget = "origin" | "destination";

interface SelectedPlace extends Coordinates {
  label: string;
  description: string;
  source: "device" | "search";
}

const mapTilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim() ?? "";

function createMapStyle(labelStyle?: StyleSpecification): StyleSpecification {
  const labelLayers = labelStyle?.layers.filter((layer) => layer.type === "symbol") ?? [];

  return {
    version: 8,
    ...(labelStyle?.glyphs ? { glyphs: labelStyle.glyphs } : {}),
    ...(labelStyle?.sprite ? { sprite: labelStyle.sprite } : {}),
    sources: {
      ...(labelStyle?.sources ?? {}),
      "esri-imagery": {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution:
          "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      },
    },
    layers: [
      { id: "esri-world-imagery", type: "raster", source: "esri-imagery" },
      ...labelLayers,
    ],
  };
}

const destinationTypes = [
  { label: "Parks", value: "park", Icon: TreePine },
  { label: "Shops", value: "shop", Icon: Store },
  { label: "Coffee", value: "cafe", Icon: Coffee },
  { label: "Work", value: "office", Icon: BriefcaseBusiness },
] as const satisfies readonly { label: string; value: PlaceCategory; Icon: typeof TreePine }[];

function getPlaceLabel(place: PlaceResult): string {
  return place.name || place.description.split(",").slice(0, 2).join(", ");
}

function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function getLocationError(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location permission was denied. You can choose a starting city instead.";
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Your location could not be determined. Try choosing a city instead.";
  }
  if (error.code === error.TIMEOUT) {
    return "Finding your location took too long. Please try again or choose a city.";
  }
  return "Could not access your location. Please try again or choose a city.";
}

export default function Home() {
  const mapRef = useRef<MapRef>(null);
  const placeSearchRequestId = useRef(0);
  const routeRequestId = useRef(0);
  const locationRequestId = useRef(0);
  const [origin, setOrigin] = useState<SelectedPlace | null>(null);
  const [destination, setDestination] = useState<SelectedPlace | null>(null);
  const [destinationQuery, setDestinationQuery] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [otherCityOpen, setOtherCityOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState<SearchTarget | null>(null);
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [routes, setRoutes] = useState<WalkingRoute[]>([]);
  const [mapStyle, setMapStyle] = useState<StyleSpecification>(() => createMapStyle());
  const [mapStyleError, setMapStyleError] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [routeError, setRouteError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const activeRoute =
    routes.find((route) => route.id === selectedRouteId) ?? routes[0] ?? null;

  useEffect(() => {
    if (!mapTilerKey) return;

    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          `https://api.maptiler.com/maps/streets-v2/style.json?key=${encodeURIComponent(mapTilerKey)}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error(`MapTiler returned HTTP ${response.status}.`);
        }

        const labelStyle: StyleSpecification = await response.json();
        if (!labelStyle.sources || !Array.isArray(labelStyle.layers)) {
          throw new Error("MapTiler returned an invalid map style.");
        }
        setMapStyle(createMapStyle(labelStyle));
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Could not load MapTiler street labels:", error);
        setMapStyleError("MapTiler labels failed to load. Check your API key.");
      }
    })();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!activeRoute || !mapRef.current) return;

    const bounds = activeRoute.coordinates.reduce(
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

    mapRef.current.fitBounds(
      [
        [bounds.west, bounds.south],
        [bounds.east, bounds.north],
      ],
      { padding: { top: 100, right: 90, bottom: 100, left: 90 }, maxZoom: 16, duration: 700 },
    );
  }, [activeRoute]);

  function handleUseLocation() {
    const requestId = ++locationRequestId.current;
    setLocationError("");
    setRouteError("");
    setStatusMessage("");

    if (!navigator.geolocation) {
      setLocationError("Location is not supported by this browser. Choose a starting city instead.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (requestId !== locationRequestId.current) return;
        const coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        const nextOrigin: SelectedPlace = {
          ...coordinates,
          label: "Your location",
          description: "Current device location",
          source: "device",
        };

        setOrigin(nextOrigin);
        setRoutes([]);
        setSelectedRouteId("");
        setOtherCityOpen(false);
        setIsLocating(false);
        setStatusMessage("Starting point set. Add a destination to calculate your walk.");

        void reverseGeocode(coordinates)
          .then((label) => {
            if (requestId !== locationRequestId.current) return;
            setOrigin((current) =>
              current?.source === "device" &&
              current.latitude === coordinates.latitude &&
              current.longitude === coordinates.longitude
                ? { ...current, label, description: label }
                : current,
            );
          })
          .catch((error: unknown) => {
            if (requestId !== locationRequestId.current) return;
            console.error("Could not name the detected location:", error);
            setLocationError("Location found, but its place name could not be loaded. You can still plan a walk.");
          });
      },
      (error) => {
        if (requestId !== locationRequestId.current) return;
        setIsLocating(false);
        setLocationError(getLocationError(error));
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  async function searchForPlace(target: SearchTarget, query: string) {
    const requestId = ++placeSearchRequestId.current;
    if (!query.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      setSearchTarget(null);
      setSearchError(target === "origin" ? "Enter a city to use as your starting point." : "Enter a place to search.");
      return;
    }

    setIsSearching(true);
    setSearchTarget(target);
    setSearchError("");
    setStatusMessage("");

    try {
      const lookupQuery =
        target === "destination" && origin
          ? `${query.trim()}, ${origin.label}`
          : query;
      const results = await searchPlaces(lookupQuery);
      if (requestId !== placeSearchRequestId.current) return;
      setSearchResults(results);
      if (!results.length) setSearchError("No matching places found. Try a nearby street, business, or city.");
    } catch (error) {
      if (requestId !== placeSearchRequestId.current) return;
      console.error("Place search failed:", error);
      setSearchResults([]);
      setSearchError(error instanceof Error ? error.message : "Place search failed. Please try again.");
    } finally {
      if (requestId === placeSearchRequestId.current) setIsSearching(false);
    }
  }

  async function searchNearbyCategory(category: PlaceCategory) {
    const requestId = ++placeSearchRequestId.current;
    const categoryLabel =
      destinationTypes.find((item) => item.value === category)?.label ?? category;
    setDestinationQuery(categoryLabel);
    setSearchTarget("destination");
    setSearchResults([]);
    setSearchError("");
    setStatusMessage("");

    if (!origin) {
      setIsSearching(false);
      setSearchError("Choose a starting point first to find nearby places.");
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchNearbyPlaces(category, origin);
      if (requestId !== placeSearchRequestId.current) return;
      setSearchResults(results);
      if (!results.length) {
        setSearchError(`No nearby ${categoryLabel.toLowerCase()} found within 5 km.`);
      }
    } catch (error) {
      if (requestId !== placeSearchRequestId.current) return;
      console.error("Nearby place search failed:", error);
      setSearchResults([]);
      setSearchError(error instanceof Error ? error.message : "Nearby place search failed.");
    } finally {
      if (requestId === placeSearchRequestId.current) setIsSearching(false);
    }
  }

  async function calculateRoute(from: SelectedPlace, to: SelectedPlace) {
    const requestId = ++routeRequestId.current;
    setIsCalculating(true);
    setRouteError("");
    setSearchError("");
    setStatusMessage("");
    setRoutes([]);
    setSelectedRouteId("");

    try {
      const foundRoutes = await calculateWalkingRoutes(from, to);
      if (requestId !== routeRequestId.current) return;
      setRoutes(foundRoutes);
      setSelectedRouteId(foundRoutes[0].id);
      setStatusMessage(`${foundRoutes.length} walking route${foundRoutes.length === 1 ? "" : "s"} found.`);
    } catch (error) {
      if (requestId !== routeRequestId.current) return;
      console.error("Walking route calculation failed:", error);
      setRouteError(error instanceof Error ? error.message : "Could not calculate a walking route.");
    } finally {
      if (requestId === routeRequestId.current) setIsCalculating(false);
    }
  }

  function selectPlace(target: SearchTarget, place: PlaceResult) {
    placeSearchRequestId.current += 1;
    locationRequestId.current += 1;
    routeRequestId.current += 1;
    setIsLocating(false);
    setIsCalculating(false);
    const selected: SelectedPlace = {
      latitude: place.latitude,
      longitude: place.longitude,
      label: getPlaceLabel(place),
      description: place.description,
      source: "search",
    };

    setSearchResults([]);
    setSearchTarget(null);
    setSearchError("");
    setRouteError("");
    setRoutes([]);
    setSelectedRouteId("");

    if (target === "origin") {
      setOrigin(selected);
      setCityQuery(selected.label);
      setOtherCityOpen(false);
      setStatusMessage(
        destination
          ? "Starting city selected. Calculating your walking route…"
          : "Starting city selected. Now choose a destination.",
      );
      if (destination) void calculateRoute(selected, destination);
      return;
    }

    setDestination(selected);
    setDestinationQuery(selected.label);
    setStatusMessage(
      origin
        ? "Destination selected. Calculating your walking route…"
        : "Destination selected. Choose your starting point to calculate a walk.",
    );
    if (origin) void calculateRoute(origin, selected);
  }

  function handleDestinationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void searchForPlace("destination", destinationQuery);
  }

  function handleCitySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void searchForPlace("origin", cityQuery);
  }

  function handleCategoryClick(value: PlaceCategory) {
    routeRequestId.current += 1;
    setIsCalculating(false);
    setRoutes([]);
    setSelectedRouteId("");
    setDestinationQuery(value);
    setDestination(null);
    setSearchResults([]);
    setSearchError("");
    void searchNearbyCategory(value);
  }

  function handleCalculateClick() {
    if (!origin) {
      setLocationError("Choose your location or a starting city first.");
      return;
    }
    if (destination) {
      void calculateRoute(origin, destination);
      return;
    }
    void searchForPlace("destination", destinationQuery);
  }

  const activeRouteFeature = activeRoute
    ? {
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "LineString" as const,
          coordinates: activeRoute.coordinates,
        },
      }
    : null;

  return (
    <main className="waymark-app">
      <header className="app-header">
        <a className="wordmark" href="/" aria-label="Waymark home">
          <span className="wordmark-icon"><RouteIcon size={19} strokeWidth={2.2} /></span>
          <span>waymark</span>
          <span className="wordmark-beta">BETA</span>
        </a>

        <div className={`header-location${origin ? " is-set" : ""}`}>
          <span className="header-location-dot" />
          <span>{origin ? "STARTING POINT" : "LOCATION NOT SET"}</span>
          <span className="header-location-divider" />
          <MapPin size={13} />
          <span>{origin ? origin.label : "Choose where to start"}</span>
        </div>

        <span className="walk-mode"><Footprints size={14} /> WALK MODE</span>
      </header>

      <div className="planner-layout">
        <aside className="planner-sidebar">
          <div className="sidebar-intro">
            <p className="overline"><Footprints size={13} /> A BETTER WAY THERE</p>
            <h1>Find your way, <em>your way.</em></h1>
            <p className="intro-copy">
              A calmer walk to parks, shops, work, or anywhere around town.
            </p>
          </div>

          <section className="start-section" aria-labelledby="start-title">
            <div className="section-heading">
              <span className="step-number">01</span>
              <div><p className="field-label">STARTING POINT</p><h2 id="start-title">Where are you starting?</h2></div>
            </div>

            {origin ? (
              <div className="selected-origin">
                <span className="selected-origin-icon"><MapPin size={16} /></span>
                <span className="selected-origin-copy">
                  <strong>{origin.label}</strong>
                  <small>{origin.source === "device" ? "Current location · not saved" : "Chosen starting city"}</small>
                </span>
                <button
                  type="button"
                  className="change-origin"
                  onClick={() => {
                    locationRequestId.current += 1;
                    routeRequestId.current += 1;
                    setIsLocating(false);
                    setIsCalculating(false);
                    setOrigin(null);
                    setRoutes([]);
                    setSelectedRouteId("");
                    setStatusMessage("");
                    setRouteError("");
                  }}
                  aria-label="Change starting point"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <>
                <button className="use-location-button" type="button" onClick={handleUseLocation} disabled={isLocating}>
                  {isLocating ? <LoaderCircle size={17} className="spin" /> : <LocateFixed size={17} />}
                  <span>{isLocating ? "Finding your location…" : "Use my location"}</span>
                  {!isLocating && <ArrowRight size={16} className="button-arrow" />}
                </button>
                <p className="permission-note">Your browser asks first. Location is shared with the map and routing services to plan this walk; Waymark does not save it.</p>
              </>
            )}

            {locationError && <p className="inline-error" role="alert">{locationError}</p>}

            <button
              type="button"
              className="other-city-toggle"
              onClick={() => {
                locationRequestId.current += 1;
                placeSearchRequestId.current += 1;
                setIsLocating(false);
                setIsSearching(false);
                setOtherCityOpen((open) => !open);
                setLocationError("");
                setSearchError("");
                setSearchTarget(null);
                setSearchResults([]);
              }}
              aria-expanded={otherCityOpen}
            >
              <span>{origin ? "Or start somewhere else" : "Planning from another city?"}</span>
              <span>{otherCityOpen ? "Close" : "Enter a city"}</span>
            </button>

            {otherCityOpen && (
              <form className="city-search-form" onSubmit={handleCitySubmit}>
                <label className="input-label" htmlFor="city-search">START IN A DIFFERENT CITY</label>
                <div className="search-input-wrap">
                  <MapPin size={15} />
                  <input
                    id="city-search"
                    value={cityQuery}
                    onChange={(event) => {
                      placeSearchRequestId.current += 1;
                      setIsSearching(false);
                      setSearchResults([]);
                      setSearchTarget(null);
                      setCityQuery(event.target.value);
                      setSearchError("");
                    }}
                    placeholder="Type a city or address"
                    autoComplete="address-level2"
                  />
                  <button type="submit" disabled={isSearching}>
                    {isSearching && searchTarget === "origin" ? <LoaderCircle size={15} className="spin" /> : <Search size={15} />}
                    <span className="sr-only">Search starting city</span>
                  </button>
                </div>
                {searchTarget === "origin" && searchResults.length > 0 && (
                  <ul className="place-results" aria-label="Starting city search results">
                    {searchResults.map((place) => (
                      <li key={place.id}>
                        <button type="button" onClick={() => selectPlace("origin", place)}>
                          <MapPin size={14} />
                          <span><strong>{place.name}</strong><small>{place.description}</small></span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </form>
            )}
          </section>

          <section className="destination-section" aria-labelledby="destination-title">
            <div className="section-heading">
              <span className="step-number">02</span>
              <div><p className="field-label">DESTINATION</p><h2 id="destination-title">Where do you want to go?</h2></div>
            </div>

            {destination ? (
              <div className="selected-destination">
                <span className="destination-pin"><MapPin size={15} /></span>
                <span className="selected-destination-copy">
                  <strong>{destination.label}</strong>
                  <small>{destination.description}</small>
                </span>
                <button
                  type="button"
                  className="change-origin"
                  onClick={() => {
                    routeRequestId.current += 1;
                    setIsCalculating(false);
                    setDestination(null);
                    setDestinationQuery("");
                    setRoutes([]);
                    setSelectedRouteId("");
                    setStatusMessage("");
                  }}
                  aria-label="Change destination"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <form className="destination-search-form" onSubmit={handleDestinationSubmit}>
                <div className="destination-input-wrap">
                  <Search size={16} />
                  <input
                    value={destinationQuery}
                    onChange={(event) => {
                      placeSearchRequestId.current += 1;
                      routeRequestId.current += 1;
                      setIsSearching(false);
                      setIsCalculating(false);
                      setDestinationQuery(event.target.value);
                      setDestination(null);
                      setRoutes([]);
                      setSelectedRouteId("");
                      setSearchResults([]);
                      setSearchTarget(null);
                      setSearchError("");
                      setRouteError("");
                    }}
                    placeholder="Search any place or address"
                    aria-label="Search any place or address"
                    autoComplete="off"
                  />
                  <button type="submit" disabled={isSearching}>
                    {isSearching && searchTarget === "destination" ? <LoaderCircle size={15} className="spin" /> : <ArrowRight size={16} />}
                    <span className="sr-only">Search destination</span>
                  </button>
                </div>
                {searchTarget === "destination" && searchResults.length > 0 && (
                  <ul className="place-results" aria-label="Destination search results">
                    {searchResults.map((place) => (
                      <li key={place.id}>
                        <button type="button" onClick={() => selectPlace("destination", place)}>
                          <MapPin size={14} />
                          <span><strong>{place.name}</strong><small>{place.description}</small></span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </form>
            )}

            {!destination && (
              <div className="quick-destinations">
                <span className="quick-label">QUICK SEARCH</span>
                <div className="destination-chips">
                  {destinationTypes.map(({ label, value, Icon }) => (
                    <button className="destination-chip" key={label} type="button" onClick={() => handleCategoryClick(value)}>
                      <Icon size={13} /> {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <button
            type="button"
            className="find-route-button"
            onClick={handleCalculateClick}
            disabled={isCalculating || isLocating || isSearching}
          >
            {isCalculating ? <LoaderCircle size={16} className="spin" /> : <RouteIcon size={16} />}
            <span>{isCalculating ? "Finding your walk…" : "Find a walking route"}</span>
            {!isCalculating && <ArrowRight size={16} className="button-arrow" />}
          </button>

          {searchError && <p className="inline-error" role="alert">{searchError}</p>}
          {routeError && <p className="inline-error" role="alert">{routeError}</p>}
          {statusMessage && <p className="status-message" role="status">{statusMessage}</p>}

          <section className="route-results" aria-labelledby="route-results-title">
            <div className="route-results-heading">
              <div>
                <p className="overline results-overline">YOUR WALK</p>
                <h2 id="route-results-title">{routes.length ? "Choose your route" : "Routes will show here"}</h2>
              </div>
              {routes.length > 0 && <span className="route-count">{routes.length} option{routes.length === 1 ? "" : "s"}</span>}
            </div>

            {routes.length > 0 ? (
              <div className="route-options" role="radiogroup" aria-label="Walking route options">
                {routes.map((route) => {
                  const isSelected = route.id === activeRoute?.id;
                  return (
                    <button
                      className={`route-option${isSelected ? " active" : ""}`}
                      key={route.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setSelectedRouteId(route.id)}
                    >
                      <span className={`route-option-icon${route.isFastest ? " fastest" : ""}`}>
                        {route.isFastest ? <Navigation size={16} /> : <TreePine size={17} />}
                      </span>
                      <span className="route-option-main">
                        <span className="route-option-title"><strong>{route.name}</strong></span>
                        <span className="route-option-note">{route.note}</span>
                      </span>
                      <span className="route-option-meta">
                        <strong>{formatDuration(route.durationSeconds)}</strong>
                        <span>{formatDistance(route.distanceMeters)}</span>
                      </span>
                      <span className="route-selected-check">{isSelected && <Check size={12} />}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="routes-empty-copy">
                Allow location or choose a city, then search for a place to get a real walking route.
              </p>
            )}
          </section>

          <div className="quietness-note">
            <span className="quietness-icon"><ShieldCheck size={15} /></span>
            <p><strong>Quieter streets are an estimate.</strong><br />No live traffic or crowd data is used.</p>
          </div>

          <p className="privacy-note">
            Esri provides imagery; MapTiler provides street labels. Nominatim and Overpass search OpenStreetMap data, and Valhalla plans walking routes. Your chosen location is sent to these services for search and routing; Waymark does not save it.
          </p>
        </aside>

        <section className={`map-panel${origin ? " has-origin" : ""}`} aria-label="Walking route map">
          {origin ? (
            <MapGL
              key={`${origin.latitude}:${origin.longitude}`}
              ref={mapRef}
              initialViewState={{
                longitude: origin.longitude,
                latitude: origin.latitude,
                zoom: 14,
              }}
              mapStyle={mapStyle}
              style={{ width: "100%", height: "100%" }}
              cooperativeGestures
            >
              <NavigationControl position="top-right" showCompass={false} />
              {activeRouteFeature && (
                <Source id="walking-route" type="geojson" data={activeRouteFeature}>
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
          ) : (
            <div className="map-empty">
              <div className="map-empty-pattern" />
              <div className="map-empty-card">
                <span className="map-empty-icon"><LocateFixed size={21} /></span>
                <p className="map-empty-overline">YOUR WALK STARTS HERE</p>
                <h2>Choose a starting point</h2>
                <p>Use your current location or choose a city to see its real streets and walking routes.</p>
              </div>
            </div>
          )}

          {origin && (
            <div className="map-place-badge">
              <span className="map-place-icon"><MapPin size={15} /></span>
              <span><strong>{origin.label}</strong><small>{activeRoute ? `Walk to ${destination?.label ?? "destination"}` : "Starting area"}</small></span>
            </div>
          )}
          {activeRoute && (
            <div className="map-route-badge">
              <Clock3 size={15} />
              <strong>{formatDuration(activeRoute.durationSeconds)}</strong>
              <span>·</span>
              <span>{formatDistance(activeRoute.distanceMeters)}</span>
              {activeRoute.isFastest && <span className="map-fastest-tag">FASTEST</span>}
            </div>
          )}
          {isCalculating && (
            <div className="map-loading"><LoaderCircle size={16} className="spin" /> Calculating a walking route…</div>
          )}
          <div className="map-attribution-note">
            {mapTilerKey
              ? mapStyleError || "Imagery © Esri · Street labels © MapTiler · © OpenStreetMap contributors"
              : "Imagery © Esri · Add NEXT_PUBLIC_MAPTILER_KEY for MapTiler street labels"}
          </div>
        </section>
      </div>
    </main>
  );
}
