# 01 — Prototype Analysis and Screen Traceability

## Visual system

The prototype includes a design brief named **Candy — Playful & Vibrant**, with the north star **“Joyful Pop.”** Its defining characteristics are:

| Token | Prototype value | Production semantic use |
|---|---|---|
| Primary | `#e040a0` | primary CTA, active nav, high-emphasis brand |
| Secondary | `#7c52aa` | secondary CTA, tags, rewards |
| Tertiary | `#0096cc` | info, navigation, map-related emphasis |
| Background | `#fef7ff` | app background |
| Font | DM Sans | headings, body, labels |
| Card radius | 16–20px | content surfaces |
| Button shape | pill/full | primary/secondary controls |

The prototype’s generated CSS suppresses focus outlines. **Do not carry that behavior forward.** Production web must have visible keyboard focus.

## Supplied screens

### Core discovery/navigation

- `explore_home_nearby_services` — home feed, search, quick category chips, filters, nearby service cards, radar scan
- `interactive_map_filter_overlay` — full map, search/filter overlay, marker detail card, map controls
- `categories_directory_browser` — curated collections + category directory + trending places
- `service_detail_route_guide` — provider detail, route/call/share/save, rates, amenities, reviews, start navigation
- `turn_by_turn_gps_navigation_live_hud` — navigation HUD, upcoming turn, route map, add-stop chips, route/end/SOS/share controls
- `fuel_price_comparison_smart_route_optimizer` — fuel/EV type selector, route optimization recommendation, ranked stops, detour/price intelligence

### Safety/support

- `saved_emergency_hub` — emergency call shortcuts, saved places, ICE contacts, offline city data, emergency settings
- `emergency_sos_live_roadside_dispatch` — live roadside dispatch state, ETA, location, contact notification, safety checklist, strobe concept
- `in_app_live_chat_dispatch_support` — dispatcher/agent chat, call, live pin, photo/voice-note attachments, traffic/child context chips
- `driver_alerts_notification_center` — critical alerts, price drops, reward events, filtering and notification preferences

### Community and reputation

- `add_report_service_community_contribution` — report/update place, fuel/ATM state, GPS pin, proof photo, attestation, community feed
- `ratings_reviews_community_photo_gallery` — gallery, review filters, reviews, helpful/reply/report, create review
- `scout_rewards_community_leaderboard` — profile level, redeemable perks, challenges, leaderboard, report-to-earn CTA

### Booking/profile

- `service_booking_bay_reservation` — vehicle selection, service selection, date/time slot, notes, pricing and payment method
- `user_profile_vehicle_settings` — user summary, vehicles, ICE contacts, offline maps, safety sensor settings, export/privacy/logout

### Property feature

- `real_estate_land_listings` — sale/rent/lease tabs, categories, listing cards, map view, saved/inquiry actions
- `property_detail_inspection` — property specs, pricing, nearby telemetry context, inspection/virtual-tour booking

### Incomplete prototype screens

- `sign_in_welcome` — supplied HTML body is empty
- `sign_up_preferences` — supplied HTML body is empty

Create these from the production auth requirements while keeping the Candy design system.

## Mobile navigation inferred from prototypes

Use a 5-tab bottom navigation for the consumer mobile app:

1. Explore
2. Browse/Categories or Radar (configurable by phase)
3. Saved & SOS
4. Contribute/Rewards (contextual based on product phase)
5. Profile

Notifications remain reachable from the app bar. Navigation sessions and live dispatch are immersive full-screen routes outside the normal tab shell.

## Web adaptation

Prototype screenshots are tall mobile canvases. Desktop web should use the same information architecture but adapt layout:

- top app bar + left navigation rail at >= 1024px
- Explore: search/filter header, 38–42% results pane, 58–62% map pane
- Service details: two-column content + sticky action/booking card
- Saved/SOS: emergency panel fixed near top; saved places in cards/table depending width
- Contributions/Rewards/Profile: max-width content shell with responsive cards
- Dispatch/chat: map/dispatch information on left and chat/status timeline on right
- Property listing: filter/sidebar + result grid/map split

See `09-UI-RESPONSIVE-SPEC.md` for breakpoints and states.

## Product-scope observation

The prototype combines a driver-service product with property listings. To keep the core coherent, ship property features behind a feature flag and separate module/navigation entry. Do not let property code leak into core service-discovery domain logic.
