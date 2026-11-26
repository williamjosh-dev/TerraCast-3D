import type { Coordinates, PlaceResult } from "./places";

export type PlaceCategory = "park" | "shop" | "cafe" | "office";

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const SEARCH_RADIUS_METERS = 5_000;
const MAX_RESULTS = 30;
const categoryFilters: Record<PlaceCategory, string> = {
  park: '["leisure"~"park|garden"]',
  shop: '["shop"]',
  cafe: '["amenity"="cafe"]',
  office: '["office"]',
};
const resultCache = new Map<string, PlaceResult[]>();

function distanceSquared(a: Coordinates, b: Coordinates): number {
  const latitudeScale = Math.cos((a.latitude * Math.PI) / 180);
  const x = (a.longitude - b.longitude) * latitudeScale;
  const y = a.latitude - b.latitude;
  return x * x + y * y;
}

function toPlaceResult(element: OverpassElement): PlaceResult | null {
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  const tags = element.tags ?? {};
  const category = tags.amenity || tags.leisure || tags.shop || tags.office || "place";
  const name = tags.name?.trim() || tags.brand?.trim() || category;
  const description = [
    tags["addr:street"],
    tags["addr:suburb"],
    category,
  ].filter(Boolean).join(", ");

  return {
    id: `osm-${element.type}-${element.id}`,
    latitude,
    longitude,
    name,
    description,
  };
}

export async function searchNearbyPlaces(
  category: PlaceCategory,
  center: Coordinates,
): Promise<PlaceResult[]> {
  if (
    !Number.isFinite(center.latitude) ||
    !Number.isFinite(center.longitude) ||
    center.latitude < -90 ||
    center.latitude > 90 ||
    center.longitude < -180 ||
    center.longitude > 180
  ) {
    throw new Error("Choose a valid starting point before searching nearby.");
  }

  const cacheKey = `${category}:${center.latitude.toFixed(3)},${center.longitude.toFixed(3)}`;
  const cachedResults = resultCache.get(cacheKey);
  if (cachedResults) return cachedResults;

  const query = [
    "[out:json][timeout:20];",
    `(nwr(around:${SEARCH_RADIUS_METERS},${center.latitude},${center.longitude})${categoryFilters[category]};);`,
    `out center ${MAX_RESULTS};`,
  ].join("");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  let response: Response;
  try {
    response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: new URLSearchParams({ data: query }),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Nearby place search timed out. Please try again.");
    }
    throw new Error("Could not reach the OpenStreetMap Overpass service. Please try again.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Nearby place search failed (${response.status}). Please try again.`);
  }

  let data: OverpassResponse;
  try {
    data = (await response.json()) as OverpassResponse;
  } catch {
    throw new Error("The Overpass service returned an invalid response.");
  }
  if (!Array.isArray(data.elements)) {
    throw new Error("The Overpass service returned an invalid response.");
  }

  const origin = center;
  const results = data.elements
    .map(toPlaceResult)
    .filter((place): place is PlaceResult => place !== null)
    .sort((a, b) => distanceSquared(a, origin) - distanceSquared(b, origin))
    .slice(0, 10);
  resultCache.set(cacheKey, results);
  return results;
}