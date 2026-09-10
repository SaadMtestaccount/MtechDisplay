/**
 * types/rows.ts — enums and row shapes, one per table in supabase/migrations/0001_schema.sql.
 * Re-exported by types/db.ts: application code imports from '@/types/db'.
 * timestamptz/date/time columns arrive as ISO strings; numeric/bigint as number.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// ---------------------------------------------------------------------------
// Enums (public.*)
// ---------------------------------------------------------------------------
export type MembershipRole = 'owner' | 'admin' | 'member'
export type ContentType = 'image' | 'video'
export type PlaylistKind = 'screen' | 'group' | 'menu'
export type PlaylistItemType = 'content' | 'website'
export type TransitionType = 'none' | 'fade'

/** events.type check constraint — the only values the database accepts. */
export const EVENT_TYPES = [
  'screen_paired',
  'screen_online',
  'screen_offline',
  'screen_deleted',
  'playlist_updated',
  'content_uploaded',
  'content_deleted',
] as const
export type EventType = (typeof EVENT_TYPES)[number]

// ---------------------------------------------------------------------------
// Row shapes — exactly the SQL columns
// ---------------------------------------------------------------------------
export type OrganizationRow = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  timezone: string
  created_at: string
}

export type ProfileRow = {
  id: string
  full_name: string | null
  avatar_url: string | null
  is_super_admin: boolean
  /** dummy per-merchant subscription label; set by the super admin (types/api SubscriptionTier). */
  subscription_tier: string
  /** Set on an employee login: the merchant (owner) login it belongs to (0014). */
  employer_id: string | null
  created_at: string
}

export type MembershipRow = {
  id: string
  org_id: string
  user_id: string
  role: MembershipRole
  created_at: string
}

export type FolderRow = {
  id: string
  org_id: string
  name: string
  created_at: string
}

export type ContentRow = {
  id: string
  org_id: string
  folder_id: string | null
  name: string
  type: ContentType
  storage_path: string
  thumb_path: string | null
  mime: string
  size_bytes: number
  width: number | null
  height: number | null
  duration_seconds: number | null
  expires_at: string | null
  created_by: string | null
  created_at: string
}

export type WebsiteRow = {
  id: string
  org_id: string
  name: string
  url: string
  refresh_seconds: number
  created_at: string
}

export type PlaylistRow = {
  id: string
  org_id: string
  name: string
  kind: PlaylistKind
  /** Synchronized playback: TVs on this playlist follow the shared server clock (0015, §21). */
  sync: boolean
  /** When sync was turned on — the loop's shared starting line (0017); null when off. */
  sync_started_at: string | null
  updated_at: string
  created_at: string
}

export type PlaylistItemRow = {
  id: string
  playlist_id: string
  position: number
  item_type: PlaylistItemType
  content_id: string | null
  website_id: string | null
  duration_seconds: number | null
  transition: TransitionType
  mute: boolean
  active_from: string | null
  active_to: string | null
  days_of_week: number[] | null
  daily_start: string | null
  daily_end: string | null
  created_at: string
}

export type ScreenGroupRow = {
  id: string
  org_id: string
  name: string
  playlist_id: string
  created_at: string
}

export type ScreenRow = {
  id: string
  org_id: string
  name: string
  playlist_id: string | null
  group_id: string | null
  /** Assigned reusable menu (kind='menu' playlist); overrides group_id and playlist_id (0009). */
  menu_id: string | null
  /** Wall lock: pins the assignment; reassignment refused until unlocked (0009). */
  locked: boolean
  device_token_hash: string | null
  /** Device fingerprint of the TV bound to this screen (0007); null when unpaired. */
  fingerprint: string | null
  /** Persistent 8-char login code entered on a TV to enroll it as this screen (0010). */
  login_code: string | null
  rotation: number
  /** 'landscape' | 'portrait' — portrait = upright 9:16 player stage (0012). Narrow with isOrientation. */
  orientation: string
  /** "Powered by MTech" badge centre as fractions of the stage; both null = default corner (0013). */
  watermark_x: number | null
  watermark_y: number | null
  /** Per-TV synchronized playback (0016); the manifest ORs it with the playlist's flag (§21). */
  sync: boolean
  /** When sync was turned on — the loop's shared starting line (0017); null when off. */
  sync_started_at: string | null
  last_seen_at: string | null
  last_ip: string | null
  user_agent: string | null
  resolution: string | null
  current_item_id: string | null
  playlist_version: number
  paired_at: string | null
  created_at: string
}

/** Service-role only. Holds the sha256 of the device token (never the token) until an admin claims the code. */
export type PairingCodeRow = {
  id: string
  /** 6 chars from PAIRING_CODE_ALPHABET (DB check constraint) */
  code: string
  device_fingerprint: string
  device_token_hash: string
  expires_at: string
  claimed_screen_id: string | null
  created_at: string
}

export type EventRow = {
  id: string
  org_id: string
  screen_id: string | null
  type: EventType
  payload: Json
  created_at: string
}
