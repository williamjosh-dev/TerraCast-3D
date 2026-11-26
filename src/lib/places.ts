export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface PlaceResult extends Coordinates {
  id: string;
  name: string;
  description: string;
}

interface NominatimPlace {
  place_id: number | string;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  type?: string;
}

interface NominatimReverseResult {
  display_name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    suburb?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org";
const MIN_REQUEST_INTERVAL_MS = 1_100;
const cache = new Map<string, unknown>();
let requestQueue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

async function requestNominatim<T>(url: string): Promise<T> {
  const cached = cache.get(url);
  if (cached) return cached as T;

  const request = requestQueue.then(async () => {
    const delay = Math.max(0, MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt));
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    lastRequestAt = Date.now();
    const response = await fetch(url, {
      headers: { "Accept-Language": "en" },
    });
    if (!response.ok) {
      throw new Error(`Place lookup failed (${response.status}). Please try again.`);
    }

    const result = (await response.json()) as T;
    cache.set(url, result);
    return result;
  });

  requestQueue = request.then(() => undefined, () => undefined);
  return request;
}

function toPlaceResult(place: NominatimPlace): PlaceResult | null {
  const latitude = Number(place.lat);
  const longitude = Number(place.lon);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    !place.display_name
  ) {
    return null;
  }

  const description = place.display_name;
  return {
    id: String(place.place_id),
    latitude,
    longitude,
    name: place.name?.trim() || description.split(",")[0].trim(),
    description,
  };
}

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const params = new URLSearchParams({
    q: trimmedQuery,
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
  });
  const results = await requestNominatim<NominatimPlace[]>(
    `${NOMINATIM_URL}/search?${params.toString()}`,
  );
  return results.map(toPlaceResult).filter((place): place is PlaceResult => place !== null);
}

export async function reverseGeocode(coordinates: Coordinates): Promise<string> {
  const params = new URLSearchParams({
    lat: String(coordinates.latitude),
    lon: String(coordinates.longitude),
    format: "jsonv2",
    addressdetails: "1",
  });
  const result = await requestNominatim<NominatimReverseResult>(
    `${NOMINATIM_URL}/reverse?${params.toString()}`,
  );

  const address = result.address;
  const city = address?.city || address?.town || address?.village || address?.municipality;
  const region = address?.state || address?.county;
  const label = [city || address?.suburb, region, address?.country].filter(Boolean).join(", ");
  if (label) return label;
  if (result.display_name) return result.display_name;
  throw new Error("Your location was found, but its place name is unavailable.");
}