-- =============================================================================
-- MSIGN — 0001_schema.sql
-- Enums, tables, constraints and indexes.
-- Apply in order: 0001_schema -> 0002_triggers -> 0003_functions -> 0004_rls
--                 -> 0005_storage -> 0006_realtime
-- Mirror: types/rows.ts (row shapes) + types/db.ts (Database, relationships, functions).
-- Whoever changes one changes the other, column for column.
-- gen_random_uuid() is a core Postgres function (13+): no extension is required.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.membership_role    as enum ('owner', 'admin', 'member');
create type public.content_type       as enum ('image', 'video');
create type public.playlist_kind      as enum ('screen', 'group');
create type public.playlist_item_type as enum ('content', 'website');
create type public.transition_type    as enum ('none', 'fade');

-- -----------------------------------------------------------------------------
-- Tables (creation order respects foreign keys)
-- -----------------------------------------------------------------------------

-- One organization = one merchant. Deleting an org cascades to everything it owns.
create table public.organizations (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  slug       text        not null unique,
  logo_url   text,
  timezone   text        not null default 'America/New_York',
  created_at timestamptz not null default now()
);

-- One row per auth.users row, created by the on_auth_user_created trigger (0002).
-- is_super_admin is only ever set by the seed script / invite flow (service role).
create table public.profiles (
  id             uuid        primary key references auth.users (id) on delete cascade,
  full_name      text,
  avatar_url     text,
  is_super_admin boolean     not null default false,
  created_at     timestamptz not null default now()
);

-- Kept for a future merchant portal; v1 users are all super admins.
create table public.memberships (
  id         uuid                   primary key default gen_random_uuid(),
  org_id     uuid                   not null references public.organizations (id) on delete cascade,
  user_id    uuid                   not null references public.profiles (id) on delete cascade,
  role       public.membership_role not null default 'member',
  created_at timestamptz            not null default now(),
  unique (org_id, user_id)
);

create table public.folders (
  id         uuid        primary key default gen_random_uuid(),
  org_id     uuid        not null references public.organizations (id) on delete cascade,
  name       text        not null,
  created_at timestamptz not null default now()
);

create table public.content (
  id               uuid                primary key default gen_random_uuid(),
  org_id           uuid                not null references public.organizations (id) on delete cascade,
  folder_id        uuid                references public.folders (id) on delete set null,
  name             text                not null,
  type             public.content_type not null,
  storage_path     text                not null,  -- object key inside bucket "media":  {org_id}/{content_id}.{ext}
  thumb_path       text,                          -- object key inside bucket "thumbs": {org_id}/{content_id}-thumb.jpg
  mime             text                not null,
  size_bytes       bigint              not null default 0,
  width            integer,
  height           integer,
  duration_seconds numeric,                       -- videos only, detected client-side, fractional seconds allowed
  expires_at       timestamptz,                   -- expired when expires_at < now(); excluded from manifests
  created_by       uuid                references public.profiles (id) on delete set null,
  created_at       timestamptz         not null default now()
);

create table public.websites (
  id              uuid        primary key default gen_random_uuid(),
  org_id          uuid        not null references public.organizations (id) on delete cascade,
  name            text        not null,
  url             text        not null,
  refresh_seconds integer     not null default 0 check (refresh_seconds >= 0),  -- 0 = never reload
  created_at      timestamptz not null default now()
);

-- kind = 'screen': the screen's own playlist (1:1, created with the screen)
-- kind = 'group' : the group's playlist (1:1, created with the group)
create table public.playlists (
  id         uuid                 primary key default gen_random_uuid(),
  org_id     uuid                 not null references public.organizations (id) on delete cascade,
  name       text                 not null,
  kind       public.playlist_kind not null,
  updated_at timestamptz          not null default now(),   -- maintained by trigger (0002)
  created_at timestamptz          not null default now()
);

create table public.playlist_items (
  id               uuid                      primary key default gen_random_uuid(),
  playlist_id      uuid                      not null references public.playlists (id) on delete cascade,
  position         integer                   not null default 0 check (position >= 0),
  item_type        public.playlist_item_type not null,
  content_id       uuid                      references public.content (id) on delete cascade,
  website_id       uuid                      references public.websites (id) on delete cascade,
  duration_seconds integer                   check (duration_seconds is null or duration_seconds > 0),  -- override; null = default
  transition       public.transition_type    not null default 'fade',
  mute             boolean                   not null default true,
  active_from      date,                     -- inclusive, evaluated in the org timezone
  active_to        date,                     -- inclusive
  days_of_week     integer[],                -- 0 = Sunday ... 6 = Saturday; null/empty = every day
  daily_start      time,                     -- daily window start; start > end means an overnight window
  daily_end        time,
  created_at       timestamptz               not null default now(),
  constraint playlist_items_target_check check (
    (item_type = 'content' and content_id is not null and website_id is null) or
    (item_type = 'website' and website_id is not null and content_id is null)
  ),
  constraint playlist_items_days_check check (
    days_of_week is null or days_of_week <@ array[0, 1, 2, 3, 4, 5, 6]
  ),
  constraint playlist_items_range_check check (
    active_from is null or active_to is null or active_from <= active_to
  )
);

-- A group's playlist is 1:1 with the group (unique): deleting the playlist deletes the group.
create table public.screen_groups (
  id          uuid        primary key default gen_random_uuid(),
  org_id      uuid        not null references public.organizations (id) on delete cascade,
  name        text        not null,
  playlist_id uuid        not null unique references public.playlists (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- Effective playlist = screen_groups.playlist_id when group_id is set, else screens.playlist_id.
-- playlist_id is "set null" on playlist delete so a playlist deletion never orphans a screen row;
-- lib/screens.ts deleteScreen deletes the screen first and then its own playlist.
-- playlist_id must reference a kind='screen' playlist and screen_groups.playlist_id a kind='group'
-- one (assert_playlist_kind triggers, 0002); playlist_id is unique among non-null values (below).
-- current_item_id is what the device last reported; the heartbeat only stores ids that exist
-- in the screen's effective playlist (stale ids become null), so the FK never rejects a heartbeat.
create table public.screens (
  id                uuid        primary key default gen_random_uuid(),
  org_id            uuid        not null references public.organizations (id) on delete cascade,
  name              text        not null,
  playlist_id       uuid        references public.playlists (id) on delete set null,
  group_id          uuid        references public.screen_groups (id) on delete set null,
  device_token_hash text,                          -- sha256 hex of the raw device token; null = unpaired or revoked
  rotation          integer     not null default 0 check (rotation in (0, 90, 180, 270)),
  last_seen_at      timestamptz,
  last_ip           text,
  user_agent        text,
  resolution        text,
  current_item_id   uuid        references public.playlist_items (id) on delete set null,
  playlist_version  integer     not null default 0,
  paired_at         timestamptz,
  created_at        timestamptz not null default now()
);

-- Service-role only (no RLS policies, table grants revoked in 0004). The raw device token is
-- generated together with the code and returned to the device exactly once
-- (POST /api/device/pairing-code); only its sha256 hash is stored here and copied onto
-- screens.device_token_hash when an admin claims the code. No secret is ever at rest.
-- device_fingerprint (chosen by the device, required) must match on every pairing-status poll.
-- code alphabet = PAIRING_CODE_ALPHABET in types/api.ts (no 0/O/1/I), exactly 6 chars.
create table public.pairing_codes (
  id                 uuid        primary key default gen_random_uuid(),
  code               text        not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  device_fingerprint text        not null,
  device_token_hash  text        not null,   -- sha256 hex of the raw token; never the token itself
  expires_at         timestamptz not null default (now() + interval '15 minutes'),
  claimed_screen_id  uuid        references public.screens (id) on delete set null,
  created_at         timestamptz not null default now()
);

create table public.events (
  id         uuid        primary key default gen_random_uuid(),
  org_id     uuid        not null references public.organizations (id) on delete cascade,
  screen_id  uuid        references public.screens (id) on delete set null,
  type       text        not null check (type in (
               'screen_paired', 'screen_online', 'screen_offline', 'screen_deleted',
               'playlist_updated', 'content_uploaded', 'content_deleted')),
  payload    jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Indexes (every FK + hot lookups; screen_groups.playlist_id is covered by its unique constraint,
-- memberships.org_id by the leading column of the unique (org_id, user_id) constraint)
-- -----------------------------------------------------------------------------
create index memberships_user_id_idx              on public.memberships (user_id);
create index folders_org_id_idx                   on public.folders (org_id);
create index content_org_folder_idx               on public.content (org_id, folder_id);
create index content_folder_id_idx                on public.content (folder_id);   -- FK action on folder delete
create index content_org_expires_idx              on public.content (org_id, expires_at);   -- per-org countExpired / deleteExpired
create index content_expires_at_idx               on public.content (expires_at)
  where expires_at is not null;                                                    -- cron: cross-org "expired since last tick" window
create index content_created_by_idx               on public.content (created_by);
create index websites_org_id_idx                  on public.websites (org_id);
create index playlists_org_id_idx                 on public.playlists (org_id);
create index playlist_items_playlist_position_idx on public.playlist_items (playlist_id, position);
create index playlist_items_content_id_idx        on public.playlist_items (content_id);
create index playlist_items_website_id_idx        on public.playlist_items (website_id);
create index screen_groups_org_id_idx             on public.screen_groups (org_id);
create index screens_org_id_idx                   on public.screens (org_id);
-- A kind='screen' playlist belongs to exactly one screen (1:1); also serves the FK action on
-- playlist delete (playlist_id = $1 implies "is not null", so the partial index is usable).
create unique index screens_playlist_id_key       on public.screens (playlist_id)
  where playlist_id is not null;
create index screens_group_id_idx                 on public.screens (group_id);
create index screens_current_item_id_idx          on public.screens (current_item_id);
create index screens_last_seen_at_idx             on public.screens (last_seen_at);
create unique index screens_device_token_hash_key on public.screens (device_token_hash)
  where device_token_hash is not null;
create index pairing_codes_expires_at_idx         on public.pairing_codes (expires_at);
create index pairing_codes_claimed_screen_id_idx  on public.pairing_codes (claimed_screen_id);
create index events_org_created_idx               on public.events (org_id, created_at desc);
create index events_screen_created_idx            on public.events (screen_id, created_at desc);
