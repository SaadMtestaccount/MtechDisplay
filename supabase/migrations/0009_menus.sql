-- =============================================================================
-- MSIGN — 0009_menus.sql
-- Reusable "Menus" + per-screen assignment & lock (the Screen Wall).
--   * A Menu is a kind='menu' playlist (reuses playlists + playlist_items). It is
--     standalone/reusable — referenced by many screens, owned by none.
--   * screens.menu_id assigns a menu to a screen. It OVERRIDES group_id and
--     playlist_id (a shared reference: edit the menu once, every screen updates).
--   * screens.locked pins the assignment; the wall refuses reassignment until unlocked.
-- Requires 0008 (the 'menu' enum value) and 0002/0003.
-- =============================================================================

alter table public.screens
  add column if not exists menu_id uuid references public.playlists (id) on delete set null,
  add column if not exists locked  boolean not null default false;

comment on column public.screens.menu_id is
  'Assigned reusable menu (kind=''menu'' playlist); overrides group_id and playlist_id. Null = none.';
comment on column public.screens.locked is
  'Wall lock: when true the assignment is pinned and reassignment is refused until unlocked.';

create index if not exists screens_menu_id_idx on public.screens (menu_id) where menu_id is not null;

-- Cross-organization guard for menu_id. assert_same_org is generic (reads new.<column>
-- dynamically); the existing screen triggers only fire on playlist_id / group_id.
drop trigger if exists screens_menu_same_org on public.screens;
create trigger screens_menu_same_org
  before insert or update of menu_id on public.screens
  for each row execute function public.assert_same_org('playlists', 'menu_id');

-- Kind guard: menu_id must reference a kind='menu' playlist. assert_playlist_kind is
-- hardcoded to new.playlist_id, so menus need their own tiny guard.
create or replace function public.assert_screen_menu_kind()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind public.playlist_kind;
begin
  if new.menu_id is null then
    return new;
  end if;
  select p.kind into v_kind from public.playlists p where p.id = new.menu_id;
  if v_kind is distinct from 'menu' then
    raise exception 'playlist % is not a menu', new.menu_id using errcode = '23503';
  end if;
  return new;
end;
$$;

drop trigger if exists screens_menu_kind on public.screens;
create trigger screens_menu_kind
  before insert or update of menu_id on public.screens
  for each row execute function public.assert_screen_menu_kind();

revoke execute on function public.assert_screen_menu_kind() from public, anon, authenticated;

-- Teach the version bump about menus: editing a menu reaches every screen showing it, and a
-- menu-assigned screen reacts only to its menu (not its overridden own/group playlist).
-- Backward compatible: for menu_id IS NULL rows this reduces exactly to the previous logic.
create or replace function public.bump_playlist_version(p_playlist_id uuid)
returns setof uuid
language sql
set search_path = public
as $$
  update public.playlists
     set updated_at = now()
   where id = p_playlist_id;

  update public.screens s
     set playlist_version = s.playlist_version + 1
   where s.menu_id = p_playlist_id
      or (s.menu_id is null and s.group_id is null and s.playlist_id = p_playlist_id)
      or (s.menu_id is null and s.group_id is not null and exists (
            select 1
              from public.screen_groups g
             where g.id = s.group_id
               and g.playlist_id = p_playlist_id))
  returning s.id;
$$;

revoke execute on function public.bump_playlist_version(uuid) from public, anon;
grant  execute on function public.bump_playlist_version(uuid) to authenticated, service_role;
