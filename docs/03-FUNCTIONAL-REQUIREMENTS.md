# 03 — Functional Requirements and Acceptance Criteria

## A. Identity and onboarding

Users can sign in, sign out, revoke sessions, delete/export account data, set display profile, choose service preferences, add vehicles, configure emergency contacts and independently control location/notification permissions.

**Acceptance:** denied location permission still allows manual city/search; revoked notification permission does not break the app; session expiry is handled without data loss; account deletion requires re-authentication.

## B. Explore / search / categories

Users can search nearby places by name/category, browse map/list, apply category/open-now/rating/distance/amenity/fuel/EV filters, and change location manually.

**Acceptance:** queries are debounced/cancellable; results show loading/empty/error states; map and list remain synchronized; map marker clustering works; filters are shareable in URL on web where appropriate.

## C. Place detail

Show identity, verified/open status, distance/ETA, address, contact, amenities, live price/status fields, reviews/media, and actions: route, call, share, save, report. Provider-controlled and community-controlled fields must be distinguishable.

## D. Saved & emergency hub

Users can bookmark places and access key saved/emergency data offline. ICE contacts can be created/edited/deleted. Emergency-call action uses local emergency number configuration and clearly states whether the action is a normal phone call versus a private roadside service request.

## E. Community contributions

Users can submit a new place or update live facts such as fuel price, ATM cash status, charger availability or service status. Submissions can include GPS and evidence photo. Apply reputation/rate limits, duplicate detection and moderation. Reward points are granted only after rules permit it, not merely because the client says a report was submitted.

## F. Ratings/reviews/photos

Verified users can write reviews, attach permitted photos, mark reviews helpful, reply where role allows, and report abusive content. Server applies moderation and abuse rules. Aggregate rating is derived server-side.

## G. Fuel/EV optimizer

Given current/selected route and vehicle/fuel profile, rank eligible stops by a transparent score such as total trip cost, detour time, price freshness/confidence, charging compatibility and service availability. Expose why a stop is recommended.

Do not present crowdsourced price as guaranteed current price. Show source/freshness/confidence.

## H. Navigation

Provide route preview, step guidance abstraction, add-stop suggestions and navigation handoff/in-app guidance depending provider capabilities. Persist only route-session data required for the user experience; avoid indefinite location history by default.

## I. Alerts

Users see categorized alerts and control alert preferences. Alerts include critical road/safety, price changes, contribution/reward events and service updates. Read/unread state syncs across devices.

## J. Service booking

Users select vehicle, service, date/time slot, notes and payment method. The server reserves capacity atomically. Payment flow should prefer authorization/hosted fields so card details never touch SpotNear servers.

Required booking behavior: slot conflict prevention, idempotent checkout, cancellation policy, provider/admin update workflow, receipt/confirmation.

## K. Roadside support & dispatch

User requests private roadside help with category, vehicle, location, contact preference and optional notes/media. Dispatcher/provider assignment follows an explicit state machine. User sees ETA/status and can chat/call the assigned support contact.

Live location sharing is opt-in, visible, revocable and automatically expires after the incident or configured TTL.

## L. Chat

Text, image, optional voice-note, quick contextual chips and live-pin share. Features: delivery/read status where feasible, reconnect handling, attachment validation, abuse/reporting, message retention policy, authorization on every thread.

## M. Rewards

XP/points are ledger entries, never a mutable client-owned balance. Challenges and perks have validity windows, redemption limits and anti-fraud rules. Leaderboard has privacy controls and excludes banned/fraudulent accounts.

## N. Profile/vehicles/privacy

Manage vehicles, preferred fuel/EV connectors, emergency contacts, offline packs, notification preferences, privacy/export/delete account, active sessions and logout.

## O. Property listings — feature flagged

Browse sale/rent/lease listings, view property detail, save, request information, schedule in-person/virtual inspection. Clearly separate property data/roles from nearby-service provider entities.

## P. Operations/admin web

A production system needs an authenticated operations area even though the prototype focuses on consumer UI. Implement role-gated screens for:

- place/provider verification and edits
- contribution/review/photo moderation
- service/booking schedule management
- dispatch queue and incident timeline
- notification campaign/alert management with safeguards
- reward/perk management
- property listing moderation if enabled
- user sanctions/appeals with audit trail
- configuration and feature flags

All privileged actions require server authorization and audit logging.
