import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { NearbyQueryDto } from './dto/nearby-query.dto.js';
import { ServiceCategory } from './entities/service-category.entity.js';
import { ServiceLocation } from './entities/service-location.entity.js';

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
}

@Injectable()
export class DiscoveryService {
  constructor(
    @InjectRepository(ServiceLocation)
    private readonly locations: Repository<ServiceLocation>,
    @InjectRepository(ServiceCategory)
    private readonly categories: Repository<ServiceCategory>,
  ) {}

  async listCategories(): Promise<ServiceCategory[]> {
    return this.categories.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findNearby(query: NearbyQueryDto): Promise<NearbyServiceResult[]> {
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
        'category.slug AS "categorySlug"',
        'category.name AS "categoryName"',
        'category.icon AS "categoryIcon"',
        'ST_Y(location.location::geometry) AS lat',
        'ST_X(location.location::geometry) AS lng',
        'ST_Distance(location.location, ST_GeogFromText(:point)) AS "distanceMeters"',
      ])
      .where('location.isActive = true')
      .andWhere('category.isActive = true')
      .andWhere('ST_DWithin(location.location, ST_GeogFromText(:point), :radiusMeters)')
      .setParameters({ point, radiusMeters: query.radiusMeters })
      .orderBy('"distanceMeters"', 'ASC')
      .limit(query.limit);

    if (query.category) {
      qb.andWhere('category.slug = :category', { category: query.category });
    }

    const rows = await qb.getRawMany<{
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
      distanceMeters: string;
    }>();

    return rows.map((row) => ({
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
      distanceMeters: Math.round(Number(row.distanceMeters)),
    }));
  }
}
