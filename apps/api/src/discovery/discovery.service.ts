import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { NearbyQueryDto } from './dto/nearby-query.dto.js';
import { ServiceCategory } from './entities/service-category.entity.js';
import { ServiceLocation } from './entities/service-location.entity.js';
import { ExternalPlacesService } from './external-places.service.js';

export interface NearbyServiceResult {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  countryCode: string;
  rating: number;
  reviewCount: number;
  category: { slug: string; name: string; icon: string };
  coordinates: { lat: number; lng: number };
  distanceMeters: number;
  sourceProvider: string;
  sourceAttribution: string | null;
}

export type PlaceDetailResult = Omit<NearbyServiceResult, 'distanceMeters'>;

interface RawPlaceRow {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  countryCode: string;
  rating: string;
  reviewCount: number;
  categorySlug: string;
  categoryName: string;
  categoryIcon: string;
  lat: string;
  lng: string;
  sourceProvider: string;
  sourceAttribution: string | null;
}

@Injectable()
export class DiscoveryService {
  constructor(
    @InjectRepository(ServiceLocation)
    private readonly locations: Repository<ServiceLocation>,
    @InjectRepository(ServiceCategory)
    private readonly categories: Repository<ServiceCategory>,
    @Inject(ExternalPlacesService)
    private readonly externalPlaces: ExternalPlacesService,
  ) {}

  async listCategories(): Promise<ServiceCategory[]> {
    return this.categories.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findNearby(query: NearbyQueryDto): Promise<NearbyServiceResult[]> {
    await this.externalPlaces.refreshNearby(query);

    const point = `SRID=4326;POINT(${query.lng} ${query.lat})`;
    const qb = this.locations
      .createQueryBuilder('location')
      .innerJoin('location.category', 'category')
      .select([
        'location.id AS id',
        'location.name AS name',
        'location.address AS address',
        'location.city AS city',
        'location.state AS state',
        'location.countryCode AS "countryCode"',
        'location.rating AS rating',
        'location.reviewCount AS "reviewCount"',
        'location.sourceProvider AS "sourceProvider"',
        'location.sourceAttribution AS "sourceAttribution"',
        'category.slug AS "categorySlug"',
        'category.name AS "categoryName"',
        'category.icon AS "categoryIcon"',
        'ST_Y(location.location::geometry) AS lat',
        'ST_X(location.location::geometry) AS lng',
        'ST_Distance(location.location, ST_GeogFromText(:point)) AS "distanceMeters"',
      ])
      .where('location.isActive = true')
      .andWhere('category.isActive = true')
      .andWhere("(location.source_provider = 'nearfind' OR location.source_expires_at IS NULL OR location.source_expires_at > CURRENT_TIMESTAMP)")
      .andWhere('ST_DWithin(location.location, ST_GeogFromText(:point), :radiusMeters)')
      .setParameters({ point, radiusMeters: query.radiusMeters })
      .orderBy('"distanceMeters"', 'ASC')
      .addOrderBy('location.id', 'ASC')
      .offset(query.offset)
      .limit(query.limit);

    if (query.category) {
      qb.andWhere('category.slug = :category', { category: query.category });
    }

    const rows = await qb.getRawMany<RawPlaceRow & { distanceMeters: string }>();
    return rows.map((row) => ({ ...mapPlaceRow(row), distanceMeters: Math.round(Number(row.distanceMeters)) }));
  }

  async getPlace(id: string): Promise<PlaceDetailResult> {
    const row = await this.locations
      .createQueryBuilder('location')
      .innerJoin('location.category', 'category')
      .select([
        'location.id AS id',
        'location.name AS name',
        'location.address AS address',
        'location.city AS city',
        'location.state AS state',
        'location.countryCode AS "countryCode"',
        'location.rating AS rating',
        'location.reviewCount AS "reviewCount"',
        'location.sourceProvider AS "sourceProvider"',
        'location.sourceAttribution AS "sourceAttribution"',
        'category.slug AS "categorySlug"',
        'category.name AS "categoryName"',
        'category.icon AS "categoryIcon"',
        'ST_Y(location.location::geometry) AS lat',
        'ST_X(location.location::geometry) AS lng',
      ])
      .where('location.id = :id', { id })
      .andWhere('location.isActive = true')
      .andWhere('category.isActive = true')
      .getRawOne<RawPlaceRow>();

    if (!row) throw new NotFoundException('Service location not found');
    return mapPlaceRow(row);
  }
}

function mapPlaceRow(row: RawPlaceRow): PlaceDetailResult {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    city: row.city,
    state: row.state,
    countryCode: row.countryCode,
    rating: Number(row.rating),
    reviewCount: Number(row.reviewCount),
    category: { slug: row.categorySlug, name: row.categoryName, icon: row.categoryIcon },
    coordinates: { lat: Number(row.lat), lng: Number(row.lng) },
    sourceProvider: row.sourceProvider,
    sourceAttribution: row.sourceAttribution,
  };
}
