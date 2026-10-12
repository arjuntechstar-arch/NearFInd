# 13 — Prototype-to-Route Traceability

| Prototype | Web route | Mobile route | Major backend modules | Primary test focus |
|---|---|---|---|---|
| explore_home_nearby_services | `/explore` | `/(tabs)/explore` | Search/Geo, Places | geo filters, map/list sync |
| interactive_map_filter_overlay | `/explore?view=map` | `/map` | Search/Geo | clustering, viewport query |
| categories_directory_browser | `/categories` | `/(tabs)/categories` | Categories, Places | browse/filter |
| service_detail_route_guide | `/places/[id]` | `/places/[id]` | Places, Reviews, Routing | ownership-safe reads, stale live data |
| turn_by_turn_gps_navigation_live_hud | `/navigation/[sessionId]` | `/navigation/[sessionId]` | Routing | permission/offline/re-route |
| fuel_price_comparison_smart_route_optimizer | `/fuel-optimizer` | `/fuel-optimizer` | Fuel, Routing | ranking explanation/freshness |
| saved_emergency_hub | `/saved` and `/safety` | `/(tabs)/saved` | Favorites, Emergency Contacts | offline cache/privacy |
| emergency_sos_live_roadside_dispatch | `/roadside/[id]` | `/roadside/[id]` | Dispatch | state machine/reconnect/location TTL |
| in_app_live_chat_dispatch_support | `/roadside/[id]/chat` | `/roadside/[id]/chat` | Chat/Realtime | auth, reconnect, upload validation |
| driver_alerts_notification_center | `/alerts` | `/alerts` | Notifications | read sync/preferences |
| add_report_service_community_contribution | `/contribute` | `/(tabs)/contribute` | Contributions, Moderation | abuse, evidence upload |
| ratings_reviews_community_photo_gallery | `/places/[id]/reviews` | `/places/[id]/reviews` | Reviews/Media | moderation, upload safety |
| scout_rewards_community_leaderboard | `/rewards` | `/rewards` | Rewards | ledger/fraud/privacy |
| service_booking_bay_reservation | `/places/[id]/book` | `/places/[id]/book` | Bookings, Payments | slot race/idempotency |
| user_profile_vehicle_settings | `/profile` | `/(tabs)/profile` | Profile, Vehicles | PII access, export/delete |
| real_estate_land_listings | `/properties` | `/properties` | Property | feature flag/search |
| property_detail_inspection | `/properties/[id]` | `/properties/[id]` | Property, Inspection | booking conflicts |
| sign_in_welcome | `/auth/sign-in` | `/auth/sign-in` | Identity | auth/session errors |
| sign_up_preferences | `/onboarding` | `/onboarding` | Identity/Profile | permission choices |

Operations routes should live under `/ops/*` on web and are not required in the consumer mobile app.
