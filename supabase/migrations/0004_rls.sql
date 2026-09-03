-- =============================================================================
-- MSIGN — 0004_rls.sql
-- RLS enablement and table policies. Requires 0003_functions.sql.
--   org-scoped tables: select -> is_org_member(org_id); insert/update/delete -> can_write_org(org_id)
--   playlist_items:    the same through playlist_org_id(playlist_id)
--   pairing_codes:     NO policies and table grants revoked -> service role only
-- Every policy is `to authenticated`: anon-key queries return zero rows on every policy-bearing
-- table; pairing_codes (grants revoked) and every RPC (EXECUTE revoked, 0002/0003) answer
-- `42501 permission denied` instead of `[]`. Both outcomes satisfy acceptance #7.
-- =============================================================================

alter table public.organizations  enable row level security;
alter table public.profiles       enable row level security;
alter table public.memberships    enable row level security;
alter table public.folders        enable row level security;
alter table public.content        enable row level security;
alter table public.websites       enable row level security;
alter table public.playlists      enable row level security;
alter table public.playlist_items enable row level security;
alter table public.screen_groups  enable row level security;
alter table public.screens        enable row level security;
alter table public.pairing_codes  enable row level security;
alter table public.events         enable row level security;

-- -----------------------------------------------------------------------------
-- organizations: members read; only super admins create/update/delete
-- -----------------------------------------------------------------------------
create policy organizations_select on public.organizations
  for select to authenticated
  using (public.is_org_member(id));

create policy organizations_insert on public.organizations
  for insert to authenticated
  with check (public.is_super_admin());

create policy organizations_update on public.organizations
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy organizations_delete on public.organizations
  for delete to authenticated
  using (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- profiles: everyone signed in reads all; users update only their own row and can never
-- change their own is_super_admin flag (the new value must equal the current value).
-- Inserts come from the auth trigger / service role only.
-- -----------------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated
  using (true);

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and is_super_admin = public.is_super_admin());

-- -----------------------------------------------------------------------------
-- memberships: readable by members of that org; writable by org writers
-- -----------------------------------------------------------------------------
create policy memberships_select on public.memberships
  for select to authenticated
  using (public.is_org_member(org_id));

create policy memberships_insert on public.memberships
  for insert to authenticated
  with check (public.can_write_org(org_id));

create policy memberships_update on public.memberships
  for update to authenticated
  using (public.can_write_org(org_id))
  with check (public.can_write_org(org_id));

create policy memberships_delete on public.memberships
  for delete to authenticated
  using (public.can_write_org(org_id));

-- -----------------------------------------------------------------------------
-- folders
-- -----------------------------------------------------------------------------
create policy folders_select on public.folders
  for select to authenticated
  using (public.is_org_member(org_id));

create policy folders_insert on public.folders
  for insert to authenticated
  with check (public.can_write_org(org_id));

create policy folders_update on public.folders
  for update to authenticated
  using (public.can_write_org(org_id))
  with check (public.can_write_org(org_id));

create policy folders_delete on public.folders
  for delete to authenticated
  using (public.can_write_org(org_id));

-- -----------------------------------------------------------------------------
-- content
-- -----------------------------------------------------------------------------
create policy content_select on public.content
  for select to authenticated
  using (public.is_org_member(org_id));

create policy content_insert on public.content
  for insert to authenticated
  with check (public.can_write_org(org_id));

create policy content_update on public.content
  for update to authenticated
  using (public.can_write_org(org_id))
  with check (public.can_write_org(org_id));

create policy content_delete on public.content
  for delete to authenticated
  using (public.can_write_org(org_id));

-- -----------------------------------------------------------------------------
-- websites
-- -----------------------------------------------------------------------------
create policy websites_select on public.websites
  for select to authenticated
  using (public.is_org_member(org_id));

create policy websites_insert on public.websites
  for insert to authenticated
  with check (public.can_write_org(org_id));

create policy websites_update on public.websites
  for update to authenticated
  using (public.can_write_org(org_id))
  with check (public.can_write_org(org_id));

create policy websites_delete on public.websites
  for delete to authenticated
  using (public.can_write_org(org_id));

-- -----------------------------------------------------------------------------
-- playlists
-- -----------------------------------------------------------------------------
create policy playlists_select on public.playlists
  for select to authenticated
  using (public.is_org_member(org_id));

create policy playlists_insert on public.playlists
  for insert to authenticated
  with check (public.can_write_org(org_id));

create policy playlists_update on public.playlists
  for update to authenticated
  using (public.can_write_org(org_id))
  with check (public.can_write_org(org_id));

create policy playlists_delete on public.playlists
  for delete to authenticated
  using (public.can_write_org(org_id));

-- -----------------------------------------------------------------------------
-- playlist_items (scoped through the parent playlist's org)
-- -----------------------------------------------------------------------------
create policy playlist_items_select on public.playlist_items
  for select to authenticated
  using (public.is_org_member(public.playlist_org_id(playlist_id)));

create policy playlist_items_insert on public.playlist_items
  for insert to authenticated
  with check (public.can_write_org(public.playlist_org_id(playlist_id)));

create policy playlist_items_update on public.playlist_items
  for update to authenticated
  using (public.can_write_org(public.playlist_org_id(playlist_id)))
  with check (public.can_write_org(public.playlist_org_id(playlist_id)));

create policy playlist_items_delete on public.playlist_items
  for delete to authenticated
  using (public.can_write_org(public.playlist_org_id(playlist_id)));

-- -----------------------------------------------------------------------------
-- screen_groups
-- -----------------------------------------------------------------------------
create policy screen_groups_select on public.screen_groups
  for select to authenticated
  using (public.is_org_member(org_id));

create policy screen_groups_insert on public.screen_groups
  for insert to authenticated
  with check (public.can_write_org(org_id));

create policy screen_groups_update on public.screen_groups
  for update to authenticated
  using (public.can_write_org(org_id))
  with check (public.can_write_org(org_id));

create policy screen_groups_delete on public.screen_groups
  for delete to authenticated
  using (public.can_write_org(org_id));

-- -----------------------------------------------------------------------------
-- screens
-- -----------------------------------------------------------------------------
create policy screens_select on public.screens
  for select to authenticated
  using (public.is_org_member(org_id));

create policy screens_insert on public.screens
  for insert to authenticated
  with check (public.can_write_org(org_id));

create policy screens_update on public.screens
  for update to authenticated
  using (public.can_write_org(org_id))
  with check (public.can_write_org(org_id));

create policy screens_delete on public.screens
  for delete to authenticated
  using (public.can_write_org(org_id));

-- -----------------------------------------------------------------------------
-- pairing_codes: intentionally NO policies (RLS enabled => authenticated/anon see nothing),
-- and the default table grants are revoked so the pairing table (codes, token hashes,
-- fingerprints) can never be opened by a future policy — a session/anon query gets
-- 42501 permission denied, not an empty result. Only the service-role client
-- (/api/device/*, /api/screens/claim, cron) touches it.
-- -----------------------------------------------------------------------------
revoke all on table public.pairing_codes from anon, authenticated;

-- -----------------------------------------------------------------------------
-- events: members read; org writers insert; never updated/deleted by users
-- -----------------------------------------------------------------------------
create policy events_select on public.events
  for select to authenticated
  using (public.is_org_member(org_id));

create policy events_insert on public.events
  for insert to authenticated
  with check (public.can_write_org(org_id));
