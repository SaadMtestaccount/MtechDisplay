-- =============================================================================
-- MSIGN — 0002_triggers.sql
-- Trigger functions and triggers. Requires 0001_schema.sql.
--   set_updated_at        -> playlists.updated_at
--   handle_new_user       -> one profiles row per auth.users row
--   assert_same_org       -> cross-organization FK guard (content.folder_id,
--                            screens.playlist_id / group_id, screen_groups.playlist_id)
--   assert_item_same_org  -> playlist_items.content_id / website_id vs the playlist's org
--   assert_playlist_kind  -> screens.playlist_id must be kind 'screen', screen_groups.playlist_id
--                            must be kind 'group' (the cascades and bump_playlist_version rely on it)
-- =============================================================================

-- Generic updated_at maintenance (applied to playlists; reuse for any future updated_at column).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger playlists_set_updated_at
  before update on public.playlists
  for each row execute function public.set_updated_at();

-- Auto-create the profile row for every new auth user (security definer: runs as the owner,
-- so it works regardless of who inserted the auth.users row — signup, invite or admin API).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Cross-organization reference guard. Every v1 user is a super admin, so RLS alone never
-- stops an org A row from pointing at an org B row; this trigger does (errcode 23503, which
-- lib/api.ts withHandler maps to 422). Arguments: tg_argv[0] = referenced table,
-- tg_argv[1] = FK column on the row being written. Nulls pass through.
create or replace function public.assert_same_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fk  uuid;
  v_org uuid;
begin
  execute format('select ($1).%I', tg_argv[1]) into v_fk using new;
  if v_fk is null then
    return new;
  end if;
  execute format('select org_id from public.%I where id = $1', tg_argv[0]) into v_org using v_fk;
  if v_org is distinct from new.org_id then
    raise exception 'cross-organization reference %.% -> %', tg_table_name, tg_argv[1], tg_argv[0]
      using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger content_folder_same_org
  before insert or update of folder_id on public.content
  for each row execute function public.assert_same_org('folders', 'folder_id');

create trigger screens_playlist_same_org
  before insert or update of playlist_id on public.screens
  for each row execute function public.assert_same_org('playlists', 'playlist_id');

create trigger screens_group_same_org
  before insert or update of group_id on public.screens
  for each row execute function public.assert_same_org('screen_groups', 'group_id');

create trigger screen_groups_playlist_same_org
  before insert or update of playlist_id on public.screen_groups
  for each row execute function public.assert_same_org('playlists', 'playlist_id');

-- playlist_items has no org_id column: compare the target's org with the playlist's org.
create or replace function public.assert_item_same_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org    uuid;
  v_target uuid;
begin
  select p.org_id into v_org from public.playlists p where p.id = new.playlist_id;
  if new.content_id is not null then
    select c.org_id into v_target from public.content c where c.id = new.content_id;
  elsif new.website_id is not null then
    select w.org_id into v_target from public.websites w where w.id = new.website_id;
  else
    return new;
  end if;
  if v_target is distinct from v_org then
    raise exception 'cross-organization reference playlist_items -> %',
      coalesce(new.content_id, new.website_id)
      using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger playlist_items_same_org
  before insert or update of playlist_id, content_id, website_id on public.playlist_items
  for each row execute function public.assert_item_same_org();

-- Playlist kind guard. screens.playlist_id -> kind 'screen' (1:1 with the screen, deleted by
-- deleteScreen), screen_groups.playlist_id -> kind 'group' (1:1 with the group, ON DELETE CASCADE).
-- A screen pointing at a group playlist would make deleteScreen cascade-delete the group and break
-- bump_playlist_version / usage counts. tg_argv[0] = the required kind. Nulls pass through.
create or replace function public.assert_playlist_kind()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind public.playlist_kind;
begin
  if new.playlist_id is null then
    return new;
  end if;
  select p.kind into v_kind from public.playlists p where p.id = new.playlist_id;
  if v_kind is distinct from tg_argv[0]::public.playlist_kind then
    raise exception 'playlist % is not of kind %', new.playlist_id, tg_argv[0]
      using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger screens_playlist_kind
  before insert or update of playlist_id on public.screens
  for each row execute function public.assert_playlist_kind('screen');

create trigger screen_groups_playlist_kind
  before insert or update of playlist_id on public.screen_groups
  for each row execute function public.assert_playlist_kind('group');

-- Trigger functions are never called directly (a trigger-returning function cannot be invoked
-- through PostgREST, and firing a trigger does not check EXECUTE), so drop the default grants.
revoke execute on function
  public.set_updated_at(), public.handle_new_user(),
  public.assert_same_org(), public.assert_item_same_org(), public.assert_playlist_kind()
from public, anon, authenticated;
