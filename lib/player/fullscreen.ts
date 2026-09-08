/**
 * lib/player/fullscreen.ts — BROWSER ONLY. One shared cooldown between FullscreenPrompt (enters
 * fullscreen on any tap) and ExitFullscreenHotspot (five corner taps exit): a manual exit blocks
 * the auto re-entry for a few seconds, otherwise the very next tap would undo it; after that a
 * single tap re-enters as usual (docs/CONTRACTS.md §17). Module state on purpose — it must
 * survive re-renders and reset on a page reload.
 */
let blockedUntil = 0

export function isAutoFullscreenSuppressed(): boolean {
  return Date.now() < blockedUntil
}

/** Block FullscreenPrompt's tap-to-enter for `ms` from now (0 clears the block). */
export function suppressAutoFullscreenFor(ms: number): void {
  blockedUntil = Date.now() + ms
}
