/**
 * lib/pairing.ts — SERVER ONLY (node:crypto). Pairing codes and device tokens (decision §0.13):
 * the raw token is minted with the code, returned once, and only its sha256 is stored.
 */
import { createHash, randomBytes, randomInt } from 'node:crypto'
import { ApiError } from '@/lib/api'
import {
  PAIRING_CODE_ALPHABET, PAIRING_CODE_LENGTH, PAIRING_CODE_TTL_MS,
  type PairingCodeResponse, type PairingStatusResponse,
} from '@/types/api'
import type { DbClient } from '@/types/db'

export { PAIRING_CODE_ALPHABET, PAIRING_CODE_LENGTH, PAIRING_CODE_TTL_MS } from '@/types/api'

const CODE_INSERT_ATTEMPTS = 5

export function generatePairingCode(): string {
  let code = ''
  for (let i = 0; i < PAIRING_CODE_LENGTH; i++) {
    code += PAIRING_CODE_ALPHABET[randomInt(PAIRING_CODE_ALPHABET.length)]
  }
  return code
}

export function generateDeviceToken(): string {
  return randomBytes(48).toString('base64url')
}

export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Mints code + token; stores only the hash; retries on a code collision (23505). */
export async function createPairingCode(admin: DbClient, fingerprint: string): Promise<PairingCodeResponse> {
  const token = generateDeviceToken()
  const tokenHash = hashDeviceToken(token)

  for (let attempt = 0; attempt < CODE_INSERT_ATTEMPTS; attempt++) {
    const code = generatePairingCode()
    const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS).toISOString()
    const { data, error } = await admin
      .from('pairing_codes')
      .insert({ code, device_fingerprint: fingerprint, device_token_hash: tokenHash, expires_at: expiresAt })
      .select('code, expires_at')
      .single()
    if (!error && data) {
      return { code: data.code, expires_at: data.expires_at, device_token: token }
    }
    if (error && error.code === '23505') continue
    throw new ApiError(500, error?.message ?? 'Could not create pairing code')
  }
  throw new ApiError(500, 'Could not allocate a unique pairing code')
}

/** 404 whenever the code is unusable by this device (unknown, expired, other fingerprint). */
export async function getPairingStatus(
  admin: DbClient,
  code: string,
  fingerprint: string,
): Promise<PairingStatusResponse> {
  const { data, error } = await admin
    .from('pairing_codes')
    .select('device_fingerprint, expires_at, claimed_screen_id')
    .eq('code', code)
    .maybeSingle()
  if (error) throw new ApiError(500, error.message)
  if (!data || data.device_fingerprint !== fingerprint) throw new ApiError(404, 'Code not found')

  if (data.claimed_screen_id !== null) {
    return { claimed: true, screen_id: data.claimed_screen_id }
  }
  if (new Date(data.expires_at).getTime() <= Date.now()) throw new ApiError(404, 'Code not found')
  return { claimed: false, expires_at: data.expires_at }
}
