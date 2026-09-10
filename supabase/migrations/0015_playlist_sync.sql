-- 0015_playlist_sync.sql — playlists.sync: when true, every TV playing this playlist derives the
-- current item and its offset from the shared server clock instead of free-running timers, so
-- TVs showing the same menu stay in step (videos included). Off by default.
alter table public.playlists add column if not exists sync boolean not null default false;
