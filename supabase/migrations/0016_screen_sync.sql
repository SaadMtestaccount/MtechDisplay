-- 0016_screen_sync.sql — screens.sync: per-TV synchronized playback, set from the TVs page by
-- selecting TVs (§21). A TV plays in sync when this OR its effective playlist's `sync` is true.
alter table public.screens add column if not exists sync boolean not null default false;
