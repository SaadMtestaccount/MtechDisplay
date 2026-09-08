/**
 * lib/player/fullscreen.ts — BROWSER ONLY. One shared flag between FullscreenPrompt (auto-enters
 * fullscreen on any tap) and ExitFullscreenHotspot (five corner taps toggle it): a manual exit
 * suppresses the auto re-entry, otherwise the very next tap would undo it (docs/CONTRACTS.md §17).
 * Module state on purpose — it must survive re-renders and reset on a page reload.
 */
let suppressed = false

export function isAutoFullscreenSuppressed(): boolean {
  return suppressed
}

export function setAutoFullscreenSuppressed(value: boolean): void {
  suppressed = value
}
