import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User, UserRole } from '../identity/entities/user.entity.js';
import { AccessService } from './access.service.js';
import {
  FeatureFlag,
  InspectionBooking,
  InspectionStatus,
  PropertyListing,
  PropertyMedia,
  PropertyStatus,
} from './entities.js';
import { StorageService } from './storage.service.js';

interface ProviderInspectionRow {
  id: string;
  property_listing_id: string;
  user_id: string;
  scheduled_at: Date;
  status: InspectionStatus;
  idempotency_key: string;
  created_at: Date;
}

interface NearbyServiceRow {
  id: string;
  name: string;
  address: string;
  city: string;
  category: string;
  distance_meters: number;
}

@Injectable()
export class PropertyService {
  constructor(
    @InjectRepository(PropertyListing) private readonly listings: Repository<PropertyListing>,
    @InjectRepository(PropertyMedia) private readonly media: Repository<PropertyMedia>,
    @InjectRepository(InspectionBooking) private readonly inspections: Repository<InspectionBooking>,
    @InjectRepository(FeatureFlag) private readonly flags: Repository<FeatureFlag>,
    private readonly dataSource: DataSource,
    private readonly access: AccessService,
    private readonly storage: StorageService,
  ) {}

  async listPublic(input: { city?: string; propertyType?: string; minPriceMinor?: number; maxPriceMinor?: number; limit: number }): Promise<PropertyListing[]> {
    await this.requireEnabled();
    const query = this.listings
      .createQueryBuilder('listing')
      .where('listing.status = :status', { status: PropertyStatus.PUBLISHED })
      .orderBy('listing.created_at', 'DESC')
      .limit(input.limit);
    if (input.city) query.andWhere('LOWER(listing.city) = LOWER(:city)', { city: input.city });
    if (input.propertyType) query.andWhere('listing.property_type = :propertyType', { propertyType: input.propertyType });
    if (input.minPriceMinor !== undefined) query.andWhere('listing.price_minor >= :minPrice', { minPrice: input.minPriceMinor });
    if (input.maxPriceMinor !== undefined) query.andWhere('listing.price_minor <= :maxPrice', { maxPrice: input.maxPriceMinor });
    return query.getMany();
  }

  async getPublic(id: string): Promise<PropertyListing & { media: PropertyMedia[]; nearbyServices: NearbyServiceRow[] }> {
    await this.requireEnabled();
    const listing = await this.listings.findOneBy({ id, status: PropertyStatus.PUBLISHED });
    if (!listing) throw new NotFoundException('Property listing not found');
    const media = await this.media.find({ where: { propertyListingId: id }, order: { createdAt: 'ASC' } });
    const nearbyServices = await this.nearbyServices(listing);
    return { ...listing, media, nearbyServices };
  }

  async createListing(
    user: User,
    input: {
      providerId?: string | null;
      title: string;
      description: string;
      address: string;
      city: string;
      priceMinor: number;
      currency: string;
      propertyType: string;
      lat: number;
      lng: number;
    },
  ): Promise<PropertyListing> {
    await this.requireEnabled();
    if (user.role !== UserRole.ADMIN) {
      if (!input.providerId) throw new ForbiddenException('Provider is required');
      await this.access.requireProvider(user, input.providerId);
    } else if (input.providerId) {
      await this.access.requireProvider(user, input.providerId, false);
    }
    const listing = await this.listings.save(
      this.listings.create({
        providerId: input.providerId ?? null,
        createdByUserId: user.id,
        title: input.title,
        description: input.description,
        address: input.address,
        city: input.city,
        priceMinor: input.priceMinor,
        currency: input.currency.toUpperCase(),
        propertyType: input.propertyType.toUpperCase(),
        lat: input.lat.toFixed(6),
        lng: input.lng.toFixed(6),
        status: PropertyStatus.DRAFT,
        version: 1,
      }),
    );
    await this.access.audit(user.id, 'property.listing.created', 'PropertyListing', listing.id, { providerId: listing.providerId });
    return listing;
  }

  async updateListing(
    user: User,
    id: string,
    version: number,
    input: Partial<Pick<PropertyListing, 'title' | 'description' | 'address' | 'city' | 'priceMinor' | 'propertyType'>>,
  ): Promise<PropertyListing> {
    const listing = await this.requireManagementAccess(user, id);
    if (listing.status === PropertyStatus.PUBLISHED && user.role !== UserRole.ADMIN) listing.status = PropertyStatus.DRAFT;
    const result = await this.listings.update(
      { id, version },
      {
        ...input,
        ...(input.propertyType ? { propertyType: input.propertyType.toUpperCase() } : {}),
        status: listing.status,
        version: version + 1,
      },
    );
    if ((result.affected ?? 0) !== 1) throw new ConflictException('Listing was modified by another request');
    await this.access.audit(user.id, 'property.listing.updated', 'PropertyListing', id, { previousVersion: version });
    return this.listings.findOneByOrFail({ id });
  }

  async addMedia(user: User, id: string, objectKey: string, mediaType: string): Promise<PropertyMedia> {
    await this.requireManagementAccess(user, id);
    this.storage.assertOwnedObjectKey(user.id, 'property', objectKey);
    return this.media.save(this.media.create({ propertyListingId: id, objectKey, mediaType }));
  }

  async moderate(user: User, id: string, status: PropertyStatus): Promise<PropertyListing> {
    this.access.requireAdmin(user);
    if (![PropertyStatus.PUBLISHED, PropertyStatus.REJECTED, PropertyStatus.DRAFT].includes(status)) {
      throw new ConflictException('Unsupported property moderation status');
    }
    const listing = await this.listings.findOneBy({ id });
    if (!listing) throw new NotFoundException('Property listing not found');
    listing.status = status;
    listing.version += 1;
    const saved = await this.listings.save(listing);
    await this.access.audit(user.id, 'property.listing.moderated', 'PropertyListing', id, { status });
    return saved;
  }

  async bookInspection(user: User, id: string, scheduledAt: Date, idempotencyKey: string): Promise<InspectionBooking> {
    await this.requireEnabled();
    const existing = await this.inspections.findOneBy({ userId: user.id, idempotencyKey });
    if (existing) return existing;
    const listing = await this.listings.findOneBy({ id, status: PropertyStatus.PUBLISHED });
    if (!listing) throw new NotFoundException('Property listing not found');
    if (scheduledAt <= new Date()) throw new ConflictException('Inspection must be scheduled in the future');
    return this.inspections.save(
      this.inspections.create({ propertyListingId: id, userId: user.id, scheduledAt, status: InspectionStatus.REQUESTED, idempotencyKey }),
    );
  }

  listMyInspections(userId: string): Promise<InspectionBooking[]> {
    return this.inspections.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 100 });
  }

  async listProviderListings(user: User, providerId: string): Promise<PropertyListing[]> {
    await this.access.requireProvider(user, providerId, false);
    return this.listings.find({ where: { providerId }, order: { createdAt: 'DESC' }, take: 200 });
  }

  async listProviderInspections(user: User, providerId: string): Promise<ProviderInspectionRow[]> {
    await this.access.requireProvider(user, providerId, false);
    return this.dataSource.query<ProviderInspectionRow[]>(
      `SELECT i.* FROM inspection_bookings i
       JOIN property_listings p ON p.id = i.property_listing_id
       WHERE p.provider_id = $1
       ORDER BY i.created_at DESC
       LIMIT 200`,
      [providerId],
    );
  }

  private async requireEnabled(): Promise<void> {
    const flag = await this.flags.findOneBy({ key: 'property_module' });
    if (!flag?.enabled) throw new NotFoundException('Property module is not enabled');
  }

  private async requireManagementAccess(user: User, id: string): Promise<PropertyListing> {
    const listing = await this.listings.findOneBy({ id });
    if (!listing) throw new NotFoundException('Property listing not found');
    if (user.role === UserRole.ADMIN) return listing;
    if (!listing.providerId || !(await this.access.isProviderOwner(user, listing.providerId))) {
      throw new ForbiddenException('Property listing ownership required');
    }
    return listing;
  }

  private nearbyServices(listing: PropertyListing): Promise<NearbyServiceRow[]> {
    return this.dataSource.query<NearbyServiceRow[]>(
      `SELECT sl.id, sl.name, sl.address, sl.city, sc.name AS category,
         ROUND(ST_Distance(sl.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography))::int AS distance_meters
       FROM service_locations sl
       JOIN service_categories sc ON sc.id = sl.category_id
       WHERE sl.is_active = true
         AND ST_DWithin(sl.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 5000)
       ORDER BY distance_meters ASC
       LIMIT 10`,
      [Number(listing.lng), Number(listing.lat)],
    );
  }
}
