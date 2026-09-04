-- 0011_subscription.sql — dummy per-merchant subscription tier.
-- Stored on the profile (one row per login, created by handle_new_user). The super admin sets it
-- from the Team page; there is no billing behavior yet — it's a label. Tiers: starter | pro | enterprise.
alter table public.profiles
  add column if not exists subscription_tier text not null default 'starter';

alter table public.profiles
  drop constraint if exists profiles_subscription_tier_check;

alter table public.profiles
  add constraint profiles_subscription_tier_check
  check (subscription_tier in ('starter', 'pro', 'enterprise'));
