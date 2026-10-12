import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { AUTH_TOKEN_VERIFIER, type TokenVerifier, type VerifiedIdentity } from '../src/identity/auth/token-verifier.js';
import { User, UserRole } from '../src/identity/entities/user.entity.js';

const identities: Record<string, VerifiedIdentity> = {
  customer: {
    issuer: 'https://issuer.platform.test',
    subject: 'customer',
    displayName: 'Platform Customer',
    email: 'customer@platform.test',
    avatarUrl: null,
  },
  provider: {
    issuer: 'https://issuer.platform.test',
    subject: 'provider',
    displayName: 'Platform Provider',
    email: 'provider@platform.test',
    avatarUrl: null,
  },
  admin: {
    issuer: 'https://issuer.platform.test',
    subject: 'admin',
    displayName: 'Platform Admin',
    email: 'admin@platform.test',
    avatarUrl: null,
  },
};

const verifier: TokenVerifier = {
  verify: (token: string) => {
    const identity = identities[token];
    if (!identity) return Promise.reject(new UnauthorizedException('Invalid platform test token'));
    return Promise.resolve(identity);
  },
};

void describe('Platform Phase 1-7 workflows (e2e)', () => {
  let app: NestFastifyApplication;
  let database: DataSource;

  before(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AUTH_TOKEN_VERIFIER)
      .useValue(verifier)
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    database = app.get(DataSource);

    for (const token of ['customer', 'provider', 'admin']) {
      const response = await inject(token, { method: 'GET', url: '/v1/me' });
      assert.equal(response.statusCode, 200);
    }
    await database.getRepository(User).update(
      { issuer: identities.admin!.issuer, subject: identities.admin!.subject },
      { role: UserRole.ADMIN },
    );
  });

  after(async () => {
    await app.close();
  });

  async function inject(token: string, request: { method: string; url: string; payload?: unknown }) {
    return app.getHttpAdapter().getInstance().inject({
      ...request,
      headers: { authorization: `Bearer ${token}` },
    });
  }

  void it('completes provider, community, routing, booking, roadside, rewards and property flows', async () => {
    const providerCreate = await inject('provider', {
      method: 'POST',
      url: '/v1/providers',
      payload: { name: 'NearFind Test Provider', supportPhone: '+919876543210' },
    });
    assert.equal(providerCreate.statusCode, 201);
    const providerId = providerCreate.json<{ id: string }>().id;

    const providerApprove = await inject('admin', {
      method: 'PATCH',
      url: `/v1/admin/providers/${providerId}/status`,
      payload: { status: 'ACTIVE' },
    });
    assert.equal(providerApprove.statusCode, 200);

    const categories = await app.getHttpAdapter().getInstance().inject({ method: 'GET', url: '/v1/discovery/categories' });
    assert.equal(categories.statusCode, 200);
    const categoryId = categories.json<Array<{ id: string }>>()[0]?.id;
    assert.ok(categoryId);

    const locationCreate = await inject('provider', {
      method: 'POST',
      url: '/v1/provider/locations',
      payload: {
        providerId,
        categoryId,
        name: 'NearFind Platform Test Service',
        description: 'Integration fixture managed through provider APIs.',
        address: 'Anna Salai',
        city: 'Chennai',
        state: 'Tamil Nadu',
        countryCode: 'IN',
        phone: '+919876543210',
        lat: 13.0604,
        lng: 80.2496,
      },
    });
    assert.equal(locationCreate.statusCode, 201);
    const placeId = locationCreate.json<{ id: string }>().id;

    const preferences = await inject('customer', {
      method: 'PATCH',
      url: '/v1/account/preferences',
      payload: {
        manualLocationLabel: 'Chennai',
        manualLat: 13.0604,
        manualLng: 80.2496,
        notificationPush: true,
        leaderboardOptIn: true,
      },
    });
    assert.equal(preferences.statusCode, 200);

    const vehicle = await inject('customer', {
      method: 'POST',
      url: '/v1/account/vehicles',
      payload: { label: 'My Car', vehicleType: 'CAR', fuelType: 'PETROL', registrationLast4: '1234', isDefault: true },
    });
    assert.equal(vehicle.statusCode, 201);
    const vehicleId = vehicle.json<{ id: string }>().id;

    const contact = await inject('customer', {
      method: 'POST',
      url: '/v1/account/emergency-contacts',
      payload: { name: 'Emergency Contact', relationship: 'Family', phone: '+919812345678' },
    });
    assert.equal(contact.statusCode, 201);

    const contribution = await inject('customer', {
      method: 'POST',
      url: '/v1/contributions',
      payload: { serviceLocationId: placeId, kind: 'PLACE_UPDATE', details: { note: 'Open and verified in integration test' } },
    });
    assert.equal(contribution.statusCode, 201);
    const contributionId = contribution.json<{ id: string }>().id;

    const moderation = await inject('admin', {
      method: 'POST',
      url: `/v1/admin/moderation/contributions/${contributionId}`,
      payload: { decision: 'APPROVED', note: 'Verified fixture' },
    });
    assert.equal(moderation.statusCode, 201);

    const review = await inject('customer', {
      method: 'POST',
      url: '/v1/reviews',
      payload: { serviceLocationId: placeId, rating: 5, comment: 'Integration review' },
    });
    assert.equal(review.statusCode, 201);

    const fuel = await inject('customer', {
      method: 'POST',
      url: '/v1/fuel-observations',
      payload: { serviceLocationId: placeId, fuelType: 'PETROL', price: 102.5, currency: 'INR' },
    });
    assert.equal(fuel.statusCode, 201);

    const route = await inject('customer', {
      method: 'POST',
      url: '/v1/route-optimizations',
      payload: {
        startLat: 13.05,
        startLng: 80.24,
        endLat: 13.08,
        endLng: 80.27,
        corridorMeters: 5000,
        fuelType: 'PETROL',
      },
    });
    assert.equal(route.statusCode, 201);
    assert.ok(route.json<{ routeSessionId: string }>().routeSessionId);

    const start = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const slot = await inject('provider', {
      method: 'POST',
      url: '/v1/provider-slots',
      payload: {
        providerId,
        serviceLocationId: placeId,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        capacity: 1,
        priceMinor: 50000,
        currency: 'INR',
      },
    });
    assert.equal(slot.statusCode, 201);
    const slotId = slot.json<{ id: string }>().id;

    const bookingOne = await inject('customer', {
      method: 'POST',
      url: '/v1/bookings',
      payload: { slotId, idempotencyKey: 'platform-booking-001' },
    });
    const bookingTwo = await inject('customer', {
      method: 'POST',
      url: '/v1/bookings',
      payload: { slotId, idempotencyKey: 'platform-booking-001' },
    });
    assert.equal(bookingOne.statusCode, 201);
    assert.equal(bookingTwo.statusCode, 201);
    const bookingId = bookingOne.json<{ id: string }>().id;
    assert.equal(bookingTwo.json<{ id: string }>().id, bookingId);

    const payment = await inject('customer', {
      method: 'POST',
      url: `/v1/bookings/${bookingId}/authorize-payment`,
      payload: { paymentMethodToken: 'sandbox_pm_platform_test_001', idempotencyKey: 'platform-payment-001' },
    });
    assert.equal(payment.statusCode, 201);
    assert.equal(payment.json<{ booking: { status: string } }>().booking.status, 'CONFIRMED');

    const dispatchOne = await inject('customer', {
      method: 'POST',
      url: '/v1/dispatch-requests',
      payload: {
        vehicleId,
        serviceType: 'TOW',
        lat: 13.0604,
        lng: 80.2496,
        notes: 'Private roadside integration fixture',
        idempotencyKey: 'platform-dispatch-001',
      },
    });
    const dispatchTwo = await inject('customer', {
      method: 'POST',
      url: '/v1/dispatch-requests',
      payload: {
        vehicleId,
        serviceType: 'TOW',
        lat: 13.0604,
        lng: 80.2496,
        notes: 'Private roadside integration fixture',
        idempotencyKey: 'platform-dispatch-001',
      },
    });
    assert.equal(dispatchOne.statusCode, 201);
    assert.equal(dispatchTwo.statusCode, 201);
    const dispatchId = dispatchOne.json<{ id: string }>().id;
    assert.equal(dispatchTwo.json<{ id: string }>().id, dispatchId);

    assert.equal((await inject('admin', { method: 'POST', url: `/v1/admin/dispatch-requests/${dispatchId}/triage` })).statusCode, 201);
    assert.equal(
      (await inject('admin', {
        method: 'POST',
        url: `/v1/admin/dispatch-requests/${dispatchId}/assign`,
        payload: { providerId },
      })).statusCode,
      201,
    );
    const enRoute = await inject('provider', {
      method: 'PATCH',
      url: `/v1/dispatch-requests/${dispatchId}/status`,
      payload: { status: 'EN_ROUTE' },
    });
    assert.equal(enRoute.statusCode, 200);

    const grant = await inject('customer', {
      method: 'POST',
      url: `/v1/dispatch-requests/${dispatchId}/location-grants`,
      payload: { ttlMinutes: 15 },
    });
    assert.equal(grant.statusCode, 201);
    const grantId = grant.json<{ id: string }>().id;
    assert.equal(
      (await inject('customer', {
        method: 'PATCH',
        url: `/v1/dispatch-requests/${dispatchId}/location-grants/${grantId}`,
        payload: { lat: 13.061, lng: 80.25 },
      })).statusCode,
      200,
    );
    const providerLocation = await inject('provider', { method: 'GET', url: `/v1/dispatch-requests/${dispatchId}/live-location` });
    assert.equal(providerLocation.statusCode, 200);

    assert.equal(
      (await inject('customer', {
        method: 'POST',
        url: `/v1/dispatch-requests/${dispatchId}/chat`,
        payload: { body: 'I am near the main entrance.' },
      })).statusCode,
      201,
    );
    const chat = await inject('provider', { method: 'GET', url: `/v1/dispatch-requests/${dispatchId}/chat` });
    assert.equal(chat.statusCode, 200);
    assert.equal(chat.json<Array<unknown>>().length, 1);

    const customer = await database.getRepository(User).findOneByOrFail({
      issuer: identities.customer!.issuer,
      subject: identities.customer!.subject,
    });
    const award = await inject('admin', {
      method: 'POST',
      url: '/v1/admin/rewards/awards',
      payload: {
        userId: customer.id,
        points: 500,
        sourceType: 'INTEGRATION',
        sourceId: 'platform-e2e',
        idempotencyKey: 'platform-award-001',
      },
    });
    assert.equal(award.statusCode, 201);
    const wallet = await inject('customer', { method: 'GET', url: '/v1/rewards/wallet' });
    assert.equal(wallet.statusCode, 200);
    assert.ok(wallet.json<{ balance: number }>().balance >= 500);

    const featureFlag = await inject('admin', {
      method: 'PATCH',
      url: '/v1/admin/feature-flags/property_module',
      payload: { enabled: true, config: {} },
    });
    assert.equal(featureFlag.statusCode, 200);

    const property = await inject('provider', {
      method: 'POST',
      url: '/v1/properties',
      payload: {
        providerId,
        title: 'NearFind Integration Apartment',
        description: 'Property integration fixture near useful services.',
        address: 'Mount Road',
        city: 'Chennai',
        priceMinor: 50000000,
        currency: 'INR',
        propertyType: 'APARTMENT',
        lat: 13.061,
        lng: 80.25,
      },
    });
    assert.equal(property.statusCode, 201);
    const propertyId = property.json<{ id: string }>().id;
    assert.equal(
      (await inject('admin', {
        method: 'PATCH',
        url: `/v1/admin/properties/${propertyId}/status`,
        payload: { status: 'PUBLISHED' },
      })).statusCode,
      200,
    );
    const publicProperty = await app.getHttpAdapter().getInstance().inject({ method: 'GET', url: `/v1/properties/${propertyId}` });
    assert.equal(publicProperty.statusCode, 200);
    assert.ok(Array.isArray(publicProperty.json<{ nearbyServices: unknown[] }>().nearbyServices));

    const inspection = await inject('customer', {
      method: 'POST',
      url: `/v1/properties/${propertyId}/inspection-bookings`,
      payload: {
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        idempotencyKey: 'platform-inspection-001',
      },
    });
    assert.equal(inspection.statusCode, 201);

    const emergency = await app.getHttpAdapter().getInstance().inject({ method: 'GET', url: '/v1/emergency/config' });
    assert.equal(emergency.statusCode, 200);
    assert.match(emergency.json<{ disclaimer: string }>().disclaimer, /separate/i);
  });
});
