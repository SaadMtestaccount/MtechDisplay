import { InfoIcon } from 'lucide-react'

/**
 * Helper text under the /websites header (docs/CONTRACTS.md §9.3): sites that block iframes
 * (X-Frame-Options / CSP) render blank on screens — Preview is the way to test.
 */
export function IframeNotice() {
  return (
    <div className="mb-6 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      <InfoIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p>
        Some sites block embedding (X-Frame-Options or CSP) and will not render on screens. Use Preview to test a site
        before adding it to a playlist.
      </p>
    </div>
  )
}
