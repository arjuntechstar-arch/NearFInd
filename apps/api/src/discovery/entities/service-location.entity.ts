import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { ServiceCategory } from './service-category.entity.js';

@Entity({ name: 'service_locations' })
export class ServiceLocation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'category_id' })
  categoryId!: string;

  @ManyToOne('ServiceCategory', 'locations', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category!: ServiceCategory;

  @Column({ type: 'uuid', name: 'provider_id', nullable: true })
  providerId!: string | null;

  @Column({ type: 'varchar', length: 180 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 255 })
  address!: string;

  @Column({ type: 'varchar', length: 120 })
  city!: string;

  @Column({ type: 'varchar', length: 120 })
  state!: string;

  @Column({ type: 'varchar', length: 2, name: 'country_code', default: 'IN' })
  countryCode!: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 2048, name: 'website_url', nullable: true })
  websiteUrl!: string | null;

  @Index({ spatial: true })
  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location!: { type: 'Point'; coordinates: [number, number] };

  @Column({ type: 'numeric', precision: 3, scale: 2, default: 0 })
  rating!: string;

  @Column({ type: 'int', name: 'review_count', default: 0 })
  reviewCount!: number;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ type: 'varchar', length: 40, name: 'source_provider', default: 'nearfind' })
  sourceProvider!: string;

  @Column({ type: 'varchar', length: 180, name: 'source_external_id', nullable: true })
  sourceExternalId!: string | null;

  @Column({ type: 'varchar', length: 180, name: 'source_attribution', nullable: true })
  sourceAttribution!: string | null;

  @Column({ type: 'timestamptz', name: 'source_last_seen_at', nullable: true })
  sourceLastSeenAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'source_expires_at', nullable: true })
  sourceExpiresAt!: Date | null;
}
