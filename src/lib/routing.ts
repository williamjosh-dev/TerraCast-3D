import type { Coordinates } from "./places";

export interface WalkingRoute {
  id: string;
  name: string;
  note: string;
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][];
  isFastest: boolean;
  quietEstimateUnavailable?: boolean;
}

type RouteCandidate = Omit<WalkingRoute, "name" | "note" | "isFastest">;

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

export function formatWalkDuration(seconds: number): string {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

async function fetchValhallaRoute(request: object): Promise<ValhallaResponse> {
  const params = new URLSearchParams({ json: JSON.stringify(request) });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  let response: Response;
  try {
    response = await fetch(`https://valhalla1.openstreetmap.de/route?${params}`, {
      signal: controller.signal,
    });
  } catch {
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
  return data;
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
  const baseRequest = {
    locations: [
      { lat: origin.latitude, lon: origin.longitude, type: "break" },
      { lat: destination.latitude, lon: destination.longitude, type: "break" },
    ],
    costing: "pedestrian",
    alternates: 2,
    directions_options: { units: "kilometers" },
  };
  const quietRequest = {
    ...baseRequest,
    alternates: 0,
    costing_options: {
      pedestrian: {
        use_living_streets: 1,
      },
    },
  };
  const [data, quietResult] = await Promise.all([
    fetchValhallaRoute(baseRequest),
    fetchValhallaRoute(quietRequest).then(
      (quietData) => ({ quietData }),
      (error: unknown) => ({ error }),
    ),
  ]);

  const candidates = [
    data.trip,
    ...(data.alternates ?? []).map((alternate) =>
      "trip" in alternate ? alternate.trip : alternate,
    ),
  ].filter(isValhallaTrip);

  const routes = candidates.reduce<RouteCandidate[]>((validRoutes, trip, index) => {
    const coordinates = getRouteCoordinates(trip);
    if (coordinates.length < 2) return validRoutes;

    const distanceMeters = Math.round((trip.summary?.length ?? 0) * 1000);
    const durationSeconds = Math.round(trip.summary?.time ?? 0);
    if (distanceMeters <= 0 || durationSeconds <= 0) return validRoutes;

    validRoutes.push({
      id: `walk-${index}`,
      distanceMeters,
      durationSeconds,
      coordinates,
    });
    return validRoutes;
  }, []);

  if (!routes.length) {
    throw new Error("No walking routes were found between those places.");
  }

  let quietEstimateUnavailable = "error" in quietResult;
  if ("error" in quietResult) {
    console.warn("Could not compare a living-street route:", quietResult.error);
  } else {
    try {
      const { quietData } = quietResult;
      const quietTrip = [quietData.trip, ...(quietData.alternates ?? [])
        .map((alternate) => "trip" in alternate ? alternate.trip : alternate)]
        .find(isValhallaTrip);

      if (!quietTrip) {
        quietEstimateUnavailable = true;
      } else {
        const coordinates = getRouteCoordinates(quietTrip);
        const geometryKey = (points: [number, number][]) =>
          points.map(([longitude, latitude]) => `${longitude.toFixed(5)},${latitude.toFixed(5)}`).join(";");
        const quietGeometry = geometryKey(coordinates);
        const duplicatesExisting = routes.some(
          (route) => geometryKey(route.coordinates) === quietGeometry,
        );
        const distanceMeters = Math.round((quietTrip.summary?.length ?? 0) * 1000);
        const durationSeconds = Math.round(quietTrip.summary?.time ?? 0);

        if (!duplicatesExisting && coordinates.length >= 2 && distanceMeters > 0 && durationSeconds > 0) {
          routes.push({
            id: "walk-quieter",
            distanceMeters,
            durationSeconds,
            coordinates,
          });
        }
      }
    } catch (error) {
      quietEstimateUnavailable = true;
      console.warn("Could not compare a living-street route:", error);
    }
  }

  const fastest = routes.reduce((best, route) =>
    route.durationSeconds < best.durationSeconds ? route : best,
  );
  const shortest = routes.reduce((best, route) =>
    route.distanceMeters < best.distanceMeters ? route : best,
  );
  const alternatives = routes.filter(
    (route) => route.id !== fastest.id && route.id !== shortest.id,
  );

  return routes.map((route) => {
    const isFastest = route.id === fastest.id;
    const isShortest = route.id === shortest.id;
    const isQuietAlternative = route.id === "walk-quieter";
    const extraMinutes =
      route.durationSeconds === fastest.durationSeconds
        ? 0
        : Math.max(1, Math.round((route.durationSeconds - fastest.durationSeconds) / 60));
    const distanceDifference = route.distanceMeters - fastest.distanceMeters;
    const formattedDistanceDifference = `${Math.abs(distanceDifference)} m`;
    const timeDifference =
      extraMinutes === 0 ? "About the same time" : `${formatWalkDuration(extraMinutes * 60)} longer`;
    const alternativeIndex = alternatives.findIndex(
      (alternative) => alternative.id === route.id,
    );
    const hasMatchingAlternative = alternatives.some(
      (alternative) =>
        alternative.id !== route.id &&
        Math.max(0, Math.round((alternative.durationSeconds - fastest.durationSeconds) / 60)) === extraMinutes,
    );

    if (isFastest && isShortest) {
      return {
        ...route,
        name: isQuietAlternative ? "Fastest, quieter streets" : "Fastest, shortest route",
        note: "The least time and distance",
        isFastest,
        quietEstimateUnavailable,
      };
    }

    if (isFastest) {
      const shorterBy = route.distanceMeters - shortest.distanceMeters;
      return {
        ...route,
        name: isQuietAlternative ? "Fastest, quieter streets" : "Fastest route",
        note: isQuietAlternative
          ? "Also prefers mapped living streets"
          : shorterBy > 0
            ? `The shortest route is ${shorterBy} m shorter`
            : "Same distance as the shortest route",
        isFastest,
        quietEstimateUnavailable,
      };
    }

    if (isQuietAlternative) {
      return {
        ...route,
        name: "Quieter streets (estimate)",
        note: `Prefers mapped living streets · ${timeDifference.toLowerCase()}`,
        isFastest,
        quietEstimateUnavailable,
      };
    }

    if (isShortest) {
      return {
        ...route,
        name: "Shortest route",
        note: `${timeDifference} · saves ${fastest.distanceMeters - route.distanceMeters} m`,
        isFastest,
        quietEstimateUnavailable,
      };
    }

    const distanceNote =
      distanceDifference > 0
        ? `${formattedDistanceDifference} further than the fastest`
        : `${formattedDistanceDifference} less walking than the fastest`;

    return {
      ...route,
      name: `${timeDifference}${hasMatchingAlternative ? ` · route ${alternativeIndex + 1}` : ""}`,
      note: distanceNote,
      isFastest,
      quietEstimateUnavailable,
    };
  });
}