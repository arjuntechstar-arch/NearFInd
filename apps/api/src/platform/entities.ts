import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ProviderStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum ContributionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum ReviewStatus {
  PUBLISHED = 'PUBLISHED',
  HIDDEN = 'HIDDEN',
}

export enum BookingStatus {
  RESERVED = 'RESERVED',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export enum PaymentStatus {
  AUTHORIZED = 'AUTHORIZED',
  VOIDED = 'VOIDED',
  REFUNDED = 'REFUNDED',
}

export enum DispatchStatus {
  REQUESTED = 'REQUESTED',
  TRIAGED = 'TRIAGED',
  ASSIGNED = 'ASSIGNED',
  EN_ROUTE = 'EN_ROUTE',
  ARRIVED = 'ARRIVED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum PropertyStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  REJECTED = 'REJECTED',
}

export enum InspectionStatus {
  REQUESTED = 'REQUESTED',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

@Entity({ name: 'user_preferences' })
export class UserPreference {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 160, name: 'manual_location_label', nullable: true })
  manualLocationLabel!: string | null;

  @Column({ type: 'numeric', precision: 9, scale: 6, name: 'manual_lat', nullable: true })
  manualLat!: string | null;

  @Column({ type: 'numeric', precision: 9, scale: 6, name: 'manual_lng', nullable: true })
  manualLng!: string | null;

  @Column({ type: 'boolean', name: 'notification_push', default: true })
  notificationPush!: boolean;

  @Column({ type: 'boolean', name: 'notification_email', default: true })
  notificationEmail!: boolean;

  @Column({ type: 'boolean', name: 'leaderboard_opt_in', default: false })
  leaderboardOptIn!: boolean;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}

@Entity({ name: 'vehicles' })
export class Vehicle {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'varchar', length: 120 }) label!: string;
  @Column({ type: 'varchar', length: 40, name: 'vehicle_type' }) vehicleType!: string;
  @Column({ type: 'varchar', length: 40, name: 'fuel_type', nullable: true }) fuelType!: string | null;
  @Column({ type: 'varchar', length: 4, name: 'registration_last4', nullable: true }) registrationLast4!: string | null;
  @Column({ type: 'boolean', name: 'is_default', default: false }) isDefault!: boolean;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' }) updatedAt!: Date;
}

@Entity({ name: 'emergency_contacts' })
export class EmergencyContact {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'varchar', length: 120 }) name!: string;
  @Column({ type: 'varchar', length: 80, nullable: true }) relationship!: string | null;
  @Column({ type: 'text', name: 'phone_encrypted' }) phoneEncrypted!: string;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
}

@Entity({ name: 'service_providers' })
export class ServiceProvider {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'owner_user_id' }) ownerUserId!: string;
  @Column({ type: 'varchar', length: 180 }) name!: string;
  @Column({ type: 'varchar', length: 20, default: ProviderStatus.PENDING }) status!: ProviderStatus;
  @Column({ type: 'text', name: 'support_phone_encrypted', nullable: true }) supportPhoneEncrypted!: string | null;
  @Column({ type: 'int', default: 1 }) version!: number;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' }) updatedAt!: Date;
}

@Entity({ name: 'contributions' })
export class Contribution {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'uuid', name: 'service_location_id', nullable: true }) serviceLocationId!: string | null;
  @Column({ type: 'varchar', length: 40 }) kind!: string;
  @Column({ type: 'jsonb' }) details!: Record<string, unknown>;
  @Column({ type: 'varchar', length: 20, default: ContributionStatus.PENDING }) status!: ContributionStatus;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' }) updatedAt!: Date;
}

@Entity({ name: 'contribution_evidence' })
export class ContributionEvidence {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'contribution_id' }) contributionId!: string;
  @Column({ type: 'varchar', length: 1024, name: 'object_key' }) objectKey!: string;
  @Column({ type: 'varchar', length: 120, name: 'mime_type' }) mimeType!: string;
  @Column({ type: 'int', name: 'size_bytes' }) sizeBytes!: number;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
}

@Entity({ name: 'moderation_decisions' })
export class ModerationDecision {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'contribution_id' }) contributionId!: string;
  @Column({ type: 'uuid', name: 'moderator_user_id' }) moderatorUserId!: string;
  @Column({ type: 'varchar', length: 20 }) decision!: ContributionStatus;
  @Column({ type: 'text', nullable: true }) note!: string | null;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
}

@Entity({ name: 'reviews' })
export class Review {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'uuid', name: 'service_location_id' }) serviceLocationId!: string;
  @Column({ type: 'smallint' }) rating!: number;
  @Column({ type: 'text', nullable: true }) comment!: string | null;
  @Column({ type: 'varchar', length: 20, default: ReviewStatus.PUBLISHED }) status!: ReviewStatus;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' }) updatedAt!: Date;
}

@Entity({ name: 'review_media' })
export class ReviewMedia {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'review_id' }) reviewId!: string;
  @Column({ type: 'varchar', length: 1024, name: 'object_key' }) objectKey!: string;
  @Column({ type: 'varchar', length: 30, name: 'media_type' }) mediaType!: string;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
}

@Entity({ name: 'notifications' })
export class Notification {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'varchar', length: 50 }) type!: string;
  @Column({ type: 'varchar', length: 180 }) title!: string;
  @Column({ type: 'text' }) body!: string;
  @Column({ type: 'timestamptz', name: 'read_at', nullable: true }) readAt!: Date | null;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
}

@Entity({ name: 'fuel_price_observations' })
export class FuelPriceObservation {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'service_location_id' }) serviceLocationId!: string;
  @Column({ type: 'uuid', name: 'observed_by_user_id' }) observedByUserId!: string;
  @Column({ type: 'varchar', length: 40, name: 'fuel_type' }) fuelType!: string;
  @Column({ type: 'numeric', precision: 10, scale: 2 }) price!: string;
  @Column({ type: 'varchar', length: 3, default: 'INR' }) currency!: string;
  @Column({ type: 'numeric', precision: 3, scale: 2, default: 0.6 }) confidence!: string;
  @Column({ type: 'timestamptz', name: 'observed_at' }) observedAt!: Date;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
}

@Entity({ name: 'ev_connectors' })
export class EvConnector {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'service_location_id' }) serviceLocationId!: string;
  @Column({ type: 'varchar', length: 60, name: 'connector_type' }) connectorType!: string;
  @Column({ type: 'numeric', precision: 7, scale: 2, name: 'power_kw' }) powerKw!: string;
  @Column({ type: 'varchar', length: 30, default: 'AVAILABLE' }) status!: string;
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' }) updatedAt!: Date;
}

@Entity({ name: 'route_sessions' })
export class RouteSession {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'numeric', precision: 6, scale: 3, name: 'start_lat_rounded' }) startLatRounded!: string;
  @Column({ type: 'numeric', precision: 6, scale: 3, name: 'start_lng_rounded' }) startLngRounded!: string;
  @Column({ type: 'numeric', precision: 6, scale: 3, name: 'end_lat_rounded' }) endLatRounded!: string;
  @Column({ type: 'numeric', precision: 6, scale: 3, name: 'end_lng_rounded' }) endLngRounded!: string;
  @Column({ type: 'varchar', length: 40 }) provider!: string;
  @Column({ type: 'jsonb', name: 'summary_json' }) summaryJson!: Record<string, unknown>;
  @Column({ type: 'timestamptz', name: 'expires_at' }) expiresAt!: Date;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
}

@Entity({ name: 'provider_slots' })
export class ProviderSlot {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'provider_id' }) providerId!: string;
  @Column({ type: 'uuid', name: 'service_location_id' }) serviceLocationId!: string;
  @Column({ type: 'timestamptz', name: 'starts_at' }) startsAt!: Date;
  @Column({ type: 'timestamptz', name: 'ends_at' }) endsAt!: Date;
  @Column({ type: 'int', default: 1 }) capacity!: number;
  @Column({ type: 'int', name: 'booked_count', default: 0 }) bookedCount!: number;
  @Column({ type: 'int', name: 'price_minor', default: 0 }) priceMinor!: number;
  @Column({ type: 'varchar', length: 3, default: 'INR' }) currency!: string;
  @Column({ type: 'int', default: 1 }) version!: number;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
}

@Entity({ name: 'bookings' })
export class Booking {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'uuid', name: 'slot_id' }) slotId!: string;
  @Column({ type: 'uuid', name: 'provider_id' }) providerId!: string;
  @Column({ type: 'uuid', name: 'service_location_id' }) serviceLocationId!: string;
  @Column({ type: 'varchar', length: 20, default: BookingStatus.RESERVED }) status!: BookingStatus;
  @Column({ type: 'varchar', length: 128, name: 'idempotency_key' }) idempotencyKey!: string;
  @Column({ type: 'int', name: 'amount_minor' }) amountMinor!: number;
  @Column({ type: 'varchar', length: 3 }) currency!: string;
  @Column({ type: 'timestamptz', name: 'hold_expires_at' }) holdExpiresAt!: Date;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' }) updatedAt!: Date;
}

@Entity({ name: 'payment_references' })
export class PaymentReference {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'booking_id' }) bookingId!: string;
  @Column({ type: 'varchar', length: 40 }) provider!: string;
  @Column({ type: 'varchar', length: 160, name: 'external_ref' }) externalRef!: string;
  @Column({ type: 'varchar', length: 128, name: 'idempotency_key' }) idempotencyKey!: string;
  @Column({ type: 'varchar', length: 20 }) status!: PaymentStatus;
  @Column({ type: 'int', name: 'amount_minor' }) amountMinor!: number;
  @Column({ type: 'varchar', length: 3 }) currency!: string;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' }) updatedAt!: Date;
}

@Entity({ name: 'dispatch_requests' })
export class DispatchRequest {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'uuid', name: 'vehicle_id', nullable: true }) vehicleId!: string | null;
  @Column({ type: 'varchar', length: 50, name: 'service_type' }) serviceType!: string;
  @Column({ type: 'varchar', length: 20, default: DispatchStatus.REQUESTED }) status!: DispatchStatus;
  @Column({ type: 'text', name: 'location_encrypted' }) locationEncrypted!: string;
  @Column({ type: 'text', name: 'notes_encrypted', nullable: true }) notesEncrypted!: string | null;
  @Column({ type: 'varchar', length: 128, name: 'idempotency_key' }) idempotencyKey!: string;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' }) updatedAt!: Date;
}

@Entity({ name: 'dispatch_assignments' })
export class DispatchAssignment {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'dispatch_request_id' }) dispatchRequestId!: string;
  @Column({ type: 'uuid', name: 'provider_id' }) providerId!: string;
  @Column({ type: 'uuid', name: 'assigned_by_user_id' }) assignedByUserId!: string;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
}

@Entity({ name: 'dispatch_events' })
export class DispatchEvent {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'dispatch_request_id' }) dispatchRequestId!: string;
  @Column({ type: 'uuid', name: 'actor_user_id', nullable: true }) actorUserId!: string | null;
  @Column({ type: 'varchar', length: 60 }) type!: string;
  @Column({ type: 'jsonb' }) payload!: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
}

@Entity({ name: 'live_location_grants' })
export class LiveLocationGrant {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'dispatch_request_id' }) dispatchRequestId!: string;
  @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'timestamptz', name: 'expires_at' }) expiresAt!: Date;
  @Column({ type: 'timestamptz', name: 'revoked_at', nullable: true }) revokedAt!: Date | null;
  @Column({ type: 'text', name: 'location_encrypted', nullable: true }) locationEncrypted!: string | null;
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' }) updatedAt!: Date;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
}

@Entity({ name: 'chat_messages' })
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'dispatch_request_id' }) dispatchRequestId!: string;
  @Column({ type: 'uuid', name: 'sender_user_id' }) senderUserId!: string;
  @Column({ type: 'text', nullable: true }) body!: string | null;
  @Column({ type: 'varchar', length: 1024, name: 'attachment_object_key', nullable: true }) attachmentObjectKey!: string | null;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
}

@Entity({ name: 'reward_ledger_entries' })
export class RewardLedgerEntry {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'int' }) points!: number;
  @Column({ type: 'varchar', length: 50, name: 'source_type' }) sourceType!: string;
  @Column({ type: 'varchar', length: 160, name: 'source_id' }) sourceId!: string;
  @Column({ type: 'varchar', length: 128, name: 'idempotency_key' }) idempotencyKey!: string;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
}

@Entity({ name: 'challenges' })
export class Challenge {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 160 }) name!: string;
  @Column({ type: 'varchar', length: 40, name: 'target_type' }) targetType!: string;
  @Column({ type: 'int', name: 'target_count' }) targetCount!: number;
  @Column({ type: 'int', name: 'reward_points' }) rewardPoints!: number;
  @Column({ type: 'boolean', name: 'is_active', default: true }) isActive!: boolean;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
}

@Entity({ name: 'challenge_progress' })
export class ChallengeProgress {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' }) userId!: string;
  @PrimaryColumn({ type: 'uuid', name: 'challenge_id' }) challengeId!: string;
  @Column({ type: 'int', default: 0 }) progress!: number;
  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true }) completedAt!: Date | null;
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' }) updatedAt!: Date;
}

@Entity({ name: 'perks' })
export class Perk {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 160 }) name!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ type: 'int', name: 'cost_points' }) costPoints!: number;
  @Column({ type: 'int', default: 0 }) stock!: number;
  @Column({ type: 'boolean', name: 'is_active', default: true }) isActive!: boolean;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
}

@Entity({ name: 'perk_redemptions' })
export class PerkRedemption {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'uuid', name: 'perk_id' }) perkId!: string;
  @Column({ type: 'int', name: 'points_spent' }) pointsSpent!: number;
  @Column({ type: 'varchar', length: 30, default: 'CONFIRMED' }) status!: string;
  @Column({ type: 'varchar', length: 128, name: 'idempotency_key' }) idempotencyKey!: string;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
}

@Entity({ name: 'property_listings' })
export class PropertyListing {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'provider_id', nullable: true }) providerId!: string | null;
  @Column({ type: 'uuid', name: 'created_by_user_id' }) createdByUserId!: string;
  @Column({ type: 'varchar', length: 180 }) title!: string;
  @Column({ type: 'text' }) description!: string;
  @Column({ type: 'varchar', length: 255 }) address!: string;
  @Column({ type: 'varchar', length: 120 }) city!: string;
  @Column({ type: 'int', name: 'price_minor' }) priceMinor!: number;
  @Column({ type: 'varchar', length: 3, default: 'INR' }) currency!: string;
  @Column({ type: 'varchar', length: 50, name: 'property_type' }) propertyType!: string;
  @Column({ type: 'numeric', precision: 9, scale: 6 }) lat!: string;
  @Column({ type: 'numeric', precision: 9, scale: 6 }) lng!: string;
  @Column({ type: 'varchar', length: 20, default: PropertyStatus.DRAFT }) status!: PropertyStatus;
  @Column({ type: 'int', default: 1 }) version!: number;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' }) updatedAt!: Date;
}

@Entity({ name: 'property_media' })
export class PropertyMedia {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'property_listing_id' }) propertyListingId!: string;
  @Column({ type: 'varchar', length: 1024, name: 'object_key' }) objectKey!: string;
  @Column({ type: 'varchar', length: 30, name: 'media_type' }) mediaType!: string;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
}

@Entity({ name: 'inspection_bookings' })
export class InspectionBooking {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'property_listing_id' }) propertyListingId!: string;
  @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'timestamptz', name: 'scheduled_at' }) scheduledAt!: Date;
  @Column({ type: 'varchar', length: 20, default: InspectionStatus.REQUESTED }) status!: InspectionStatus;
  @Column({ type: 'varchar', length: 128, name: 'idempotency_key' }) idempotencyKey!: string;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
}

@Entity({ name: 'feature_flags' })
export class FeatureFlag {
  @PrimaryColumn({ type: 'varchar', length: 100 }) key!: string;
  @Column({ type: 'boolean', default: false }) enabled!: boolean;
  @Column({ type: 'jsonb', default: {} }) config!: Record<string, unknown>;
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' }) updatedAt!: Date;
}

@Entity({ name: 'audit_events' })
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'actor_user_id', nullable: true }) actorUserId!: string | null;
  @Column({ type: 'varchar', length: 100 }) action!: string;
  @Column({ type: 'varchar', length: 80, name: 'resource_type' }) resourceType!: string;
  @Column({ type: 'varchar', length: 160, name: 'resource_id', nullable: true }) resourceId!: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata!: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) createdAt!: Date;
}

export const PLATFORM_ENTITIES = [
  UserPreference,
  Vehicle,
  EmergencyContact,
  ServiceProvider,
  Contribution,
  ContributionEvidence,
  ModerationDecision,
  Review,
  ReviewMedia,
  Notification,
  FuelPriceObservation,
  EvConnector,
  RouteSession,
  ProviderSlot,
  Booking,
  PaymentReference,
  DispatchRequest,
  DispatchAssignment,
  DispatchEvent,
  LiveLocationGrant,
  ChatMessage,
  RewardLedgerEntry,
  Challenge,
  ChallengeProgress,
  Perk,
  PerkRedemption,
  PropertyListing,
  PropertyMedia,
  InspectionBooking,
  FeatureFlag,
  AuditEvent,
] as const;
