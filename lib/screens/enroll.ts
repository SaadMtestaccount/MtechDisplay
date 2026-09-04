/**
 * lib/screens/enroll.ts — SERVER ONLY (service role). Log a TV into a screen by its login code
 * (docs/CONTRACTS.md §15). The code is globally unique, so it identifies the screen and its org.
 * Mints a fresh device token (revoking any previous device on that screen).
 */
import { ApiError } from '@/lib/api'
import { notifyOrgChanged } from '@/lib/broadcast'
import { generateDeviceToken, hashDeviceToken } from '@/lib/pairing'
import { normalizeLoginCode } from '@/lib/screens/codes'
import type { PlayerDeviceState } from '@/types/api'
import type { DbClient } from '@/types/db'

export async function enrollScreen(admin: DbClient, code: string, fingerprint: string): Promise<PlayerDeviceState> {
  const normalized = normalizeLoginCode(code)
  const { data: screen, error } = await admin
    .from('screens')
    .select('id, org_id')
    .eq('login_code', normalized)
    .maybeSingle()
  if (error) throw error
  if (!screen) throw new ApiError(404, "That code didn't match any screen. Check the code on your MSIGN dashboard.")

  const token = generateDeviceToken()
  const { error: updateError } = await admin
    .from('screens')
    .update({ device_token_hash: hashDeviceToken(token), fingerprint, paired_at: new Date().toISOString() })
    .eq('id', screen.id)
  if (updateError) throw updateError

  await notifyOrgChanged(screen.org_id, 'screens', screen.id)
  return { device_token: token, screen_id: screen.id }
}
