/**
 * types/db.ts — hand-written mirror of supabase/migrations/0001_schema.sql (tables),
 * 0002_triggers.sql and 0003_functions.sql (functions). Row shapes live in types/rows.ts and
 * are re-exported here; this file holds the supabase-js `Database` shape, its relationships
 * and functions, and the helper aliases. Whoever changes a migration changes both files.
 *
 * Usage: `createClient<Database>(...)`, `Tables<'screens'>`, `DbClient`.
 * The `Screen` alias shadows the DOM global `Screen` inside modules that import it: reference
 * the browser screen as `window.screen`. There is deliberately no `Event` alias (use `EventRow`).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ContentRow, ContentType, EventRow, FolderRow, MembershipRole, MembershipRow, OrganizationRow,
  PairingCodeRow, PlaylistItemRow, PlaylistItemType, PlaylistKind, PlaylistRow, ProfileRow,
  ScreenGroupRow, ScreenRow, TransitionType, WebsiteRow,
} from './rows'

export * from './rows'

// ---------------------------------------------------------------------------
// Builders for the supabase-js Database shape
// ---------------------------------------------------------------------------
/** Insert shape: `Optional` keys (defaults / nullable) become optional, the rest stay required. */
type Ins<Row, Optional extends keyof Row> = Omit<Row, Optional> & Partial<Pick<Row, Optional>>

type FK<Name extends string, Col extends string, Ref extends string, One extends boolean = false> = {
  foreignKeyName: Name
  columns: [Col]
  isOneToOne: One
  referencedRelation: Ref
  referencedColumns: ['id']
}

type Table<Row, Optional extends keyof Row, Rels extends FK<string, string, string, boolean>[]> = {
  Row: Row
  Insert: Ins<Row, Optional>
  Update: Partial<Row>
  Relationships: Rels
}

export type Database = {
  __InternalSupabase: { PostgrestVersion: '12' }
  public: {
    Tables: {
      organizations: Table<OrganizationRow, 'id' | 'logo_url' | 'timezone' | 'created_at', []>
      profiles: Table<ProfileRow, 'full_name' | 'avatar_url' | 'is_super_admin' | 'subscription_tier' | 'created_at', []>
      memberships: Table<
        MembershipRow,
        'id' | 'role' | 'created_at',
        [FK<'memberships_org_id_fkey', 'org_id', 'organizations'>, FK<'memberships_user_id_fkey', 'user_id', 'profiles'>]
      >
      folders: Table<FolderRow, 'id' | 'created_at', [FK<'folders_org_id_fkey', 'org_id', 'organizations'>]>
      content: Table<
        ContentRow,
        | 'id' | 'folder_id' | 'thumb_path' | 'size_bytes' | 'width' | 'height'
        | 'duration_seconds' | 'expires_at' | 'created_by' | 'created_at',
        [
          FK<'content_org_id_fkey', 'org_id', 'organizations'>,
          FK<'content_folder_id_fkey', 'folder_id', 'folders'>,
          FK<'content_created_by_fkey', 'created_by', 'profiles'>,
        ]
      >
      websites: Table<WebsiteRow, 'id' | 'refresh_seconds' | 'created_at', [FK<'websites_org_id_fkey', 'org_id', 'organizations'>]>
      playlists: Table<PlaylistRow, 'id' | 'updated_at' | 'created_at', [FK<'playlists_org_id_fkey', 'org_id', 'organizations'>]>
      playlist_items: Table<
        PlaylistItemRow,
        | 'id' | 'position' | 'content_id' | 'website_id' | 'duration_seconds' | 'transition' | 'mute'
        | 'active_from' | 'active_to' | 'days_of_week' | 'daily_start' | 'daily_end' | 'created_at',
        [
          FK<'playlist_items_playlist_id_fkey', 'playlist_id', 'playlists'>,
          FK<'playlist_items_content_id_fkey', 'content_id', 'content'>,
          FK<'playlist_items_website_id_fkey', 'website_id', 'websites'>,
        ]
      >
      /** playlist_id is UNIQUE (group and playlist are 1:1) — a reverse embed from playlists yields an object. */
      screen_groups: Table<
        ScreenGroupRow,
        'id' | 'created_at',
        [FK<'screen_groups_org_id_fkey', 'org_id', 'organizations'>, FK<'screen_groups_playlist_id_fkey', 'playlist_id', 'playlists', true>]
      >
      /** playlist_id is UNIQUE among non-null values (a screen playlist belongs to one screen) — reverse embed yields an object. */
      screens: Table<
        ScreenRow,
        | 'id' | 'playlist_id' | 'group_id' | 'menu_id' | 'locked' | 'device_token_hash' | 'fingerprint' | 'login_code'
        | 'rotation' | 'last_seen_at' | 'last_ip' | 'user_agent' | 'resolution' | 'current_item_id' | 'playlist_version'
        | 'paired_at' | 'created_at',
        [
          FK<'screens_org_id_fkey', 'org_id', 'organizations'>,
          FK<'screens_playlist_id_fkey', 'playlist_id', 'playlists', true>,
          FK<'screens_group_id_fkey', 'group_id', 'screen_groups'>,
          FK<'screens_menu_id_fkey', 'menu_id', 'playlists'>,
          FK<'screens_current_item_id_fkey', 'current_item_id', 'playlist_items'>,
        ]
      >
      pairing_codes: Table<
        PairingCodeRow,
        'id' | 'expires_at' | 'claimed_screen_id' | 'created_at',
        [FK<'pairing_codes_claimed_screen_id_fkey', 'claimed_screen_id', 'screens'>]
      >
      events: Table<
        EventRow,
        'id' | 'screen_id' | 'payload' | 'created_at',
        [FK<'events_org_id_fkey', 'org_id', 'organizations'>, FK<'events_screen_id_fkey', 'screen_id', 'screens'>]
      >
    }
    Views: { [_ in never]: never }
    Functions: {
      is_super_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      is_org_member: { Args: { p_org_id: string }; Returns: boolean }
      can_write_org: { Args: { p_org_id: string }; Returns: boolean }
      playlist_org_id: { Args: { p_playlist_id: string }; Returns: string | null }
      bump_screen_versions: { Args: { p_screen_ids: string[] }; Returns: string[] }
      bump_playlist_version: { Args: { p_playlist_id: string }; Returns: string[] }
    }
    Enums: {
      membership_role: MembershipRole
      content_type: ContentType
      playlist_kind: PlaylistKind
      playlist_item_type: PlaylistItemType
      transition_type: TransitionType
    }
    CompositeTypes: { [_ in never]: never }
  }
}

// ---------------------------------------------------------------------------
// Convenience helpers and row aliases
// ---------------------------------------------------------------------------
type PublicSchema = Database['public']
export type TableName = keyof PublicSchema['Tables']
export type Tables<T extends TableName> = PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends TableName> = PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends TableName> = PublicSchema['Tables'][T]['Update']
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T]

/** A typed supabase-js client (browser, server-session or service-role — same type). */
export type DbClient = SupabaseClient<Database>

export type Organization = Tables<'organizations'>
export type Profile = Tables<'profiles'>
export type Membership = Tables<'memberships'>
export type Folder = Tables<'folders'>
export type Content = Tables<'content'>
export type Website = Tables<'websites'>
export type Playlist = Tables<'playlists'>
export type PlaylistItem = Tables<'playlist_items'>
export type ScreenGroup = Tables<'screen_groups'>
export type Screen = Tables<'screens'>
export type PairingCode = Tables<'pairing_codes'>
