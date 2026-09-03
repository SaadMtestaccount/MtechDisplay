-- =============================================================================
-- MSIGN — 0005_storage.sql
-- Storage buckets and storage.objects policies. Requires 0004_rls.sql.
--
-- Buckets / object keys (keys are bucket-relative, no bucket prefix in the DB):
--   media  (private)  {org_id}/{content_id}.{ext}         <- content.storage_path
--   thumbs (public)   {org_id}/{content_id}-thumb.jpg     <- content.thumb_path
--   logos  (public)   {org_id}/logo.{ext}                 <- organizations.logo_url (full public URL)
--
-- Access model:
--   * Devices never talk to Storage directly; the manifest carries 24h signed URLs
--     created with the service role.
--   * Admin browser uploads: media via signed upload URL / TUS (token from the API),
--     thumbs straight into the public thumbs bucket with the user's session
--     (allowed by the super-admin policy below).
--   * Public buckets are served through /storage/v1/object/public/{bucket}/{key}, which
--     does not consult RLS. No anon policy exists, so the anon key cannot LIST objects
--     (that would enumerate org and content ids).
--   * Operational prerequisite: a bucket file_size_limit cannot exceed the project's global
--     upload limit (Supabase Dashboard -> Settings -> Storage; Pro plan for > 50 MB).
--     Raise the global limit to 500 MB before uploading large videos.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media',  'media',  false, 524288000,
     array['image/jpeg', 'image/png', 'image/webp', 'image/gif',
           'video/mp4', 'video/webm', 'video/quicktime']),
  ('thumbs', 'thumbs', true, 10485760,
     array['image/jpeg', 'image/png', 'image/webp']),
  ('logos',  'logos',  true, 5242880,
     array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'])
on conflict (id) do nothing;

-- Super admins: full read/write on the three MSIGN buckets.
drop policy if exists "msign_super_admin_all" on storage.objects;
create policy "msign_super_admin_all" on storage.objects
  for all to authenticated
  using (
    bucket_id in ('media', 'thumbs', 'logos')
    and public.is_super_admin()
  )
  with check (
    bucket_id in ('media', 'thumbs', 'logos')
    and public.is_super_admin()
  );

-- Signed-in users may read/list the public buckets through the API (future merchant
-- portal) — but only inside their own org's folder: the first path segment of every key is
-- the org id, checked with is_org_member. CASE keeps the uuid cast off non-uuid keys.
-- The anon role gets no policy on purpose: public files are still served through the
-- /object/public/ endpoint, but listing is not possible with the anon key.
drop policy if exists "msign_public_read" on storage.objects;
drop policy if exists "msign_authenticated_read" on storage.objects;
create policy "msign_authenticated_read" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('thumbs', 'logos')
    and case
          when (storage.foldername(name))[1]
               ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then public.is_org_member(((storage.foldername(name))[1])::uuid)
          else false
        end
  );
