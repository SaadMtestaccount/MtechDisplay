/**
 * scripts/seed.ts — `pnpm seed`. Idempotent bootstrap of the MSIGN demo data (docs/CONTRACTS.md §11):
 * super admin, org "MTech Demo", folder, 3 generated placeholder PNGs, one website, 2 unpaired screens.
 * Loads .env.local (then .env) and uses the service-role key. Exits 1 with a clear message on failure.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import type { Database, DbClient } from '../types/db'
import { makePlaceholder, type Rgb } from './seed/png'
import { ensureBuckets, uploadObject } from './seed/storage'
import {
  ensureAdminUser, ensureFolder, ensureMembership, ensureOrg, ensureScreen, ensureWebsite, findContent, upsertContent,
} from './seed/ensure'

config({ path: '.env.local' })
config()

const REQUIRED_ENV = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SEED_ADMIN_EMAIL', 'SEED_ADMIN_PASSWORD'] as const

const IMAGE_W = 1280
const IMAGE_H = 720
const THUMB_W = 320
const THUMB_H = 180

const PLACEHOLDERS: { name: string; color: Rgb }[] = [
  { name: 'Placeholder Purple.png', color: { r: 0x61, g: 0x09, b: 0xb6 } },
  { name: 'Placeholder Teal.png', color: { r: 0x0d, g: 0x94, b: 0x88 } },
  { name: 'Placeholder Amber.png', color: { r: 0xd9, g: 0x77, b: 0x06 } },
]

function readEnv(): Record<(typeof REQUIRED_ENV)[number], string> {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]?.trim())
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')} (set them in .env.local)`)
  }
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL as string,
    SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD as string,
  }
}

async function seedContent(admin: DbClient, orgId: string, userId: string): Promise<string[]> {
  const ids: string[] = []
  for (const { name, color } of PLACEHOLDERS) {
    const id = (await findContent(admin, orgId, name)) ?? randomUUID()
    const full = makePlaceholder(IMAGE_W, IMAGE_H, color)
    const thumb = makePlaceholder(THUMB_W, THUMB_H, color)
    const storagePath = `${orgId}/${id}.png`
    const thumbPath = `${orgId}/${id}-thumb.png`
    await uploadObject(admin, 'media', storagePath, full, 'image/png')
    await uploadObject(admin, 'thumbs', thumbPath, thumb, 'image/png')
    await upsertContent(admin, {
      id,
      org_id: orgId,
      folder_id: null,
      name,
      type: 'image',
      storage_path: storagePath,
      thumb_path: thumbPath,
      mime: 'image/png',
      size_bytes: full.length,
      width: IMAGE_W,
      height: IMAGE_H,
      duration_seconds: null,
      expires_at: null,
      created_by: userId,
    })
    ids.push(id)
    console.log(`  content  ${name} (${full.length} bytes) -> media/${storagePath}`)
  }
  return ids
}

async function main(): Promise<void> {
  const env = readEnv()
  const admin: DbClient = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log('MSIGN seed')
  const createdBuckets = await ensureBuckets(admin)
  console.log(`  buckets  ${createdBuckets.length ? `created ${createdBuckets.join(', ')}` : 'all present'}`)

  const user = await ensureAdminUser(admin, env.SEED_ADMIN_EMAIL, env.SEED_ADMIN_PASSWORD)
  console.log(`  user     ${env.SEED_ADMIN_EMAIL} (${user.created ? 'created' : 'updated'}) super admin`)

  const orgId = await ensureOrg(admin, 'MTech Demo', 'mtech-demo', 'America/New_York')
  await ensureMembership(admin, orgId, user.id)
  console.log(`  org      MTech Demo (${orgId}) owner membership`)

  const folderId = await ensureFolder(admin, orgId, 'Promotions')
  console.log(`  folder   Promotions (${folderId})`)

  const contentIds = await seedContent(admin, orgId, user.id)

  const websiteId = await ensureWebsite(admin, orgId, 'MTech Distributors', 'https://mtechdistributors.com')
  console.log(`  website  MTech Distributors (${websiteId})`)

  const screenIds: string[] = []
  for (const name of ['Demo TV Left', 'Demo TV Right']) {
    const id = await ensureScreen(admin, orgId, name)
    screenIds.push(id)
    console.log(`  screen   ${name} (${id}) unpaired`)
  }

  console.log('')
  console.log('Summary')
  console.log(`  super admin : ${env.SEED_ADMIN_EMAIL} (${user.id})`)
  console.log(`  organization: MTech Demo / mtech-demo (${orgId})`)
  console.log(`  content     : ${contentIds.length} placeholder images`)
  console.log(`  website     : 1`)
  console.log(`  screens     : ${screenIds.length} (unpaired)`)
  console.log('Done.')
}

main().catch((e: unknown) => {
  const message = e instanceof Error ? e.message : String(e)
  console.error(`Seed failed: ${message}`)
  process.exit(1)
})
