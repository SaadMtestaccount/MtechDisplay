# MSIGN

MSIGN is MTech's multi-tenant digital signage platform: manage content, playlists, screens,
groups and websites for any number of merchant organizations from one admin app, while each TV
runs a browser-based player that pairs with a 6-character code and plays its playlist. Both
surfaces — the admin app and the TV player (`/player`) — live in one Next.js 15 app backed by
Supabase (Postgres + RLS, Auth, Storage, Realtime).

## How it works

- **Two surfaces, one app.** The **admin app** (everything except `/player`) uses Supabase
  email/password sessions; every page and API route is scoped to the *active organization*
  (navbar switcher, persisted in the `msign_org` cookie), and every admin read/write goes
  through a session-bound Supabase client so Postgres RLS enforces org isolation. The
  **player** (`/player`) is a public page with no session — it runs fullscreen in each TV's
  browser.
- **Device API.** TVs never talk to Supabase directly. An unpaired player requests a
  6-character pairing code (`POST /api/device/pairing-code` — the response carries the raw
  device token exactly once; the server stores only its SHA-256 hash) and polls until an
  admin claims the code under **Screens → Add Screen**. From then on it authenticates every
  call with `Authorization: Bearer <token>`: `GET /api/device/manifest` (the resolved
  playlist; media as 24-hour signed URLs) and `POST /api/device/heartbeat` every 30 s. A
  screen shows **Online** while its last heartbeat is under 75 seconds old. The player
  preloads all media into the browser's Cache Storage so the loop survives network loss.
- **Realtime — private broadcast channels.** The server pushes over Supabase Realtime:
  `screen-{screen_id}` tells one player to `sync` (refetch its manifest), `reload`,
  `identify` or `unpair`; `org-{org_id}` streams live heartbeat statuses and change
  notifications to every open admin tab. All channels are **private**
  (`0006_realtime.sql`): clients can only receive, and only the service role can publish —
  a holder of the public anon key cannot forge a status or unpair a screen. Correctness
  never depends on realtime: every heartbeat returns the server's `playlist_version`, and a
  mismatch makes the player refetch the manifest.
- **Cron.** Vercel Cron calls `GET /api/cron/tick` every 5 minutes (Bearer `CRON_SECRET`):
  it writes `screen_offline` / `screen_online` events for screens that stay down, touches
  playlists whose content just expired so players drop it without an edit, and deletes
  expired pairing codes.

## Prerequisites

- **Node 20+** (the repo is developed and run on v24; on Node ≥ 22.2 the seed uses the native
  `zlib.crc32`, with a built-in fallback for older versions)
- **pnpm 11**
- **A Supabase project** — hosted, or a local Supabase CLI stack whose Realtime image is
  **>= v2.97.0** (the REST broadcast endpoint and private channels require it; hosted projects
  already satisfy this).
- For production: **Vercel Pro** (see [Deploy](#deploy-vercel--supabase-cloud)).

## Setup

1. **Install dependencies**

   ```sh
   pnpm install
   ```

2. **Create a Supabase project** (hosted dashboard, or `supabase start` locally — mind the
   Realtime version above).

3. **Apply the six migrations in order** — `supabase/migrations/0001_schema.sql`,
   `0002_triggers.sql`, `0003_functions.sql`, `0004_rls.sql`, `0005_storage.sql`,
   `0006_realtime.sql`. Either paste each file into the Dashboard SQL Editor and run them one
   by one, in order, or (with the CLI linked to the project) run `supabase db push`.

   `0005_storage.sql` creates the three storage buckets — `media` (private), `thumbs`
   (public), `logos` (public) — **do not create any bucket by hand**.

4. **Raise the Storage global upload limit to 500 MB** — Supabase Dashboard → Storage
   settings (Project Settings → Storage → upload file size limit). A bucket's limit cannot
   exceed the project's global limit, which defaults to 50 MB (raising it requires the
   Supabase Pro plan) — without this step, uploads larger than the global limit fail even
   though MSIGN and the `media` bucket allow 500 MB.

5. **Copy `.env.example` to `.env.local`** and fill every variable:

   | Variable | What it is |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (Dashboard → Settings → API). Public. |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The anon key — use the **legacy JWT-format** key (see the note in `.env.example`; private Realtime channels rely on it). Public. |
   | `SUPABASE_SERVICE_ROLE_KEY` | The service-role key (legacy JWT format). Server only — bypasses RLS, never expose it to the browser. |
   | `NEXT_PUBLIC_APP_URL` | Public URL of this deployment, no trailing slash. Shown on the TV pairing screen and used for invite links. `http://localhost:3000` in dev. |
   | `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | The first super admin, created (or updated) by `pnpm seed`. |
   | `CRON_SECRET` | Strong random secret guarding `GET /api/cron/tick` (e.g. `openssl rand -hex 32`). |

6. **Configure the invite email template** — Supabase Dashboard → Authentication → Email
   templates → **Invite user**. The link in the template must be exactly:

   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/set-password
   ```

   Also set Authentication → URL Configuration → **Site URL** to your app URL so
   `{{ .SiteURL }}` resolves to it. Invited staff then land on `/set-password`.

7. **Seed demo data**

   ```sh
   pnpm seed
   ```

   Creates the super admin from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, the organization
   **MTech Demo**, a **Promotions** folder, 3 placeholder images, 1 website
   (MTech Distributors) and 2 unpaired demo screens (**Demo TV Left** / **Demo TV Right**).
   Idempotent — safe to re-run at any time; nothing is duplicated.

8. **Run it**

   ```sh
   pnpm dev
   ```

   Open http://localhost:3000/login and sign in with the seeded credentials.

## Content expiration (how the date works)

Setting an expiration on a content item picks a **calendar day**, interpreted in the
organization's timezone (Admin → Settings). The item keeps playing **through the end of that
day** in that timezone and counts as expired from the first moment of the next day: the red
**Expired** badge appears in the library and every screen drops the item automatically — no
playlist edit needed (the player filters expired items and the 5-minute cron nudges affected
playlists). Picking a day in the past therefore shows **Expired** immediately. "Delete expired
content" (kebab menu next to the Content page title) removes all expired items in the org.

## Deploy (Vercel + Supabase cloud)

1. Use a hosted Supabase project prepared exactly as in Setup (migrations in order, 500 MB
   storage limit, invite template, Site URL = the production URL).
2. Import the repo into Vercel (framework: Next.js) and set the same environment variables
   there, with `NEXT_PUBLIC_APP_URL` = the production URL (no trailing slash) and
   `CRON_SECRET` = a strong random value.
3. **Cron — Vercel Pro is required.** `vercel.json` schedules `GET /api/cron/tick` every
   5 minutes (`*/5 * * * *`). Hobby projects only allow daily cron jobs and the deploy
   **fails** on a sub-daily schedule.
4. **Cron auth.** Vercel does not authenticate cron requests on its own: per Vercel's
   documented behavior for `vercel.json` crons, it sends `Authorization: Bearer <CRON_SECRET>`
   with each invocation **only when a `CRON_SECRET` environment variable is set on the
   project**. Set it — while the secret is unset the route fails closed (500), and it answers
   401 to any request without the exact bearer.

   The tick logs screens' offline/online events, pushes content expirations out to screens,
   and deletes expired pairing codes.

## Commands

| Command | Does |
|---|---|
| `pnpm dev` | Dev server (Turbopack) at http://localhost:3000 |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint |
| `pnpm seed` | Idempotent demo/bootstrap seed (`scripts/seed.ts`) |
| `pnpm typecheck` | `tsc --noEmit` |

## Putting it on a TV

Open `{NEXT_PUBLIC_APP_URL}/player` in any TV browser, then claim the code under
Screens → Add Screen. Full step-by-step for Fire TV Stick and Android TV boxes:
**[docs/TV_SETUP.md](docs/TV_SETUP.md)**.

## Acceptance test plan

Run through in order against a freshly seeded deployment (`pnpm dev` works for every item).
Use a second browser window — or a real TV — as "the player". Where a step says to check a
table, use the Supabase Dashboard → Table Editor.

1. **Login.** Open `/login`, sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` → you
   land on **Screens** with **MTech Demo** active in the navbar org switcher and the two
   seeded cards (**Demo TV Left** / **Demo TV Right**) showing **Not paired**.
2. **Upload.** **Content** tab → click **Upload Files** (or drag files anywhere onto the
   page) → pick a `.jpg` and an `.mp4` → per-file progress appears bottom-right → both cards
   show a real thumbnail and file size, and the video card shows its duration badge.
3. **Folders, rename, search, sort, filters.** On **Content**: kebab next to the page title
   → **New folder** → create one. Kebab on the jpg's card → **Move to folder** → pick it.
   Kebab → **Rename** → change the name. Open the folder card — the file is inside;
   the breadcrumb returns to the root. Back at the root, type the new name into **Search**:
   the moved file is found (root search covers the whole org and captions each hit with its
   folder). Exercise every **Sort** (Name / Newest / Oldest / Size / Type) and **Filters**
   (type, folder, expired only).
4. **Expiration.** Kebab on a card → **Set expiration** → pick yesterday → save → the red
   **Expired** badge appears immediately (the day is read in the org's timezone). Kebab next
   to the page title → **Delete expired content** → the confirm names the count → confirm →
   the item is gone.
5. **Playlist editor.** **Screens** → open **Demo TV Left** (click the card, or kebab →
   **Open playlist**). In the left library pane (**Content** tab), drag the seeded image
   into the playlist (or click **+**) and set its duration to **5**; add your uploaded video
   (detected duration, editable override); switch the pane to **Websites** and add
   **MTech Distributors**. Drag rows to reorder. The save status flips
   *Unsaved changes → Saving… → Saved* on its own; reload the page — order and durations
   persisted. In the `screens` table, `playlist_version` for this screen has incremented.
6. **Groups.** **Groups** → **Add Screen Group** → name it → the group editor opens. In its
   **Screens** panel, check both Demo TVs → in the `screens` table both rows now carry the
   group's `group_id`; each screen's detail page shows the purple banner
   *"This screen plays group '{name}'"*. Edit the group playlist → **both** screens'
   `playlist_version` values bump. Uncheck a screen → its `group_id` clears and it reverts
   to its own playlist.
7. **Org isolation (RLS).** Navbar org switcher → **New organization** → create "Org B" →
   the switcher swaps to it and Content / Screens / Groups / Websites are all empty —
   nothing from MTech Demo leaks. Then prove RLS with the anon key alone (no session):

   ```sh
   curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/screens?select=id" \
     -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
     -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"
   ```

   Every policy-bearing table (`organizations`, `content`, `screens`, `playlists`, …)
   answers `[]`. Two cases answer differently by design: `pairing_codes` (table grants
   revoked) and the RPCs (e.g. `POST …/rest/v1/rpc/bump_playlist_version` — EXECUTE
   revoked) return a **`42501` permission-denied error** instead of an empty array.
   **`[]` or a 42501 error both pass** for those two; actual data rows are the only failure.
8. **Pairing.** Open `{APP_URL}/player` in a second browser window → a large 6-character
   code appears (no 0/O/1/I in the alphabet). **Screens** → **Add Screen** → type the code
   and a name → confirm. The player leaves the pairing screen within ~3 seconds and the new
   card shows **Online** with its "Last seen" line ticking.
9. **Live control.** With the player visible, edit its playlist — the change reaches the TV
   within seconds. Card kebab → **Rotation** → 90° → the player rotates. **Identify** → the
   screen's name overlays on the TV for 10 s. **Reload player** → the player page reloads.
10. **Offline resilience.** Cut the player's network for ~2 minutes (toggle Wi-Fi, or
    DevTools → Network → Offline) → it keeps looping its cached image and video, skips
    website items, and shows no error UI. Restore the network → the heartbeat resumes and
    the card returns to **Online**; the `events` table now holds a `screen_offline` +
    `screen_online` pair for the screen. (The heartbeat writes both retroactively on
    recovery — this check never depends on cron timing.)
11. **Delete screen.** Card kebab → **Delete screen** → confirm → the player drops back to
    the pairing screen with a fresh code, and its old token gets **401** from
    `GET /api/device/manifest`.
12. **Website refresh.** **Websites** → edit the site (or **Add Website**) and set
    **Refresh interval** to **1 minute** → with the item playing on the TV, its iframe
    reloads every minute.
13. **Build hygiene.** `pnpm build` completes with zero type errors, and no source file
    exceeds ~300 lines.

## Repo layout

```
app/                  Next.js App Router: admin pages, /player, /api route handlers
components/           UI — shell, content, screens, playlist, groups, websites, player, ui (shadcn)
hooks/                Client state — uploads, playlist autosave, heartbeat, manifest, realtime
lib/                  Business logic — Supabase clients, validators, broadcast, manifest, cron
types/                DB row types + API/view contracts shared by server, admin and player
supabase/migrations/  SQL migrations 0001-0006: schema, triggers, functions, RLS, storage, realtime
scripts/              seed.ts + helpers (pnpm seed)
docs/                 CONTRACTS.md (binding names/shapes) and TV_SETUP.md (TV guide)
```
