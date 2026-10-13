import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { ExternalPlace, ExternalPlacesSearch } from './external-places.types.js';

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const overpassElementSchema = z.object({
  type: z.enum(['node', 'way', 'relation']),
  id: z.number().int(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  center: z.object({ lat: z.number(), lon: z.number() }).optional(),
  tags: z.record(z.string(), z.string()).optional(),
});

const overpassResponseSchema = z.object({ elements: z.array(overpassElementSchema) });

type SupportedCategory = ExternalPlace['categorySlug'];

const ATTRIBUTION = '© OpenStreetMap contributors';
const MAX_RESULTS = 2_000;
const REQUEST_TIMEOUT_MS = 8_000;

@Injectable()
export class OverpassPlacesProvider {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async searchNearby(search: ExternalPlacesSearch): Promise<ExternalPlace[]> {
    const endpoint = this.config.get<string>('OVERPASS_API_URL') ?? 'https://overpass-api.de/api/interpreter';
    const userAgent = this.config.get<string>('EXTERNAL_PLACES_USER_AGENT') ?? 'NearFind-development/0.1';
    const defaultCountry = (this.config.get<string>('EXTERNAL_PLACES_DEFAULT_COUNTRY') ?? 'IN').toUpperCase();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': userAgent,
        },
        body: new URLSearchParams({ data: buildOverpassQuery(search) }).toString(),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Overpass request failed with status ${response.status}`);
      const parsed = overpassResponseSchema.parse(await response.json());
      return parsed.elements
        .slice(0, MAX_RESULTS)
        .map((element) => mapOverpassElement(element, defaultCountry))
        .filter((place): place is ExternalPlace => place !== null);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function buildOverpassQuery(search: ExternalPlacesSearch): string {
  const radius = Math.max(100, Math.min(Math.round(search.radiusMeters), 20_000));
  const around = `around:${radius},${search.lat},${search.lng}`;
  return `[out:json][timeout:12][maxsize:67108864];\n(\n` +
    `nwr(${around})["amenity"="fuel"];\n` +
    `nwr(${around})["amenity"="charging_station"];\n` +
    `nwr(${around})["amenity"="atm"];\n` +
    `nwr(${around})["amenity"="hospital"];\n` +
    `nwr(${around})["amenity"="clinic"];\n` +
    `nwr(${around})["amenity"="bank"];\n` +
    `nwr(${around})["amenity"="pharmacy"];\n` +
    `nwr(${around})["shop"="car_repair"];\n` +
    `nwr(${around})["craft"="car_repair"];\n` +
    `);\nout center tags;`;
}

export function mapOverpassElement(element: OverpassElement, defaultCountry = 'IN'): ExternalPlace | null {
  const coordinates = element.type === 'node'
    ? element.lat !== undefined && element.lon !== undefined
      ? { lat: element.lat, lng: element.lon }
      : null
    : element.center
      ? { lat: element.center.lat, lng: element.center.lon }
      : null;
  if (!coordinates) return null;

  const tags = element.tags ?? {};
  const categorySlug = categoryFromTags(tags);
  if (!categorySlug) return null;

  const name = firstNonEmpty(tags.name, tags.brand, tags.operator, fallbackName(categorySlug));
  const address = buildAddress(tags, name);
  const city = firstNonEmpty(tags['addr:city'], tags['addr:town'], tags['addr:village'], tags['addr:place'], '');
  const state = firstNonEmpty(tags['addr:state'], tags['addr:province'], '');
  const countryCode = firstNonEmpty(tags['addr:country'], defaultCountry).slice(0, 2).toUpperCase();
  const phone = nullableString(firstNonEmpty(tags['contact:phone'], tags.phone, ''));
  const websiteUrl = nullableString(firstNonEmpty(tags['contact:website'], tags.website, ''));

  return {
    provider: 'openstreetmap',
    externalId: `${element.type}/${element.id}`,
    categorySlug,
    name,
    address,
    city,
    state,
    countryCode,
    phone,
    websiteUrl,
    lat: coordinates.lat,
    lng: coordinates.lng,
    attribution: ATTRIBUTION,
  };
}

function categoryFromTags(tags: Record<string, string>): SupportedCategory | null {
  if (tags.amenity === 'fuel' || tags.amenity === 'charging_station') return 'fuel';
  if (tags.amenity === 'atm') return 'atm';
  if (tags.amenity === 'hospital' || tags.amenity === 'clinic') return 'hospital';
  if (tags.amenity === 'bank') return 'bank';
  if (tags.amenity === 'pharmacy') return 'pharmacy';
  if (tags.shop === 'car_repair' || tags.craft === 'car_repair') return 'mechanic';
  return null;
}

function fallbackName(category: SupportedCategory): string {
  const labels: Record<SupportedCategory, string> = {
    fuel: 'Fuel or EV service',
    atm: 'ATM',
    hospital: 'Emergency care',
    bank: 'Bank',
    mechanic: 'Vehicle repair',
    pharmacy: 'Pharmacy',
  };
  return labels[category];
}

function buildAddress(tags: Record<string, string>, name: string): string {
  const full = firstNonEmpty(tags['addr:full'], '');
  if (full) return full.slice(0, 255);
  const street = firstNonEmpty(tags['addr:street'], tags['addr:place'], '');
  const house = firstNonEmpty(tags['addr:housenumber'], '');
  const locality = firstNonEmpty(tags['addr:suburb'], tags['addr:city'], tags['addr:town'], tags['addr:village'], '');
  const parts = [house, street, locality].filter((part) => part.length > 0);
  return (parts.length > 0 ? parts.join(', ') : `${name} · OpenStreetMap location`).slice(0, 255);
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

function nullableString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
