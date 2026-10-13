export interface NearbyService {
  id: string;
  name: string;
  address: string;
  city: string;
  rating: number;
  reviewCount: number;
  distanceMeters: number;
  category: { slug: string; name: string; icon: string };
}

const PAGE_SIZE = 100;
const MAX_OFFSET = 10_000;

export async function fetchAllNearbyServices(
  apiBaseUrl: string,
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<NearbyService[]> {
  const byId = new Map<string, NearbyService>();

  for (let offset = 0; offset <= MAX_OFFSET; offset += PAGE_SIZE) {
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      radiusMeters: '10000',
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    const response = await fetch(`${apiBaseUrl}/discovery/nearby?${params.toString()}`, {
      cache: 'no-store',
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) throw new Error('Unable to load nearby services');
    const page = (await response.json()) as NearbyService[];
    for (const service of page) byId.set(service.id, service);
    if (page.length < PAGE_SIZE) return [...byId.values()];
  }

  throw new Error('Nearby result set exceeded the supported pagination window. Narrow the search radius.');
}

export function movedAtLeastMeters(
  previous: { lat: number; lng: number } | null,
  next: { lat: number; lng: number },
  thresholdMeters: number,
): boolean {
  if (!previous) return true;
  const earthRadiusMeters = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const lat1 = toRadians(previous.lat);
  const lat2 = toRadians(next.lat);
  const deltaLat = lat2 - lat1;
  const deltaLng = toRadians(next.lng - previous.lng);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  const distance = 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return distance >= thresholdMeters;
}
