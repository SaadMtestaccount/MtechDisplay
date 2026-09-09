/**
 * lib/player/platform.ts — BROWSER ONLY. Detects the MSIGN Android app's WebView so player
 * affordances that only make sense in a browser (the corner exit hotspot — the app runs in
 * Android immersive mode, not browser fullscreen) can switch themselves off (docs/CONTRACTS.md §18).
 * The app appends "MSIGN-Android/<version>" to its user agent (1.2+); older builds are caught by
 * Android WebView's standard "; wv)" marker.
 */
export function isAndroidWebView(): boolean {
  if (typeof navigator === 'undefined') return false
  return /MSIGN-Android\/|\bwv\b/.test(navigator.userAgent)
}
