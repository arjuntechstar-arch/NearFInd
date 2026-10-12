import { HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThanOrEqual, Repository } from 'typeorm';
import { ServiceLocation } from '../discovery/entities/service-location.entity.js';
import { User, UserRole } from '../identity/entities/user.entity.js';
import { AccessService } from './access.service.js';
import { EvConnector, FuelPriceObservation, RouteSession } from './entities.js';
import { ROUTE_PROVIDER, type RoutePoint, type RoutePreview } from './route-provider.js';

interface CorridorRow {
  id: string;
  name: string;
  address: string;
  city: string;
  category_id: string;
  corridor_distance_m: string;
  detour_proxy_m: string;
  fuel_type: string | null;
  price: string | null;
  currency: string | null;
  confidence: string | null;
  observed_at: Date | null;
}

@Injectable()
export class IntelligenceService {
  constructor(
    @InjectRepository(FuelPriceObservation) private readonly observations: Repository<FuelPriceObservation>,
    @InjectRepository(EvConnector) private readonly connectors: Repository<EvConnector>,
    @InjectRepository(RouteSession) private readonly sessions: Repository<RouteSession>,
    @InjectRepository(ServiceLocation) private readonly locations: Repository<ServiceLocation>,
    private readonly dataSource: DataSource,
    private readonly access: AccessService,
    @Inject(ROUTE_PROVIDER) private readonly routeProvider: { preview(start: RoutePoint, end: RoutePoint): RoutePreview },
  ) {}

  async addFuelObservation(
    user: User,
    input: { serviceLocationId: string; fuelType: string; price: number; currency: string; observedAt?: Date },
  ): Promise<FuelPriceObservation> {
    const location = await this.locations.findOneBy({ id: input.serviceLocationId, isActive: true });
    if (!location) throw new NotFoundException('Place not found');
    const since = new Date(Date.now() - 60 * 60 * 1000);
    if (await this.observations.count({ where: { observedByUserId: user.id, createdAt: MoreThanOrEqual(since) } }) >= 30) {
      throw new HttpException('Fuel observation rate limit reached', HttpStatus.TOO_MANY_REQUESTS);
    }
    const confidence = user.role === UserRole.ADMIN ? 0.95 : user.role === UserRole.PROVIDER ? 0.8 : 0.6;
    const observation = await this.observations.save(
      this.observations.create({
        serviceLocationId: input.serviceLocationId,
        observedByUserId: user.id,
        fuelType: input.fuelType.toUpperCase(),
        price: input.price.toFixed(2),
        currency: input.currency.toUpperCase(),
        confidence: confidence.toFixed(2),
        observedAt: input.observedAt ?? new Date(),
      }),
    );
    await this.access.audit(user.id, 'fuel.observation.created', 'FuelPriceObservation', observation.id, {
      serviceLocationId: observation.serviceLocationId,
      fuelType: observation.fuelType,
    });
    return observation;
  }

  listFuelObservations(serviceLocationId: string, fuelType?: string): Promise<FuelPriceObservation[]> {
    return this.observations.find({
      where: fuelType ? { serviceLocationId, fuelType: fuelType.toUpperCase() } : { serviceLocationId },
      order: { observedAt: 'DESC' },
      take: 100,
    });
  }

  async upsertEvConnector(
    user: User,
    input: { serviceLocationId: string; connectorType: string; powerKw: number; status: string },
  ): Promise<EvConnector> {
    const location = await this.locations.findOneBy({ id: input.serviceLocationId });
    if (!location || !location.providerId) throw new NotFoundException('Provider-backed place not found');
    await this.access.requireProvider(user, location.providerId);
    let connector = await this.connectors.findOneBy({
      serviceLocationId: input.serviceLocationId,
      connectorType: input.connectorType.toUpperCase(),
    });
    connector ??= this.connectors.create({ serviceLocationId: input.serviceLocationId });
    connector.connectorType = input.connectorType.toUpperCase();
    connector.powerKw = input.powerKw.toFixed(2);
    connector.status = input.status.toUpperCase();
    const saved = await this.connectors.save(connector);
    await this.access.audit(user.id, 'ev.connector.updated', 'EvConnector', saved.id, { status: saved.status });
    return saved;
  }

  listEvConnectors(serviceLocationId: string): Promise<EvConnector[]> {
    return this.connectors.find({ where: { serviceLocationId }, order: { powerKw: 'DESC' } });
  }

  async optimizeRoute(
    user: User,
    input: {
      start: RoutePoint;
      end: RoutePoint;
      corridorMeters: number;
      categoryId?: string | null;
      fuelType?: string | null;
    },
  ) {
    const preview = this.routeProvider.preview(input.start, input.end);
    const rows = (await this.dataSource.query(
      `WITH route AS (
         SELECT ST_MakeLine(
           ST_SetSRID(ST_MakePoint($1, $2), 4326),
           ST_SetSRID(ST_MakePoint($3, $4), 4326)
         ) AS line,
         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS start_point,
         ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography AS end_point
       )
       SELECT sl.id, sl.name, sl.address, sl.city, sl.category_id,
         ST_Distance(sl.location, route.line::geography) AS corridor_distance_m,
         GREATEST(0,
           ST_Distance(sl.location, route.start_point) + ST_Distance(sl.location, route.end_point) -
           ST_Distance(route.start_point, route.end_point)
         ) AS detour_proxy_m,
         fuel.fuel_type, fuel.price, fuel.currency, fuel.confidence, fuel.observed_at
       FROM service_locations sl
       CROSS JOIN route
       LEFT JOIN LATERAL (
         SELECT f.fuel_type, f.price, f.currency, f.confidence, f.observed_at
         FROM fuel_price_observations f
         WHERE f.service_location_id = sl.id
           AND ($7::text IS NULL OR f.fuel_type = UPPER($7::text))
         ORDER BY f.observed_at DESC
         LIMIT 1
       ) fuel ON true
       WHERE sl.is_active = true
         AND ST_DWithin(sl.location, route.line::geography, $5)
         AND ($6::uuid IS NULL OR sl.category_id = $6::uuid)
       ORDER BY detour_proxy_m ASC
       LIMIT 20`,
      [input.start.lng, input.start.lat, input.end.lng, input.end.lat, input.corridorMeters, input.categoryId ?? null, input.fuelType ?? null],
    )) as CorridorRow[];

    const candidates = rows.map((row) => {
      const detourMeters = Number(row.detour_proxy_m);
      const corridorDistanceMeters = Number(row.corridor_distance_m);
      const price = row.price === null ? null : Number(row.price);
      const freshnessHours = row.observed_at ? Math.max(0, (Date.now() - new Date(row.observed_at).getTime()) / 3_600_000) : null;
      const pricePenalty = price === null ? 0 : price * 5;
      const freshnessPenalty = freshnessHours === null ? 500 : Math.min(1000, freshnessHours * 10);
      return {
        placeId: row.id,
        name: row.name,
        address: row.address,
        city: row.city,
        categoryId: row.category_id,
        corridorDistanceMeters: Math.round(corridorDistanceMeters),
        detourProxyMeters: Math.round(detourMeters),
        score: Math.round(detourMeters * 0.7 + corridorDistanceMeters * 0.3 + pricePenalty + freshnessPenalty),
        fuel: row.fuel_type
          ? {
              type: row.fuel_type,
              price,
              currency: row.currency,
              confidence: row.confidence === null ? null : Number(row.confidence),
              observedAt: row.observed_at,
              freshnessHours: freshnessHours === null ? null : Number(freshnessHours.toFixed(1)),
            }
          : null,
      };
    });

    const summary = { preview, corridorMeters: input.corridorMeters, candidates };
    const session = await this.sessions.save(
      this.sessions.create({
        userId: user.id,
        startLatRounded: input.start.lat.toFixed(3),
        startLngRounded: input.start.lng.toFixed(3),
        endLatRounded: input.end.lat.toFixed(3),
        endLngRounded: input.end.lng.toFixed(3),
        provider: preview.provider,
        summaryJson: summary,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
    );
    return { routeSessionId: session.id, ...summary };
  }

  listRouteSessions(userId: string): Promise<RouteSession[]> {
    return this.sessions.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 20 });
  }
}
