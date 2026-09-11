/**
 * mobile/capacitor.config.ts — the MSIGN merchant app (docs/CONTRACTS.md §24).
 *
 * The app is a native shell that opens the HOSTED merchant console, so every console change ships
 * without an App Store release. Exactly ONE value ties the app to a deployment: the console URL.
 *
 *   MSIGN_APP_URL   where the console lives (default: the Vercel deployment). When MTech hosts it on
 *                   their site, set this to that address and rebuild — nothing else changes.
 *   MSIGN_APP_ID    the bundle / application id (default com.mtechdistributors.msign). Fixed forever
 *                   after the first store submission.
 *
 * No Supabase keys or secrets live in the app; the website's own environment holds them.
 */
import type { CapacitorConfig } from '@capacitor/cli'

const url = process.env.MSIGN_APP_URL ?? 'https://msign-iota.vercel.app'
const host = new URL(url).host

const config: CapacitorConfig = {
  appId: process.env.MSIGN_APP_ID ?? 'com.mtechdistributors.msign',
  appName: 'MSIGN',
  webDir: 'www',
  server: {
    url,
    // Hosts the in-app browser may show. Anything else (e.g. "Call MTech" tel: links, external
    // web pages) opens in the system browser/dialer.
    allowNavigation: [host, '*.supabase.co', '*.vercel.app', '*.mtechdistributors.com', 'accounts.google.com'],
  },
  ios: {
    scheme: 'MSIGN',
    // The web content draws edge to edge; the console pads itself with env(safe-area-inset-*).
    contentInset: 'never',
    backgroundColor: '#f5f6fa',
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    backgroundColor: '#f5f6fa',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 800,
      backgroundColor: '#5b57e8',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#ffffff',
    },
  },
}

export default config
