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
