-- 0017_sync_started_at.sql — the shared starting line for synchronized playback (§21): set when
-- sync is turned on (one timestamp for a whole TV selection), cleared when it is turned off. The
-- player counts its loop from this instant, so pressing Sync starts everyone from 0:00 together.
alter table public.screens add column if not exists sync_started_at timestamptz;
alter table public.playlists add column if not exists sync_started_at timestamptz;
