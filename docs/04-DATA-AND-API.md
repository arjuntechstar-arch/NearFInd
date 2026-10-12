# 04 — Data Model and API Contract Guide

## Core entities

Use normalized persistence with explicit migrations. Suggested entities:

- `User`, `UserPreference`, `UserSessionReference`
- `Vehicle`, `EmergencyContact`
- `ServiceCategory`, `ServiceProvider`, `ServiceLocation`, `OperatingHours`, `Amenity`
- `FuelProduct`, `FuelPriceObservation`, `EVConnector`, `ServiceStatusObservation`
- `Favorite`
- `Contribution`, `ContributionEvidence`, `ModerationDecision`
- `Review`, `ReviewMedia`, `ReviewReaction`, `ReviewReport`
- `RewardLedgerEntry`, `Challenge`, `ChallengeProgress`, `Perk`, `PerkRedemption`
- `Booking`, `BookingServiceLine`, `ProviderSlot`, `PaymentReference`
- `DispatchRequest`, `DispatchAssignment`, `DispatchEvent`, `LiveLocationGrant`
- `ChatThread`, `ChatParticipant`, `ChatMessage`, `ChatAttachment`
- `Notification`, `NotificationPreference`, `DevicePushToken`
- `RouteSession`, `RouteOptimizationResult`
- `PropertyListing`, `PropertyMedia`, `InspectionBooking`
- `AuditEvent`, `FeatureFlag`

## Sensitive-field handling

Encrypt selected sensitive fields at application/KMS layer where threat model requires it (for example emergency contact phone and sensitive dispatch notes). Keep exact live-location data short-lived. Do not store full navigation histories indefinitely by default.

## API resource examples

```text
GET    /v1/places/nearby
GET    /v1/places/:placeId
GET    /v1/categories
POST   /v1/favorites
DELETE /v1/favorites/:placeId
POST   /v1/contributions
GET    /v1/reviews?placeId=...
POST   /v1/reviews
POST   /v1/route-optimizations
POST   /v1/bookings
GET    /v1/bookings/:bookingId
POST   /v1/bookings/:bookingId/cancel
POST   /v1/dispatch-requests
GET    /v1/dispatch-requests/:id
POST   /v1/dispatch-requests/:id/cancel
POST   /v1/dispatch-requests/:id/location-grants
DELETE /v1/dispatch-requests/:id/location-grants/:grantId
GET    /v1/notifications
PATCH  /v1/notifications/:id/read
GET    /v1/rewards/wallet
POST   /v1/perks/:perkId/redemptions
GET    /v1/properties
GET    /v1/properties/:id
POST   /v1/properties/:id/inspection-bookings
```

## Nearby query parameters

Example contract:

```text
lat, lng                 required unless location/search context is provided
radiusMeters             bounded, e.g. 100–50000
categoryIds[]            bounded list
openNow                  bool
minRating                decimal 0–5
amenityIds[]             bounded list
fuelTypes[]              enum list
evConnectorTypes[]       enum list
bbox                     optional viewport query
cursor                    opaque cursor
limit                     max 50
```

Validate coordinate ranges and all enum/filter values server-side.

## API error shape

Use a consistent problem-details structure:

```json
{
  "type": "https://errors.spotnear.example/booking-slot-conflict",
  "title": "Booking slot is no longer available",
  "status": 409,
  "code": "BOOKING_SLOT_CONFLICT",
  "traceId": "...",
  "errors": []
}
```

Do not expose stack traces, SQL, internal hostnames or secret identifiers.

## Optimistic concurrency

For resources with concurrent edits (provider data, dispatch, moderation, booking admin updates), use a version column/ETag or compare-and-swap update. Return `409` on stale updates.

## Webhook handling

Payment/provider webhooks must:

- verify provider signature
- enforce timestamp/replay window
- persist provider event ID and reject duplicates
- acknowledge quickly and process asynchronously when suitable
- never trust callback URL/query parameters for authorization
