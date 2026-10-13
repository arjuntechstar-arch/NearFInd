import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PlatformPhases1728732000000 implements MigrationInterface {
  name = 'PlatformPhases1728732000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE user_preferences (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        manual_location_label varchar(160),
        manual_lat numeric(9,6),
        manual_lng numeric(9,6),
        notification_push boolean NOT NULL DEFAULT true,
        notification_email boolean NOT NULL DEFAULT true,
        leaderboard_opt_in boolean NOT NULL DEFAULT false,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_user_preferences_manual_location CHECK (
          (manual_lat IS NULL AND manual_lng IS NULL) OR
          (manual_lat BETWEEN -90 AND 90 AND manual_lng BETWEEN -180 AND 180)
        )
      );

      CREATE TABLE vehicles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        label varchar(120) NOT NULL,
        vehicle_type varchar(40) NOT NULL,
        fuel_type varchar(40),
        registration_last4 varchar(4),
        is_default boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX ix_vehicles_user ON vehicles(user_id);

      CREATE TABLE emergency_contacts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name varchar(120) NOT NULL,
        relationship varchar(80),
        phone_encrypted text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX ix_emergency_contacts_user ON emergency_contacts(user_id);

      CREATE TABLE service_providers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name varchar(180) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE','SUSPENDED')),
        support_phone_encrypted text,
        version integer NOT NULL DEFAULT 1 CHECK (version > 0),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX ix_service_providers_owner ON service_providers(owner_user_id);
      ALTER TABLE service_locations
        ADD COLUMN provider_id uuid REFERENCES service_providers(id) ON DELETE SET NULL,
        ADD COLUMN description text,
        ADD COLUMN phone varchar(40),
        ADD COLUMN website_url varchar(2048),
        ADD COLUMN version integer NOT NULL DEFAULT 1;
      CREATE INDEX ix_service_locations_provider ON service_locations(provider_id);

      CREATE TABLE contributions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        service_location_id uuid REFERENCES service_locations(id) ON DELETE SET NULL,
        kind varchar(40) NOT NULL,
        details jsonb NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX ix_contributions_status_created ON contributions(status, created_at DESC);
      CREATE INDEX ix_contributions_user ON contributions(user_id);

      CREATE TABLE contribution_evidence (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        contribution_id uuid NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
        object_key varchar(1024) NOT NULL,
        mime_type varchar(120) NOT NULL,
        size_bytes integer NOT NULL CHECK (size_bytes > 0),
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE moderation_decisions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        contribution_id uuid NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
        moderator_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        decision varchar(20) NOT NULL CHECK (decision IN ('APPROVED','REJECTED')),
        note text,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE reviews (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        service_location_id uuid NOT NULL REFERENCES service_locations(id) ON DELETE CASCADE,
        rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment text,
        status varchar(20) NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('PUBLISHED','HIDDEN')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_reviews_user_location UNIQUE(user_id, service_location_id)
      );
      CREATE INDEX ix_reviews_location_status ON reviews(service_location_id, status, created_at DESC);

      CREATE TABLE review_media (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
        object_key varchar(1024) NOT NULL,
        media_type varchar(30) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type varchar(50) NOT NULL,
        title varchar(180) NOT NULL,
        body text NOT NULL,
        read_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX ix_notifications_user_created ON notifications(user_id, created_at DESC);

      CREATE TABLE fuel_price_observations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        service_location_id uuid NOT NULL REFERENCES service_locations(id) ON DELETE CASCADE,
        observed_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        fuel_type varchar(40) NOT NULL,
        price numeric(10,2) NOT NULL CHECK (price > 0),
        currency varchar(3) NOT NULL DEFAULT 'INR',
        confidence numeric(3,2) NOT NULL DEFAULT 0.60 CHECK (confidence BETWEEN 0 AND 1),
        observed_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX ix_fuel_observations_lookup ON fuel_price_observations(service_location_id, fuel_type, observed_at DESC);

      CREATE TABLE ev_connectors (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        service_location_id uuid NOT NULL REFERENCES service_locations(id) ON DELETE CASCADE,
        connector_type varchar(60) NOT NULL,
        power_kw numeric(7,2) NOT NULL CHECK (power_kw > 0),
        status varchar(30) NOT NULL DEFAULT 'AVAILABLE',
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_ev_connector_location_type UNIQUE(service_location_id, connector_type)
      );

      CREATE TABLE route_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        start_lat_rounded numeric(6,3) NOT NULL,
        start_lng_rounded numeric(6,3) NOT NULL,
        end_lat_rounded numeric(6,3) NOT NULL,
        end_lng_rounded numeric(6,3) NOT NULL,
        provider varchar(40) NOT NULL,
        summary_json jsonb NOT NULL,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX ix_route_sessions_user_expiry ON route_sessions(user_id, expires_at);

      CREATE TABLE provider_slots (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_id uuid NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
        service_location_id uuid NOT NULL REFERENCES service_locations(id) ON DELETE CASCADE,
        starts_at timestamptz NOT NULL,
        ends_at timestamptz NOT NULL,
        capacity integer NOT NULL DEFAULT 1 CHECK (capacity BETWEEN 1 AND 100),
        booked_count integer NOT NULL DEFAULT 0 CHECK (booked_count >= 0),
        price_minor integer NOT NULL DEFAULT 0 CHECK (price_minor >= 0),
        currency varchar(3) NOT NULL DEFAULT 'INR',
        version integer NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_provider_slot_window CHECK (ends_at > starts_at),
        CONSTRAINT ck_provider_slot_capacity CHECK (booked_count <= capacity),
        CONSTRAINT uq_provider_slot_window UNIQUE(service_location_id, starts_at, ends_at)
      );
      CREATE INDEX ix_provider_slots_location_start ON provider_slots(service_location_id, starts_at);

      CREATE TABLE bookings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        slot_id uuid NOT NULL REFERENCES provider_slots(id) ON DELETE RESTRICT,
        provider_id uuid NOT NULL REFERENCES service_providers(id) ON DELETE RESTRICT,
        service_location_id uuid NOT NULL REFERENCES service_locations(id) ON DELETE RESTRICT,
        status varchar(20) NOT NULL DEFAULT 'RESERVED' CHECK (status IN ('RESERVED','CONFIRMED','CANCELLED','COMPLETED')),
        idempotency_key varchar(128) NOT NULL,
        amount_minor integer NOT NULL CHECK (amount_minor >= 0),
        currency varchar(3) NOT NULL,
        hold_expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_bookings_user_idempotency UNIQUE(user_id, idempotency_key)
      );
      CREATE INDEX ix_bookings_provider_created ON bookings(provider_id, created_at DESC);

      CREATE TABLE payment_references (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
        provider varchar(40) NOT NULL,
        external_ref varchar(160) NOT NULL UNIQUE,
        idempotency_key varchar(128) NOT NULL,
        status varchar(20) NOT NULL CHECK (status IN ('AUTHORIZED','VOIDED','REFUNDED')),
        amount_minor integer NOT NULL,
        currency varchar(3) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_payment_booking_idempotency UNIQUE(booking_id, idempotency_key)
      );

      CREATE TABLE dispatch_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
        service_type varchar(50) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED','TRIAGED','ASSIGNED','EN_ROUTE','ARRIVED','COMPLETED','CANCELLED')),
        location_encrypted text NOT NULL,
        notes_encrypted text,
        idempotency_key varchar(128) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_dispatch_user_idempotency UNIQUE(user_id, idempotency_key)
      );
      CREATE INDEX ix_dispatch_status_created ON dispatch_requests(status, created_at DESC);

      CREATE TABLE dispatch_assignments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        dispatch_request_id uuid NOT NULL UNIQUE REFERENCES dispatch_requests(id) ON DELETE CASCADE,
        provider_id uuid NOT NULL REFERENCES service_providers(id) ON DELETE RESTRICT,
        assigned_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE dispatch_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        dispatch_request_id uuid NOT NULL REFERENCES dispatch_requests(id) ON DELETE CASCADE,
        actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        type varchar(60) NOT NULL,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX ix_dispatch_events_request_created ON dispatch_events(dispatch_request_id, created_at);

      CREATE TABLE live_location_grants (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        dispatch_request_id uuid NOT NULL REFERENCES dispatch_requests(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        location_encrypted text,
        updated_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX ix_live_grants_active ON live_location_grants(dispatch_request_id, expires_at) WHERE revoked_at IS NULL;

      CREATE TABLE chat_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        dispatch_request_id uuid NOT NULL REFERENCES dispatch_requests(id) ON DELETE CASCADE,
        sender_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        body text,
        attachment_object_key varchar(1024),
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_chat_message_content CHECK (body IS NOT NULL OR attachment_object_key IS NOT NULL)
      );
      CREATE INDEX ix_chat_messages_request_created ON chat_messages(dispatch_request_id, created_at);

      CREATE TABLE reward_ledger_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        points integer NOT NULL CHECK (points <> 0),
        source_type varchar(50) NOT NULL,
        source_id varchar(160) NOT NULL,
        idempotency_key varchar(128) NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX ix_reward_ledger_user_created ON reward_ledger_entries(user_id, created_at DESC);

      CREATE TABLE challenges (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(160) NOT NULL,
        target_type varchar(40) NOT NULL CHECK (target_type IN ('CONTRIBUTION','REVIEW')),
        target_count integer NOT NULL CHECK (target_count > 0),
        reward_points integer NOT NULL CHECK (reward_points > 0),
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE challenge_progress (
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
        progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0),
        completed_at timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(user_id, challenge_id)
      );

      CREATE TABLE perks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(160) NOT NULL,
        description text,
        cost_points integer NOT NULL CHECK (cost_points > 0),
        stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE perk_redemptions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        perk_id uuid NOT NULL REFERENCES perks(id) ON DELETE RESTRICT,
        points_spent integer NOT NULL CHECK (points_spent > 0),
        status varchar(30) NOT NULL DEFAULT 'CONFIRMED',
        idempotency_key varchar(128) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_redemption_user_idempotency UNIQUE(user_id, idempotency_key)
      );

      CREATE TABLE property_listings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_id uuid REFERENCES service_providers(id) ON DELETE SET NULL,
        created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        title varchar(180) NOT NULL,
        description text NOT NULL,
        address varchar(255) NOT NULL,
        city varchar(120) NOT NULL,
        price_minor integer NOT NULL CHECK (price_minor >= 0),
        currency varchar(3) NOT NULL DEFAULT 'INR',
        property_type varchar(50) NOT NULL,
        lat numeric(9,6) NOT NULL CHECK (lat BETWEEN -90 AND 90),
        lng numeric(9,6) NOT NULL CHECK (lng BETWEEN -180 AND 180),
        status varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','REJECTED')),
        version integer NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX ix_property_listings_public ON property_listings(status, city, price_minor);

      CREATE TABLE property_media (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        property_listing_id uuid NOT NULL REFERENCES property_listings(id) ON DELETE CASCADE,
        object_key varchar(1024) NOT NULL,
        media_type varchar(30) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE inspection_bookings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        property_listing_id uuid NOT NULL REFERENCES property_listings(id) ON DELETE RESTRICT,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        scheduled_at timestamptz NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED','CONFIRMED','CANCELLED','COMPLETED')),
        idempotency_key varchar(128) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_inspection_user_idempotency UNIQUE(user_id, idempotency_key)
      );

      CREATE TABLE feature_flags (
        key varchar(100) PRIMARY KEY,
        enabled boolean NOT NULL DEFAULT false,
        config jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      INSERT INTO feature_flags(key, enabled, config) VALUES ('property_module', false, '{}'::jsonb)
      ON CONFLICT (key) DO NOTHING;

      CREATE TABLE audit_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        action varchar(100) NOT NULL,
        resource_type varchar(80) NOT NULL,
        resource_id varchar(160),
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX ix_audit_events_created ON audit_events(created_at DESC);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS audit_events;
      DROP TABLE IF EXISTS feature_flags;
      DROP TABLE IF EXISTS inspection_bookings;
      DROP TABLE IF EXISTS property_media;
      DROP TABLE IF EXISTS property_listings;
      DROP TABLE IF EXISTS perk_redemptions;
      DROP TABLE IF EXISTS perks;
      DROP TABLE IF EXISTS challenge_progress;
      DROP TABLE IF EXISTS challenges;
      DROP TABLE IF EXISTS reward_ledger_entries;
      DROP TABLE IF EXISTS chat_messages;
      DROP TABLE IF EXISTS live_location_grants;
      DROP TABLE IF EXISTS dispatch_events;
      DROP TABLE IF EXISTS dispatch_assignments;
      DROP TABLE IF EXISTS dispatch_requests;
      DROP TABLE IF EXISTS payment_references;
      DROP TABLE IF EXISTS bookings;
      DROP TABLE IF EXISTS provider_slots;
      DROP TABLE IF EXISTS route_sessions;
      DROP TABLE IF EXISTS ev_connectors;
      DROP TABLE IF EXISTS fuel_price_observations;
      DROP TABLE IF EXISTS notifications;
      DROP TABLE IF EXISTS review_media;
      DROP TABLE IF EXISTS reviews;
      DROP TABLE IF EXISTS moderation_decisions;
      DROP TABLE IF EXISTS contribution_evidence;
      DROP TABLE IF EXISTS contributions;
      ALTER TABLE service_locations DROP COLUMN IF EXISTS version, DROP COLUMN IF EXISTS website_url, DROP COLUMN IF EXISTS phone, DROP COLUMN IF EXISTS description, DROP COLUMN IF EXISTS provider_id;
      DROP TABLE IF EXISTS service_providers;
      DROP TABLE IF EXISTS emergency_contacts;
      DROP TABLE IF EXISTS vehicles;
      DROP TABLE IF EXISTS user_preferences;
    `);
  }
}
