-- =============================================================================
-- MSIGN — 0003_functions.sql
-- Helper predicates (used by RLS, storage and realtime policies) and versioning
-- functions. Requires 0002_triggers.sql.
--
-- Tenancy model (v1): every user is a super admin. RLS still scopes by org through
-- memberships so a future merchant portal only needs membership rows, no policy changes.
--   select  -> is_org_member(org_id)  (member of the org OR super admin)
--   write   -> can_write_org(org_id)  (owner/admin of the org OR super admin)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper predicates (security definer so they can read profiles/memberships without
-- recursing into RLS; search_path pinned to public)
-- -----------------------------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_super_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
      or exists (
           select 1
             from public.memberships m
            where m.org_id = p_org_id
              and m.user_id = auth.uid()
         );
$$;

create or replace function public.can_write_org(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
      or exists (
           select 1
             from public.memberships m
            where m.org_id = p_org_id
              and m.user_id = auth.uid()
              and m.role in ('owner', 'admin')
         );
$$;

-- Org of a playlist (used by playlist_items policies, which have no org_id column).
create or replace function public.playlist_org_id(p_playlist_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.org_id from public.playlists p where p.id = p_playlist_id;
$$;

-- Supabase grants EXECUTE on new public functions to anon by default, which would expose
-- them at /rest/v1/rpc/* (playlist_org_id would leak org ids). Policies run as
-- `authenticated`, which keeps EXECUTE.
revoke execute on function
  public.is_super_admin(), public.is_org_member(uuid), public.can_write_org(uuid),
  public.playlist_org_id(uuid)
from public, anon;
grant execute on function
  public.is_super_admin(), public.is_org_member(uuid), public.can_write_org(uuid),
  public.playlist_org_id(uuid)
to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Versioning functions (security INVOKER: RLS of the caller applies; the service role
-- bypasses RLS, a super admin passes the policies, anyone else updates zero rows)
-- -----------------------------------------------------------------------------

-- Increments playlist_version on the given screens and returns the ids actually updated.
create or replace function public.bump_screen_versions(p_screen_ids uuid[])
returns setof uuid
language sql
set search_path = public
as $$
  update public.screens s
     set playlist_version = s.playlist_version + 1
   where s.id = any (p_screen_ids)
  returning s.id;
$$;

-- Touches playlists.updated_at and increments playlist_version on every screen whose
-- EFFECTIVE playlist is p_playlist_id (group playlist if the screen is in a group,
-- otherwise the screen's own playlist). Returns the affected screen ids.
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
   where (s.group_id is null and s.playlist_id = p_playlist_id)
      or (s.group_id is not null and exists (
            select 1
              from public.screen_groups g
             where g.id = s.group_id
               and g.playlist_id = p_playlist_id))
  returning s.id;
$$;

revoke execute on function public.bump_screen_versions(uuid[]) from public, anon;
revoke execute on function public.bump_playlist_version(uuid) from public, anon;
grant  execute on function public.bump_screen_versions(uuid[]) to authenticated, service_role;
grant  execute on function public.bump_playlist_version(uuid) to authenticated, service_role;
