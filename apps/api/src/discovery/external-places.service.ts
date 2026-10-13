import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, type EntityManager } from 'typeorm';
import type { NearbyQueryDto } from './dto/nearby-query.dto.js';
import type { ExternalPlace } from './external-places.types.js';
import { OverpassPlacesProvider } from './overpass-places.provider.js';

const SUCCESS_CACHE_MS = 5 * 60 * 1000;
const FAILURE_BACKOFF_MS = 30 * 1000;
const SOURCE_FRESHNESS_HOURS = 24;

interface RefreshState {
  expiresAt: number;
  inFlight?: Promise<void>;
}

@Injectable()
export class ExternalPlacesService {
  private readonly logger = new Logger(ExternalPlacesService.name);
  private readonly refreshes = new Map<string, RefreshState>();

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(OverpassPlacesProvider) private readonly overpass: OverpassPlacesProvider,
  ) {}

  async refreshNearby(query: NearbyQueryDto): Promise<void> {
    if (this.config.get<string>('EXTERNAL_PLACES_PROVIDER') !== 'overpass') return;

    const key = cacheKey(query.lat, query.lng, query.radiusMeters);
    const now = Date.now();
    const existing = this.refreshes.get(key);
    if (existing?.inFlight) {
      await existing.inFlight;
      return;
    }
    if (existing && existing.expiresAt > now) return;

    const inFlight = this.fetchAndPersist(query)
      .then(() => {
        this.refreshes.set(key, { expiresAt: Date.now() + SUCCESS_CACHE_MS });
      })
      .catch((error: unknown) => {
        this.refreshes.set(key, { expiresAt: Date.now() + FAILURE_BACKOFF_MS });
        this.logger.warn(`External places refresh failed; serving NearFind/cache data only: ${safeErrorMessage(error)}`);
      });

    this.refreshes.set(key, { expiresAt: now + SUCCESS_CACHE_MS, inFlight });
    await inFlight;
  }

  private async fetchAndPersist(query: NearbyQueryDto): Promise<void> {
    const maxRadius = this.config.get<number>('EXTERNAL_PLACES_MAX_RADIUS_METERS') ?? 10_000;
    const radiusMeters = Math.min(query.radiusMeters, maxRadius);
    const places = await this.overpass.searchNearby({ lat: query.lat, lng: query.lng, radiusMeters });
    if (places.length === 0) return;

    const categories = await this.dataSource.query<Array<{ id: string; slug: string }>>(
      'SELECT id, slug FROM service_categories WHERE is_active = true',
    );
    const categoryIds = new Map(categories.map((category) => [category.slug, category.id]));
    const expiresAt = new Date(Date.now() + SOURCE_FRESHNESS_HOURS * 60 * 60 * 1000);

    await this.dataSource.transaction(async (manager) => {
      for (const place of places) {
        const categoryId = categoryIds.get(place.categorySlug);
        if (!categoryId) continue;
        await persistPlace(manager, categoryId, place, expiresAt);
      }
    });
  }
}

async function persistPlace(
  manager: EntityManager,
  categoryId: string,
  place: ExternalPlace,
  expiresAt: Date,
): Promise<void> {
  await manager.query(
    `
      INSERT INTO service_locations (
        category_id, name, address, city, state, country_code, phone, website_url,
        location, rating, review_count, is_active,
        source_provider, source_external_id, source_attribution, source_last_seen_at, source_expires_at
      )
      SELECT
        $1::uuid, $2::varchar(180), $3::varchar(255), $4::varchar(120), $5::varchar(120), $6::varchar(2),
        $7::varchar(40), $8::varchar(2048),
        ST_SetSRID(ST_MakePoint($10::double precision, $9::double precision), 4326)::geography,
        0::numeric(3,2), 0::integer, true,
        'openstreetmap', $11::varchar(180), $12::varchar(180), now(), $13::timestamptz
      WHERE NOT EXISTS (
        SELECT 1
        FROM service_locations existing
        WHERE existing.source_provider = 'nearfind'
          AND existing.is_active = true
          AND ST_DWithin(
            existing.location,
            ST_SetSRID(ST_MakePoint($10::double precision, $9::double precision), 4326)::geography,
            60
          )
          AND lower(regexp_replace(existing.name, '[^[:alnum:]]', '', 'g')) =
              lower(regexp_replace($2::text, '[^[:alnum:]]', '', 'g'))
      )
      ON CONFLICT (source_provider, source_external_id)
        WHERE source_external_id IS NOT NULL
      DO UPDATE SET
        category_id = EXCLUDED.category_id,
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        country_code = EXCLUDED.country_code,
        phone = EXCLUDED.phone,
        website_url = EXCLUDED.website_url,
        location = EXCLUDED.location,
        is_active = true,
        source_attribution = EXCLUDED.source_attribution,
        source_last_seen_at = now(),
        source_expires_at = EXCLUDED.source_expires_at
    `,
    [
      categoryId,
      place.name,
      place.address,
      place.city,
      place.state,
      place.countryCode,
      place.phone,
      place.websiteUrl,
      place.lat,
      place.lng,
      place.externalId,
      place.attribution,
      expiresAt,
    ],
  );
}

function cacheKey(lat: number, lng: number, radiusMeters: number): string {
  return `${lat.toFixed(3)}:${lng.toFixed(3)}:${Math.ceil(radiusMeters / 1000)}`;
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.name === 'AbortError' ? 'request timed out' : error.message.slice(0, 240);
  return 'unknown external provider error';
}
