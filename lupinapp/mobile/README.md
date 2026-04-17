# Sticky Lupin Mobile

Android-first Flutter MVP for a memo-inspired mobile reader shell.

This scaffold is designed to carry over the desktop app's strengths:

- compact yellow memo surface
- supported-site presets
- per-site CSS and JS injection
- saved preferences and last-opened site
- text-first reading mode

## Current status

This folder now contains:

- Flutter app source scaffold
- generated `android/` and `ios/` platform folders
- asset injection files
- local Flutter SDK at `.tools/flutter`
- product docs

Code-level validation completed:

- `flutter pub get`
- `flutter analyze`
- `flutter build apk --debug`

Current blocker for Android device builds:

- no Android emulator or physical device is connected yet

## Recommended stack

- Flutter `>=3.24.0`
- Dart `>=3.5.0`
- `flutter_inappwebview: ^6.1.5`
- `shared_preferences: ^2.5.4`

## MVP scope

- Android APK first
- no backend
- local persistence only
- site presets for Novelpia, Munpia, Joara, KakaoPage
- memo-tone webview shell
- reader typography controls

## Important files

```text
mobile/
  pubspec.yaml
  README.md
  docs/
    mobile-mvp.md
  assets/
    injection/
      catalog_surface.css
      common_surface.css
      munpia_reader.js
      novelpia_reader.js
      reader_surface.css
  lib/
    main.dart
    app/
      sticky_lupin_mobile_app.dart
    features/
      reader/
        data/
          reader_store.dart
        domain/
          reader_preferences.dart
          site_preset.dart
        presentation/
          reader_shell_page.dart
        services/
          injection_loader.dart
```

## Next steps

1. Install Android Studio / Android SDK
2. Run `flutter doctor -v`
3. If needed, point Flutter to the SDK with:

   ```bash
   flutter config --android-sdk "<path-to-android-sdk>"
   ```

4. Start an emulator or connect a device
5. Run `flutter run`
6. Tune selectors in `assets/injection/*.js`

## Latest build output

- Debug APK:

  ```text
  build\app\outputs\flutter-apk\app-debug.apk
  ```

## Notes

- This scaffold assumes APK-first validation before any public app store plan.
- If public distribution becomes a goal, product differentiation beyond a thin webview wrapper will matter.
