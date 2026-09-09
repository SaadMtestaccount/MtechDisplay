/**
 * lib/player/engine.ts — BROWSER ONLY. Feature test for ES2020 syntax (`??`, `?.`), which the
 * Supabase realtime client ships and older TV engines (LG webOS 5/6 ≈ Chrome 68/79) cannot
 * parse. The player only loads that client when this passes; otherwise it relies on the 30 s
 * heartbeat for updates (docs/CONTRACTS.md §20). Evaluated once — engines don't change.
 */
let cached: boolean | null = null

export function supportsModernSyntax(): boolean {
  if (cached !== null) return cached
  try {
    // A syntax error here throws at Function construction on old engines.
    cached = new Function('return (null ?? 1) === 1 && ({}).a?.b === undefined')() === true
  } catch {
    cached = false
  }
  return cached
}
