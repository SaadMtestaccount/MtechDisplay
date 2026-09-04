-- =============================================================================
-- MSIGN — 0010_login_codes.sql
-- Per-screen login code: a persistent, human-friendly code the store enters ON the TV to
-- log that TV into a specific screen (docs/CONTRACTS.md §15). Regenerating a screen's code
-- (app side) revokes its device token, logging that one TV out. Globally unique so a code
-- alone identifies the screen (and thus its org) at enrollment time.
-- Alphabet excludes 0/O/1/I. Codes are stored raw (8 chars) and shown formatted "XXXX-XXXX".
-- =============================================================================

alter table public.screens add column if not exists login_code text;

create unique index if not exists screens_login_code_key
  on public.screens (login_code) where login_code is not null;

comment on column public.screens.login_code is
  'Persistent 8-char (A-Z minus O/I, 2-9) code entered on a TV to enroll it as this screen. Globally unique.';

-- Backfill a unique code for every existing screen.
do $$
declare
  r record;
  c text;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  for r in select id from public.screens where login_code is null loop
    loop
      c := '';
      for i in 1..8 loop
        c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      end loop;
      begin
        update public.screens set login_code = c where id = r.id;
        exit;
      exception when unique_violation then
        -- code collided with another screen; try again
      end;
    end loop;
  end loop;
end $$;
