# 09 — UI, Design Tokens and Responsive Specification

## Design tokens

Create semantic tokens, for example:

```ts
brand.primary = #e040a0
brand.secondary = #7c52aa
brand.tertiary = #0096cc
surface.canvas = #fef7ff
surface.card = #ffffff
text.primary = #2e1a28
text.muted = #604868
radius.card = 18px
radius.control = 9999px
```

Validate text/background combinations for WCAG contrast. The original palette may need darker semantic text variants even when preserving brand accents.

## Typography

DM Sans across platforms where licensing/package allows. Use platform-safe fallback. Suggested scale:

- Display: 32/38, 700
- H1: 28/34, 700
- H2: 22/28, 700
- H3: 18/24, 700
- Body: 16/24, 400/500
- Label: 14/20, 600
- Caption: 12/16, 500

## Interaction

- tappable mobile target >= 44x44pt
- keyboard web controls fully operable
- visible focus ring
- 150–220ms standard transitions
- small scale/lift may echo prototype, but disable/reduce on reduced-motion
- never animate map/critical emergency UI in a way that delays action

## Breakpoints

- mobile: `< 768px`
- tablet: `768–1023px`
- desktop: `1024–1439px`
- wide: `>= 1440px`

## Web layouts

### Explore/map

Desktop: left result pane 38–42%, right map 58–62%; map sticks to viewport. Tablet supports collapsible drawer. Mobile uses separate list/map toggle or bottom sheet.

### Service detail

Desktop max content width ~1280px. Main detail column plus sticky action card containing route/call/save/booking. Mobile actions remain reachable through compact sticky bottom action group where safe.

### Dispatch/chat

Desktop: status/timeline/map + chat side panel. Mobile: status card and chat as dedicated route/bottom sheet. SOS/cancel controls require confirmation appropriate to severity.

### Forms

Desktop forms max width 720–840px; split logically into cards. Mobile stays single column. Never hide validation only in toast; show field-level errors.

## Required screen states

Every screen must define:

- initial loading/skeleton
- empty state
- recoverable error + retry
- offline/limited connectivity
- permission denied where relevant
- no results
- partial/stale live-data indicator
- unauthorized/expired session behavior

## Visual regression set

At minimum snapshot:

- Explore mobile + desktop
- Map overlay mobile + desktop
- Service detail mobile + desktop
- Saved/SOS mobile
- Contribution form
- Alerts
- Booking
- Dispatch status
- Chat
- Profile
- Fuel optimizer
- Rewards
- Property list/detail when enabled
