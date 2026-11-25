export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface Landmark {
  id: string;
  name: string;
  category: string;
  icon: string;
  lat: number;
  lon: number;
  distanceMeters: number;
}

export interface BuildingPolygon {
  id: string;
  points: [number, number][]; // [x, z] local meters relative to center
  height: number;
}

export interface RouteOption {
  id: string;
  label: string;
  distanceMeters: number;
  durationMinutes: number;
  isRecommended: boolean; // Quiet/least-traffic or fastest path
  points: [number, number][]; // [x, z] local meters
}

// Convert GPS (lat, lon) to local 3D diorama coordinates (1 unit = 100 meters)
export function gpsToLocal(
  lat: number,
  lon: number,
  centerLat: number,
  centerLon: number
): [number, number] {
  const metersPerDegLat = 110540;
  const metersPerDegLon = 111320 * Math.cos((centerLat * Math.PI) / 180);
  const x = ((lon - centerLon) * metersPerDegLon) / 100;
  const z = -((lat - centerLat) * metersPerDegLat) / 100;
  return [x, z];
}

// Get exact Esri World Imagery satellite tile URL for a GPS point (Free, no key)
export function getSatelliteTileUrl(lat: number, lon: number, zoom = 16): string {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return `https://arcgisonline.com{zoom}/${y}/${x}`;
}

// 1. Friendly neighborhood name from GPS
export async function getNeighborhoodName(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://openstreetmap.org{lat}&lon=${lon}`
    );
    const data = await res.json();
    const addr = data.address || {};
    return (
      addr.suburb ||
      addr.neighbourhood ||
      addr.town ||
      addr.city ||
      addr.village ||
      "Your Neighborhood"
    );
  } catch {
    return "Your Neighborhood";
  }
}
// 2. Fetch nearby shops, parks, stations, cafes + 3D buildings in one Overpass call
export async function fetchLocalAreaData(
  centerLat: number,
  centerLon: number
): Promise<{ landmarks: Landmark[]; buildings: BuildingPolygon[] }> {
  const query = `
    [out:json][timeout:15];
    (
      node(around:1200,${centerLat},${centerLon})["name"]["amenity"];
      node(around:1200,${centerLat},${centerLon})["name"]["shop"];
      node(around:1200,${centerLat},${centerLon})["name"]["leisure"="park"];
      node(around:1200,${centerLat},${centerLon})["name"]["railway"="station"];
      way(around:550,${centerLat},${centerLon})["building"];
    );
    out body;
    >;
    out skel qt;
  `;

  const res = await fetch("https://overpass-api.de", {
    method: "POST",
    body: query
  });
  const data = await res.json();
  const elements = data.elements || [];

  const nodeMap = new Map<number, { lat: number; lon: number }>();
  const landmarks: Landmark[] = [];
  const buildings: BuildingPolygon[] = [];

  for (const el of elements) {
    if (el.type === "node") {
      nodeMap.set(el.id, { lat: el.lat, lon: el.lon });

      if (el.tags?.name && landmarks.length < 10) {
        const { category, icon } = classifyLandmark(el.tags);
        const [lx, lz] = gpsToLocal(el.lat, el.lon, centerLat, centerLon);
        const dist = Math.round(Math.hypot(lx * 100, lz * 100));
        if (dist > 60) {
          landmarks.push({
            id: String(el.id),
            name: el.tags.name,
            category,
            icon,
            lat: el.lat,
            lon: el.lon,
            distanceMeters: dist,
          });
        }
      }
    }
  }

  for (const el of elements) {
    if (el.type === "way" && el.tags?.building && Array.isArray(el.nodes)) {
      const pts: [number, number][] = [];
      for (const nodeId of el.nodes) {
        const coords = nodeMap.get(nodeId);
        if (coords) {
          pts.push(gpsToLocal(coords.lat, coords.lon, centerLat, centerLon));
        }
      }
      if (pts.length >= 3) {
        const levels = Number(el.tags["building:levels"]) || 2;
        const rawHeight = Number(el.tags.height) || levels * 3.5;
        buildings.push({
          id: String(el.id),
          points: pts,
          height: Math.min(2.2, Math.max(0.18, rawHeight / 45)), // Scaled for diorama
        });
      }
    }
  }

  landmarks.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return { landmarks: landmarks.slice(0, 6), buildings };
}

function classifyLandmark(tags: Record<string, string>): { category: string; icon: string } {
  if (tags.leisure === "park") return { category: "Park", icon: "🌳" };
  if (tags.railway === "station") return { category: "Station", icon: "🚉" };
  if (tags.amenity === "cafe" || tags.amenity === "restaurant")
    return { category: "Food & Cafe", icon: "☕" };
  if (tags.amenity === "pharmacy" || tags.amenity === "hospital")
    return { category: "Health", icon: "🏥" };
  if (tags.shop) return { category: "Local Shop", icon: "🛒" };
  return { category: "Landmark", icon: "📍" };
}

// 3. Fetch alternative local pathways via OSRM (Free, no API key)
export async function fetchLocalRoutes(
  start: GeoPoint,
  end: GeoPoint
): Promise<RouteOption[]> {
  const url = `https://project-osrm.org{start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson&alternatives=true`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.routes?.length) return [];

  return data.routes.slice(0, 2).map((route: any, idx: number) => {
    const coords: [number, number][] = route.geometry.coordinates.map(
      ([lon, lat]: [number, number]) => gpsToLocal(lat, lon, start.lat, start.lon)
    );
    return {
      id: `route-${idx}`,
      label: idx === 0 ? "Least Traffic / Direct Path" : "Alternate Local Lane",
      distanceMeters: Math.round(route.distance),
      durationMinutes: Math.max(1, Math.round(route.duration / 60)),
      isRecommended: idx === 0,
      points: coords,
    };
  });
}
