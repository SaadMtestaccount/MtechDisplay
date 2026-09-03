/**
 * lib/device-auth.ts — SERVER ONLY. Resolves the Bearer device token of /api/device/* requests
 * to a screen row (by sha256 hash). Missing, unknown or revoked (nulled hash) → 401.
 */
import { ApiError } from '@/lib/api'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashDeviceToken } from '@/lib/pairing'
import type { DbClient, Screen } from '@/types/db'

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  const token = match?.[1]?.trim()
  return token && token.length > 0 ? token : null
}

export async function authenticateDevice(request: Request, admin?: DbClient): Promise<Screen> {
  const token = bearerToken(request)
  if (!token) throw new ApiError(401, 'Unauthorized')
  const client = admin ?? createAdminClient()
  const { data, error } = await client
    .from('screens')
    .select('*')
    .eq('device_token_hash', hashDeviceToken(token))
    .maybeSingle()
  if (error) throw new ApiError(500, error.message)
  if (!data || data.device_token_hash === null) throw new ApiError(401, 'Unauthorized')
  return data
}

/** x-forwarded-for first hop → x-real-ip → null */
export function getRequestIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const real = request.headers.get('x-real-ip')?.trim()
  return real && real.length > 0 ? real : null
}
