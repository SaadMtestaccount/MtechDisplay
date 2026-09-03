/**
 * lib/organizations.ts — organization CRUD + logo upload (docs/CONTRACTS.md §5.22). Server-only.
 */
import type { DbClient, Organization, TablesUpdate } from '@/types/db'
import { LOGO_MIMES, MAX_LOGO_BYTES, type OrganizationView } from '@/types/api'
import { ApiError } from '@/lib/api'
import type { SessionContext } from '@/lib/auth'
import { notifyOrgChanged } from '@/lib/broadcast'
import { syncOrgScreens } from '@/lib/screens'
import { logoExtensionForMime, logoPath, publicUrl, removeOrgObjects } from '@/lib/storage'
import { slugify } from '@/lib/utils'
import type { OrgCreateInput, OrgUpdateInput } from '@/lib/validators/orgs'

export const ORG_VIEW_SELECT = '*, screens(count), content(count)' as const

type OrgSource = Organization & { screens: { count: number }[]; content: { count: number }[] }

function toOrgView(row: OrgSource): OrganizationView {
  const { screens, content, ...org } = row
  return { ...org, screen_count: screens[0]?.count ?? 0, content_count: content[0]?.count ?? 0 }
}

export async function listOrgViews(supabase: DbClient): Promise<OrganizationView[]> {
  const { data, error } = await supabase.from('organizations').select(ORG_VIEW_SELECT).order('name', { ascending: true })
  if (error) throw error
  return data.map(toOrgView)
}

export async function getOrgView(supabase: DbClient, id: string): Promise<OrganizationView> {
  const { data, error } = await supabase.from('organizations').select(ORG_VIEW_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) throw new ApiError(404, 'Organization not found')
  return toOrgView(data)
}

async function getOrg(supabase: DbClient, id: string): Promise<Organization> {
  const { data, error } = await supabase.from('organizations').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) throw new ApiError(404, 'Organization not found')
  return data
}

/** `slugify(name)`, made unique with `-2`, `-3`, … against the existing slugs. */
async function uniqueSlug(supabase: DbClient, name: string): Promise<string> {
  const base = slugify(name) || 'org'
  const { data, error } = await supabase.from('organizations').select('slug').like('slug', `${base}%`)
  if (error) throw error
  const taken = new Set(data.map((r) => r.slug))
  if (!taken.has(base)) return base
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`
    if (!taken.has(candidate)) return candidate
  }
}

export async function createOrg(ctx: SessionContext, input: OrgCreateInput): Promise<Organization> {
  const slug = await uniqueSlug(ctx.supabase, input.name)
  const { data, error } = await ctx.supabase
    .from('organizations')
    .insert({ name: input.name, slug, ...(input.timezone ? { timezone: input.timezone } : {}) })
    .select('*')
    .single()
  if (error) throw error
  await notifyOrgChanged(data.id, 'orgs', data.id)
  return data
}

/** Players refetch the manifest (org name / timezone / logo travel with it) when any of those changed. */
async function afterOrgChange(admin: DbClient, before: Organization, after: Organization): Promise<Organization> {
  const changed =
    before.name !== after.name || before.timezone !== after.timezone || before.logo_url !== after.logo_url
  if (changed) await syncOrgScreens(admin, after.id)
  await notifyOrgChanged(after.id, 'orgs', after.id)
  return after
}

export async function updateOrg(
  ctx: SessionContext,
  admin: DbClient,
  id: string,
  input: OrgUpdateInput,
): Promise<Organization> {
  const before = await getOrg(ctx.supabase, id)
  const patch: TablesUpdate<'organizations'> = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.timezone !== undefined) patch.timezone = input.timezone
  if (input.logo_url !== undefined) patch.logo_url = input.logo_url
  const { data, error } = await ctx.supabase.from('organizations').update(patch).eq('id', id).select('*').single()
  if (error) throw error
  return afterOrgChange(admin, before, data)
}

/** Best-effort storage cleanup, then the row (everything the org owns cascades). */
export async function deleteOrg(ctx: SessionContext, admin: DbClient, id: string): Promise<void> {
  await getOrg(ctx.supabase, id)
  await removeOrgObjects(admin, id)
  const { error } = await ctx.supabase.from('organizations').delete().eq('id', id)
  if (error) throw error
  await notifyOrgChanged(id, 'orgs', id)
}

export async function uploadOrgLogo(ctx: SessionContext, admin: DbClient, id: string, file: File): Promise<Organization> {
  const before = await getOrg(ctx.supabase, id)
  const isLogoMime = (LOGO_MIMES as readonly string[]).includes(file.type)
  const ext = isLogoMime ? logoExtensionForMime(file.type) : null
  if (ext === null) throw new ApiError(422, 'Logo must be a JPEG, PNG, WebP, GIF or SVG image')
  if (file.size > MAX_LOGO_BYTES) throw new ApiError(413, 'Logo must be 5 MB or smaller')

  const key = logoPath(id, ext)
  const { error: uploadError } = await admin.storage
    .from('logos')
    .upload(key, file, { upsert: true, contentType: file.type })
  if (uploadError) throw new ApiError(500, `Logo upload failed: ${uploadError.message}`)

  const logo_url = `${publicUrl('logos', key)}?v=${Date.now()}`
  const { data, error } = await ctx.supabase.from('organizations').update({ logo_url }).eq('id', id).select('*').single()
  if (error) throw error
  return afterOrgChange(admin, before, data)
}
