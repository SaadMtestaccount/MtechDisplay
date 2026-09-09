import { PlayerApp } from '@/components/player/PlayerApp'

const BOOT_ID = 'player-boot'

// Runs during parsing on every engine (ES5): shows the browser identity under the boot message,
// and inside the MSIGN Android app swaps the advice to "update Android System WebView".
const BOOT_SCRIPT = `try{var ua=navigator.userAgent;document.getElementById("${BOOT_ID}-ua").textContent=ua;if(ua.indexOf("MSIGN-Android")>-1){document.getElementById("${BOOT_ID}-text").textContent="If this message stays on screen, this box's browser (Android System WebView) is too old for MSIGN. Update Android System WebView from the Play Store, or use a newer box."}}catch(e){}`

/**
 * /player — the TV player. Everything lives in the PlayerApp state machine (§10).
 * The boot message is server-rendered above the player and removed when PlayerApp mounts; on a
 * TV browser too old to run the script it simply stays, with the browser's identity underneath
 * so support can tell what the TV is (§20).
 */
export default function PlayerPage() {
  return (
    <>
      <div id={BOOT_ID} className="pl-boot">
        <div className="pl-boot-title">Starting MSIGN…</div>
        <div className="pl-boot-text" id={`${BOOT_ID}-text`}>
          If this message stays on screen, this TV&apos;s browser is too old to run MSIGN. Use the MSIGN app on an
          Android TV stick, or a newer TV.
        </div>
        <div className="pl-boot-fine" id={`${BOOT_ID}-ua`} />
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </div>
      <PlayerApp />
    </>
  )
}
