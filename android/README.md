# MSIGN TV — Android app

Kiosk WebView shell around the MSIGN web player (`/player`). All features (merchant login,
pairing, playback, live updates, media caching) come from the web app, so content and most
product changes reach installed TVs **without shipping a new APK**.

## Builds

| Build | Loads | Use |
|---|---|---|
| `assembleDebug` | `http://10.0.2.2:3000` (your PC from the emulator, cleartext) | local testing against `pnpm dev` / `pnpm start` |
| `assembleRelease` | the production URL in `app/build.gradle.kts` (`BASE_URL`) | the APK you give merchants |

Toolchain (no Android Studio needed):

```powershell
$env:JAVA_HOME = "C:\Users\Computer 2\.local\jdkx\jdk-17.0.20.1+1"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
cd android
& "C:\Users\Computer 2\.local\gradlex\gradle-8.11.1\bin\gradle.bat" assembleRelease
# → app\build\outputs\apk\release\app-release.apk
```

## Signing

Release APKs are signed with `android/msign-release.jks` (alias `msign`); the passwords live in
`android/keystore.properties`. **Keep both files** — Android only accepts updates signed with the
same key. Neither belongs in version control if this folder ever gets one.

## Sideloading onto a TV / stick

1. Copy the APK to a USB drive (or a file-manager download link).
2. On the device: Settings → Security → allow "Install unknown apps" for the file manager.
3. Open the APK from the file manager → Install → open MSIGN.
4. The TV shows an "Enter code" screen. On the MSIGN site, **TVs → Add TV** (or **Show code** on
   an existing TV) gives an 8-character code; type it on the TV.
5. It starts playing that TV's content immediately; if nothing is assigned yet it shows the
   store logo and clock (or "Please contact MTech with photos and videos of the digital menu."
   when the location has no content at all).

Version history: 1.0 (2026-09-03) first release · 1.1 (2026-09-08) indigo launcher icon /
TV banner matching the redesigned console. The web player itself updates without a new APK.

Emulator install: `adb install -r app\build\outputs\apk\debug\app-debug.apk`.
