/**
 * lib/validators/device.ts — /api/device/* schemas (docs/CONTRACTS.md §5.27).
 * `heartbeatSchema` is annotated with `HeartbeatRequest` so a drift from types/api.ts is a compile error.
 */
import { z } from 'zod'
import type { HeartbeatRequest } from '@/types/api'
import { uuidSchema } from '@/lib/validators/common'
import { pairingCodeSchema } from '@/lib/validators/screens'

/** The player always sends one (persisted at `msign.fingerprint`). */
export const fingerprintSchema = z.string().trim().min(8).max(200)

/** POST /api/device/pairing-code */
export const pairingCodeRequestSchema = z.object({ fingerprint: fingerprintSchema })
export type PairingCodeRequestInput = z.infer<typeof pairingCodeRequestSchema>

/** POST /api/device/enroll — the TV operator types a screen's login code (may include a dash). */
export const enrollRequestSchema = z.object({
  code: z.string().trim().min(1).max(20),
  fingerprint: fingerprintSchema,
})
export type EnrollRequestInput = z.infer<typeof enrollRequestSchema>

/** `[code]` path segment of GET /api/device/pairing-status/[code] */
export const pairingCodeParamSchema = pairingCodeSchema

/** `?fingerprint=` of GET /api/device/pairing-status/[code] */
export const pairingStatusQuerySchema = z.object({ fingerprint: fingerprintSchema })
export type PairingStatusQuery = z.infer<typeof pairingStatusQuerySchema>

/** POST /api/device/heartbeat */
export const heartbeatSchema: z.ZodType<HeartbeatRequest> = z.object({
  current_item_id: uuidSchema.nullable().default(null),
  resolution: z.string().trim().max(40).optional(),
  playlist_version: z.number().int().min(-1),
  uptime_seconds: z.number().min(0).optional(),
})
