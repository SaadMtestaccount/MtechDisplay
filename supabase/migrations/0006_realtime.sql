-- =============================================================================
-- MSIGN — 0006_realtime.sql
-- Realtime authorization for the broadcast channels. Requires 0003_functions.sql.
--
-- Every MSIGN channel is PRIVATE: clients subscribe with `{ config: { private: true } }`
-- and Realtime evaluates these policies as the joining client's role (anon for the TV
-- player, authenticated for the admin browser):
--   select on realtime.messages -> may RECEIVE broadcasts on the topic
--   insert on realtime.messages -> may SEND broadcasts on the topic
-- There is deliberately NO insert policy: only the service role (lib/broadcast.ts, REST
-- httpSend with the service key, which bypasses RLS) can publish. Without this, any holder
-- of the public anon key could send `unpair` / `reload` to a screen or forge status events.
--
-- Topics: screen-{screen_id} (player) and org-{org_id} (admin pages). Supabase grants the
-- anon/authenticated roles access to realtime.messages by default; nothing else is needed.
-- =============================================================================

-- TV players hold only the anon key: any client may receive commands for a screen topic
-- (the payloads are hint-only `{ at }` objects; the player verifies `unpair` against the API).
drop policy if exists "msign_screen_channel_receive" on realtime.messages;
create policy "msign_screen_channel_receive" on realtime.messages
  for select to anon, authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() ~ '^screen-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

-- Admin pages: org members (every super admin) may receive status/changed events for
-- their org. The exact uuid pattern + CASE guarantee the ::uuid cast only runs on a valid
-- uuid (a crafted topic yields `false`, never a 22P02 error inside the policy).
drop policy if exists "msign_org_channel_receive" on realtime.messages;
create policy "msign_org_channel_receive" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and case
          when realtime.topic() ~ '^org-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then public.is_org_member(substring(realtime.topic() from 5)::uuid)
          else false
        end
  );
