# MSIGN merchant app (iPhone / iPad / Android)

A native shell (Capacitor 7) around the hosted merchant console. Merchants get an App Store /
Play Store app with an icon, full-screen UI, splash screen and the phone's own photo picker; every
console change ships instantly because the app loads the live site.

One value ties the app to a deployment — the console URL (`MSIGN_APP_URL`, see
`capacitor.config.ts`). No secrets live in the app.

## First time on a Mac (iOS)

Needs Xcode 16+ (App Store), Node 20+, pnpm, and an Apple ID on the MTech developer team.
The `ios/` and `android/` projects are committed, so a clone is ready to build.

```bash
cd mobile
pnpm install
pnpm assets:make            # draws assets/icon.png + splash.png (and the site's PWA icons)
pnpm assets:fanout          # writes every iOS/Android icon + splash size into the native projects
npx cap sync
npx cap open ios            # Xcode opens the project
```

In Xcode: select the **App** target → Signing & Capabilities → Team = MTech Distributors
(automatic signing). Pick a simulator or a plugged-in iPhone and press Run.

To point the app at MTech's hosting instead of Vercel:

```bash
MSIGN_APP_URL=https://msign.mtechdistributors.com npx cap sync
```

## Ship to TestFlight / the App Store

1. Xcode → Product → Archive (scheme **App**, destination *Any iOS Device*).
2. Organizer → Distribute App → App Store Connect → Upload.
3. appstoreconnect.apple.com → the MSIGN app → TestFlight: add testers; App Store → fill the
   listing (name, description, screenshots, support URL, privacy policy URL, review demo login)
   → Submit for Review.

Bump `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` in Xcode for each upload.

## Android (works on Windows too)

```bash
cd mobile
pnpm install && pnpm assets:make
pnpm assets:fanout && npx cap sync
npx cap open android        # or: cd android && ./gradlew assembleRelease
```

Sign the release with `android/msign-release.jks` (same keystore as the TV app is NOT reused —
this is a different application id; create a new upload key for Play).
