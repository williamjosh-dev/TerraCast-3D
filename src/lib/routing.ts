import type { Coordinates } from "./places";

export interface WalkingRoute {
  id: string;
  name: string;
  note: string;
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][];
  isFastest: boolean;
}

interface ValhallaTrip {
  summary?: {
    length?: number;
    time?: number;
  };
  legs?: Array<{
    shape?: string | {
      type?: string;
      coordinates?: [number, number][];
    };
  }>;
}

interface ValhallaResponse {
  trip?: ValhallaTrip;
  alternates?: Array<ValhallaTrip | { trip?: ValhallaTrip }>;
  error?: string;
}

function decodePolyline6(encoded: string): [number, number][] {
  const coordinates: [number, number][] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      if (index >= encoded.length) {
        throw new Error("The routing service returned an invalid route shape.");
      }
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    latitude += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      if (index >= encoded.length) {
        throw new Error("The routing service returned an invalid route shape.");
      }
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    longitude += result & 1 ? ~(result >> 1) : result >> 1;
    coordinates.push([longitude / 1_000_000, latitude / 1_000_000]);
  }

  return coordinates;
}

function getRouteCoordinates(trip: ValhallaTrip): [number, number][] {
  const shape = trip.legs?.[0]?.shape;
  if (typeof shape === "string") {
    return decodePolyline6(shape);
  }
  if (
    shape &&
    shape.type === "LineString" &&
    Array.isArray(shape.coordinates)
  ) {
    return shape.coordinates;
  }
  throw new Error("The routing service returned a route without map geometry.");
}

function isValhallaTrip(value: unknown): value is ValhallaTrip {
  if (!value || typeof value !== "object") return false;
  const candidate = value as ValhallaTrip;
  return (
    typeof candidate.summary?.length === "number" &&
    Number.isFinite(candidate.summary.length) &&
    typeof candidate.summary.time === "number" &&
    Number.isFinite(candidate.summary.time) &&
    Array.isArray(candidate.legs) &&
    candidate.legs.length > 0
  );
}

export async function calculateWalkingRoutes(
  origin: Coordinates,
  destination: Coordinates,
): Promise<WalkingRoute[]> {
  const request = {
    locations: [
      { lat: origin.latitude, lon: origin.longitude, type: "break" },
      { lat: destination.latitude, lon: destination.longitude, type: "break" },
    ],
    costing: "pedestrian",
    costing_options: {
      pedestrian: {
        use_living_streets: 0.9,
      },
    },
    alternates: 2,
    directions_options: { units: "kilometers" },
  };
  const params = new URLSearchParams({ json: JSON.stringify(request) });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  let response: Response;
  try {
    response = await fetch(`https://valhalla1.openstreetmap.de/route?${params}`, {
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Walking route calculation timed out. Please try again.");
    }
    throw new Error("Could not reach the walking route service. Please try again.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Walking route calculation failed (${response.status}).`);
  }

  const data = (await response.json()) as ValhallaResponse;
  if (data.error) {
    throw new Error(data.error);
  }

  const candidates = [
    data.trip,
    ...(data.alternates ?? []).map((alternate) =>
      "trip" in alternate ? alternate.trip : alternate,
    ),
  ].filter(isValhallaTrip);

  const routes = candidates
    .map((trip, index) => {
      const coordinates = getRouteCoordinates(trip);
      if (coordinates.length < 2) return null;

      const distanceMeters = Math.round((trip.summary?.length ?? 0) * 1000);
      const durationSeconds = Math.round(trip.summary?.time ?? 0);
      if (distanceMeters <= 0 || durationSeconds <= 0) return null;

      return {
        id: `walk-${index}`,
        name: index === 0 ? "Quieter-street preference" : "Alternative walk",
        note: index === 0 ? "Street preference, not live traffic" : "Another pedestrian route",
        distanceMeters,
        durationSeconds,
        coordinates,
        isFastest: false,
      };
    })
    .filter((route): route is NonNullable<typeof route> => route !== null);

  if (!routes.length) {
    throw new Error("No walking routes were found between those places.");
  }

  const fastestId = routes.reduce((best, route) =>
    route.durationSeconds < best.durationSeconds ? route : best,
  ).id;
  return routes.map((route) => ({ ...route, isFastest: route.id === fastestId }));
}