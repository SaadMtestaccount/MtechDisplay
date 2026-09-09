import { PlayerApp } from '@/components/player/PlayerApp'

const BOOT_ID = 'player-boot'

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
        <div className="pl-boot-text">
          If this message stays on screen, this TV&apos;s browser is too old to run MSIGN. Use the MSIGN app on an
          Android TV stick, or a newer TV.
        </div>
        <div className="pl-boot-fine" id={`${BOOT_ID}-ua`} />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.getElementById(${JSON.stringify(`${BOOT_ID}-ua`)}).textContent=navigator.userAgent}catch(e){}`,
          }}
        />
      </div>
      <PlayerApp />
    </>
  )
}
