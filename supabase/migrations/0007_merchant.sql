-- 0007_merchant.sql
-- Merchant TV self-claim support: a screen remembers the device fingerprint that claimed it,
-- so a reinstall / re-login on the same device reuses its screen row instead of creating a
-- duplicate. Nullable: admin-claimed screens (pairing-code flow) keep null.
-- Service-role only (screens has no direct grants), so no RLS changes are needed.

alter table public.screens
  add column if not exists fingerprint text;

comment on column public.screens.fingerprint is
  'Device fingerprint (msign.fingerprint) that self-claimed this screen; null for admin-claimed screens.';

create index if not exists screens_org_fingerprint_idx
  on public.screens (org_id, fingerprint)
  where fingerprint is not null;
