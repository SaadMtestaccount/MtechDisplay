-- 0012_orientation.sql — screens.orientation: 'landscape' (default) or 'portrait'. Portrait makes
-- the player draw an upright 9:16 stage (vertical menus, or a browser window on a vertical
-- monitor); `rotation` stays for how a TV is physically mounted.
alter table public.screens add column if not exists orientation text not null default 'landscape';
alter table public.screens drop constraint if exists screens_orientation_check;
alter table public.screens add constraint screens_orientation_check
  check (orientation in ('landscape', 'portrait'));
