# Sticky Lupin Mobile MVP

## Project basics

- Project name: Sticky Lupin Mobile
- One-line description: memo-style text-first mobile reader shell for supported web novel sites
- Primary goal: ship an Android APK quickly, validate usage, then decide whether to deepen product scope
- Main user: existing Sticky Lupin desktop user

## Technical stack

- Frontend: Flutter
- Runtime: Dart
- Web renderer: `flutter_inappwebview`
- Local persistence: `shared_preferences`
- Backend: none
- Deployment target: Android APK first, iOS shell second

## Core product decisions

### Keep

- memo-tone reading surface
- site presets
- typography controls
- local recent pages and site switching
- site-specific CSS and JS tuning

### Skip for MVP

- account system
- sync
- push notifications
- store release hardening
- offline library

## Primary screens

1. Home / preset strip
2. Reader webview shell
3. Settings bottom sheet

## Supported-site strategy

- Novelpia: strong candidate for first-pass support
- Munpia: second supported site with custom reader cleanup
- Joara: lighter support
- KakaoPage: browsing only until reader flow is clarified

## Reader behaviors

- yellow memo shell stays constant
- loading state uses the same memo tone
- content pages get stronger typography rules
- catalog pages get lighter cleanup
- preferences are applied on every page load

## Product constraints

- APK first
- no attempt to fully imitate platform-native readers
- external site breakage is expected, so adapters must stay isolated per site
- selectors should live in assets, not hardcoded throughout the UI layer

## Success criteria for v0.1.0

- app launches on Android
- site preset switching works
- user can browse to a chapter page
- injected memo surface applies consistently
- preferences persist across restarts

