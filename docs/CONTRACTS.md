# MSIGN — CONTRACTS (source of truth)

Binding for every implementation slice. Every path, name, shape and signature below is exact. If
`MSIGN_BUILD_SPEC.md` and this file disagree on a **name or shape**, this file wins. If they disagree
on **behavior**, the spec wins — EXCEPT for the deliberate deviations recorded in §0, which take
precedence over the spec. Implement those as written and do not "fix" them back.

Companion files (already written, do not rewrite): `supabase/migrations/0001_schema.sql`, `0002_triggers.sql`,
`0003_functions.sql`, `0004_rls.sql`, `0005_storage.sql`, `0006_realtime.sql`, `types/rows.ts`, `types/db.ts`,
`types/api.ts`, `.env.example`, `vercel.json`.

---

## 0. Decisions (deliberate deviations from the spec — binding)

1. **Broadcast delivery is REST** (`channel.httpSend`, fallback `send` on old local Realtime), not spec §10's
   "subscribe, send, teardown". Server code never opens a websocket.
2. **All Realtime channels are private** (`{ config: { private: true } }` on both ends) with receive-only RLS in
   `0006_realtime.sql`; only the service role can publish. Screens still cannot trust a message blindly: the
   player treats `unpair` as a hint and wipes only after the API answers 401 (§10).
3. **Pairing screen shows the MSIGN wordmark only.** An unpaired device has no org, so spec §15's "logo on the
   pairing screen" is impossible; org logos appear on the standby screen after pairing.
4. **`PairDialog` has no org select** (spec §7 "(+ org select)"): it pairs into the active org and says so
   ("Pairing into {org.name}"); switch orgs with `OrgSwitcher`.
5. **Offline/online events**: the heartbeat writes a retroactive `screen_offline` when a screen returns after a
   gap the cron did not observe, then `screen_online`; the cron only covers screens that stay down (spec §14
   names only the cron). Acceptance #10 must not depend on cron timing.
6. **`dir` (sort direction) is API-only**; the UI sort options (Newest/Oldest…) encode direction. No control.
7. **Device-reported `current_item_id` is stored only when it exists in the screen's effective playlist**;
   anything else is stored as null. A heartbeat never fails because of the device's value.
8. **Content expiry reaches players without an edit**: `ManifestItem.expires_at` is filtered by the player and
   the cron touches every playlist containing content that expired since the previous tick.
9. **`playlist_version: -1`** in a heartbeat means "no manifest yet" and always mismatches.
10. **Supabase client factories are named by side**: `createBrowserClient()` (client.ts), `createServerClient()`
    (server.ts), `createAdminClient()` (admin.ts). Nothing exports a bare `createClient`.
11. **Download** uses a signed URL with `Content-Disposition: attachment` (`?download=1`), separate from preview.
12. **Anon key cannot list storage objects**; public buckets are served only through `/object/public/`.
13. **The device token is minted with the pairing code**, not on the pairing-status poll (spec §11): `POST /api/device/pairing-code`
    returns `{ code, expires_at, device_token }` — the raw token exactly once — and the server stores only `sha256(token)` in
    `pairing_codes.device_token_hash`, copied onto `screens.device_token_hash` when an admin claims the code. `GET pairing-status`
    answers `{ claimed: true, screen_id }` (no secret), so no raw token is ever at rest and no delivery compare-and-swap exists.
    The device fingerprint is **mandatory** on both device pairing routes (`pairing_codes.device_fingerprint NOT NULL`).
14. **Images are cached in Cache Storage exactly like videos** (spec §12 says `Image()`): one mechanism (`useMediaCache`) is what
    makes acceptance #10 (loop cached images offline) work without a second preload path.
15. **`offline` on the player is derived from the heartbeat**, not only from manifest fetches: `offline = heartbeat.failing || manifest.status === 'offline'`
    (§10), because during a plain outage no manifest fetch is triggered and websites would otherwise keep rendering blank iframes.

---

## 1. Overview and file ownership

Two surfaces in one Next.js 15 App Router app (no `src/`):

- **Admin** — `/login`, `/set-password`, `/content`, `/screens`, `/screens/[id]`, `/groups`, `/groups/[id]`,
  `/websites`, `/admin/users`, `/admin/orgs`, `/admin/settings`. Session auth (Supabase email/password),
  every query scoped to the *active org* (cookie `msign_org`), RLS enforced through the session-bound client.
- **Player** — `/player`. No session. Pairs with a 6-char code, then talks only to `/api/device/*` with a
  Bearer device token and subscribes to the private Realtime broadcast channel `screen-{screen_id}`.

### 1.1 Slices and owned paths

Create/modify files ONLY in your list. Files marked ★ are **foundation**: other slices import them.
**Slice 0 writes every ★ file first** (sequentially, exactly per §5/§8/§9.1) and finishes `tsc`-clean before
A–I fan out. After Slice 0, a ★ file may be changed only by its owning slice and only additively (never rename
or remove an export). Never write a private copy of another slice's function — import it by the name given here.
If your slice runs before a ★ module you depend on exists, code against the signature here and do NOT stub it;
the only tolerated `tsc` errors are `TS2307: Cannot find module '@/…'` for ★ modules you do not own — list each
in `notes`.

| Slice | Owns |
|---|---|
| **0 — foundation (first)** | every ★ path in the rows below, written exactly as specified; no other files |
| **A — shell + auth + admin pages** | `app/layout.tsx`, `app/globals.css`, `app/page.tsx` (redirects to `/screens`), `app/(auth)/layout.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/set-password/page.tsx`, `app/auth/confirm/route.ts`, `app/(admin)/layout.tsx`, `app/(admin)/admin/users/page.tsx`, `app/(admin)/admin/orgs/page.tsx`, `app/(admin)/admin/settings/page.tsx`, `app/api/users/**`, `app/api/orgs/**`, `middleware.ts`, `next.config.ts`, `public/**` EXCEPT `public/player/**` — A writes `public/favicon.ico`, `public/msign.svg` (the ONE MSIGN wordmark, used by `Navbar` and by the player's `PairingScreen` as `/msign.svg`) and `public/illustrations/groups.svg` (rendered by `GroupsEmptyState`, §9.6) —, ★`lib/supabase/client.ts`, ★`lib/supabase/server.ts`, ★`lib/supabase/admin.ts`, ★`lib/supabase/middleware.ts`, ★`lib/api.ts`, ★`lib/api-client.ts`, ★`lib/auth.ts`, ★`lib/orgs.ts`, ★`lib/query-keys.ts`, ★`lib/utils.ts`, `lib/users.ts`, `lib/organizations.ts`, ★`lib/validators/common.ts`, `lib/validators/users.ts`, `lib/validators/orgs.ts`, ★`hooks/useApp.ts`, ★`hooks/useDebounce.ts`, ★`hooks/useNow.ts`, ★`components/shell/*` (all of §9.1 shell), `components/auth/*`, `components/admin/*` |
| **B — content** | `app/(admin)/content/page.tsx`, `app/api/content/**`, `app/api/folders/**`, `app/api/uploads/**`, `lib/content.ts`, `lib/content/*`, `lib/folders.ts`, `lib/uploads.ts`, `lib/upload-client.ts` (browser-only per-file pipeline used by `useUpload`), ★`lib/storage.ts`, `lib/thumbs.ts`, `lib/validators/content.ts`, `lib/validators/folders.ts`, `lib/validators/uploads.ts`, `hooks/useUpload.ts`, `components/content/*` |
| **C — websites** | `app/(admin)/websites/page.tsx`, `app/api/websites/**`, `lib/websites.ts`, `lib/validators/websites.ts`, `components/websites/*` |
| **D — screens** | `app/(admin)/screens/page.tsx`, `app/(admin)/screens/[id]/page.tsx`, `app/api/screens/**`, ★`lib/screens.ts`, `lib/screens/*`, ★`lib/validators/screens.ts`, ★`hooks/useRealtimeScreens.ts`, `components/screens/*` |
| **E — playlist editor** | `app/api/playlists/**`, ★`lib/playlists.ts`, `lib/playlists/*`, ★`lib/validators/playlists.ts`, `hooks/usePlaylistAutosave.ts`, `components/playlist/*` |
| **F — groups** | `app/(admin)/groups/page.tsx`, `app/(admin)/groups/[id]/page.tsx`, `app/api/groups/**`, `lib/groups.ts`, `lib/validators/groups.ts`, `components/groups/*` |
| **G — device API + cron** | `app/api/device/**`, `app/api/cron/tick/route.ts`, ★`lib/channels.ts`, ★`lib/broadcast.ts`, ★`lib/events.ts`, ★`lib/status.ts`, ★`lib/schedule.ts`, ★`lib/pairing.ts`, `lib/manifest.ts`, `lib/heartbeat.ts`, `lib/device-auth.ts`, `lib/cron.ts`, `lib/validators/device.ts` |
| **H — player** | `app/player/page.tsx`, `app/player/layout.tsx`, `components/player/*`, `hooks/useHeartbeat.ts`, `hooks/usePlayerManifest.ts`, `hooks/useMediaCache.ts`, `hooks/usePlayerChannel.ts`, `hooks/usePlayerDevice.ts`, `hooks/usePlayerPairing.ts`, `lib/player/*`, `public/player/**` (empty in v1 — `KeepAwake` ships no media asset, §9.7; the wordmark is A's `/msign.svg`) |
| **I — docs + seed** | `README.md`, `docs/TV_SETUP.md`, `scripts/seed.ts`, `package.json` (only add `"seed": "tsx scripts/seed.ts"` to `scripts`). README must state: Vercel **Pro** is required for the 5-minute cron (Hobby = daily only, deploy fails); raise the Supabase Storage global upload limit to 500 MB; local Supabase CLI Realtime ≥ v2.97.0; the invite email template (§5.21); the six migrations in order |
| Architect (done) | `docs/CONTRACTS.md`, `supabase/migrations/*.sql`, `types/rows.ts`, `types/db.ts`, `types/api.ts`, `.env.example`, `vercel.json` |

**Frozen** (nobody edits; report needs in `notes`): `components/ui/*`, `components.json`, `eslint.config.mjs`,
`postcss.config.mjs`, `tsconfig.json`, `package.json` (except slice I's `seed` script).

**Splitting rule** (300-line cap, §2.2): any owned `lib/<name>.ts` or `hooks/<name>.ts` may be split into
`lib/<name>/*.ts` (`hooks/<name>/*.ts`) with `lib/<name>.ts` re-exporting exactly the contracted names — TS and
Turbopack resolve the file before the directory, so `@/lib/<name>` keeps working. Pre-authorized: `lib/screens/select.ts`,
`lib/screens/views.ts` (D), `lib/content/usage.ts` (B), `lib/playlists/save.ts` (E), `lib/upload-client.ts` (B).

Existing scaffold files you may rely on: `components/ui/*` (shadcn base-nova, see §2.3), `lib/utils.ts` (`cn` only — slice A extends it),
`app/globals.css` (slice A replaces tokens), `components.json`, `tsconfig.json` (`@/*` → repo root).

---

## 2. Environment and conventions

### 2.1 Environment facts
- Windows 11, Windows PowerShell 5.1 (no `&&`/`||`), repo is NOT git. Node is not on PATH — prefix node/pnpm/tsc commands with
  `$env:PATH = "C:\Users\Computer 2\.local\node;$env:PATH"; `.
- Typecheck: `$env:PATH = "C:\Users\Computer 2\.local\node;$env:PATH"; .\node_modules\.bin\tsc.cmd --noEmit --pretty false` (run it before you finish).
- Next 15.5 (App Router, Turbopack), React 19.1, TypeScript strict, Tailwind v4 (CSS-first, `@theme inline` in `app/globals.css`),
  pnpm 11, `@supabase/supabase-js` 2.112 + `@supabase/ssr` 0.12, `@tanstack/react-query` 5, `@dnd-kit/core` 6 + `sortable` 10 + `utilities`,
  zod 4, date-fns 4, sonner 2, next-themes 0.4, lucide-react 1.x, tus-js-client 4.3, react-day-picker 10, cmdk 1, tsx, dotenv.
  Do NOT add packages (report needs in `deps_needed`). `server-only` is NOT installed — do not import it.
- Env vars (`.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`,
  `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `CRON_SECRET`. Read server-only vars only inside `lib/supabase/admin.ts` (service key),
  `lib/cron.ts` (`CRON_SECRET`), route handlers and `scripts/seed.ts`.
- Operational prerequisites (documented by slice I, noted in `.env.example`): Vercel **Pro** for `*/5 * * * *` (Hobby deploys fail on
  sub-daily cron); Supabase Storage global upload limit raised to 500 MB; local Supabase CLI with Realtime ≥ v2.97.0 (REST broadcast
  endpoint + private channels). Hosted projects satisfy the Realtime requirement.

### 2.2 Hard rules
- No source file over 300 lines (split at ~250, see §1.1 splitting rule). Pages under 100 lines: a page renders one client "page
  component" and nothing else. One component per file. Business logic in `lib/`, client state in `hooks/`, route handlers thin:
  `parse → lib → ok()`.
- No mock data. No `any` (use `unknown` + narrowing). Use the `@/` alias everywhere. Every mutation shows a sonner toast;
  every delete goes through `ConfirmDialog`.
- Next 15: `cookies()` / `headers()` are async; route handler `params` is a `Promise`; page `params`/`searchParams` are Promises.
  Use `NextRequest`/`NextResponse` from `next/server`. GET route handlers that read headers/cookies are dynamic; add
  `export const dynamic = 'force-dynamic'` on `/api/device/*` and `/api/cron/tick` to be explicit.
- zod v4 API: `z.uuid()`, `z.url()`, `z.email()`, `z.iso.date()`, `z.iso.time()`, `z.iso.datetime({ offset: true })`, `z.enum([...] as const)`
  (strings only), `z.literal(ROTATIONS)` / `z.literal(REFRESH_OPTIONS)` for numeric option lists, `schema.safeParse(x)` →
  `result.error.issues`, `z.infer<typeof s>`, `import { z, type ZodIssue, ZodError } from 'zod'`.
- **Server-only modules** — never imported from a `'use client'` file: `lib/supabase/admin.ts`, `lib/supabase/server.ts`,
  `lib/supabase/middleware.ts`, `lib/auth.ts`, `lib/orgs.ts`, `lib/broadcast.ts`, `lib/events.ts`, `lib/manifest.ts`, `lib/heartbeat.ts`,
  `lib/cron.ts`, `lib/device-auth.ts`, `lib/pairing.ts` (node:crypto), `lib/uploads.ts`, `lib/users.ts`, `lib/organizations.ts`,
  `lib/content.ts`, `lib/folders.ts`, `lib/websites.ts`, `lib/screens.ts`, `lib/playlists.ts`, `lib/groups.ts` — i.e. everything that
  takes a `DbClient`. **Isomorphic** (safe anywhere): `types/*`, `lib/channels.ts`, `lib/status.ts`, `lib/schedule.ts`, `lib/utils.ts`,
  `lib/query-keys.ts`, `lib/api-client.ts`, `lib/validators/*`, `lib/storage.ts` (its signed-URL helpers take an admin client but the
  module imports nothing server-only). Constants a client might need never live in a server-only module: `ACTIVE_ORG_COOKIE` /
  `ACTIVE_ORG_COOKIE_OPTIONS` are in `types/api.ts` (re-exported by `lib/orgs.ts`), `faviconUrl` is in `lib/utils.ts` (re-exported by
  `lib/websites.ts`). Client code talks to the server through `/api/*` with `apiFetch` (§5.3) and to Supabase only via
  `createBrowserClient()` from `@/lib/supabase/client`.
- **PostgREST select strings are `as const` literals, never `string`**: `supabase.from('x').select(SEL)` only produces a typed row when
  `SEL`'s type is the literal (a `string`-typed select resolves to `GenericStringError[]` and forces casts). Every exported select
  constant (`SCREEN_SELECT`, `'*, folders(name)'`, `'*, content(count)'`, `'*, content(*), websites(*)'`, `'playlist_id, content!inner(expires_at)'`,
  `'*, screens(count), content(count)'`) is declared `= '…' as const`; `QueryData<typeof query>` from `@supabase/supabase-js` derives row types.
- **`useSearchParams()` needs a `Suspense` boundary** on any statically prerendered page (Next 15 fails `next build` otherwise): the
  `(auth)` pages wrap their form in `<Suspense fallback={null}>` (§9.1, Appendix B).
- Session-bound client (`createServerClient()`) is the default for all admin reads/writes — that is what proves org isolation
  (acceptance #7). The service-role client (`createAdminClient()`) is used only for: device routes, `auth.admin.*`, storage signed URLs and
  object deletion, realtime broadcast, cron, cross-org counts, pairing_codes, and writes that RLS forbids for a session (none in v1).

### 2.3 Base UI shadcn ("base-nova") — verified against `components/ui/*.tsx`
- Composition uses `render={<Comp … />}` instead of Radix `asChild`:
  `<DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}><MoreVertical /></DropdownMenuTrigger>`,
  `<DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>`, `<AlertDialogCancel>` already renders a Button.
- Roots (`Dialog`, `AlertDialog`, `Popover`, `DropdownMenu`, `Tooltip`, `Sheet`): `open`, `onOpenChange(open: boolean, …)` — use only the first arg.
- `Select`: `<Select value={v} onValueChange={(v) => …}>`, `<SelectTrigger><SelectValue /></SelectTrigger>`, `<SelectContent><SelectItem value="x">…</SelectItem></SelectContent>`.
  Values are strings — stringify numbers (`String(rotation)`) and parse back.
- `Checkbox` / `Switch`: `checked`, `onCheckedChange(checked: boolean, …)`. `Tabs`: `value` / `onValueChange`, `TabsTrigger value`, `TabsContent value`.
- `Progress value={0..100}` renders its own track. `Badge variant`: default | secondary | destructive | outline | ghost | link.
  `Button variant`: default | outline | secondary | ghost | destructive | link; `size`: default | xs | sm | lg | icon | icon-xs | icon-sm | icon-lg.
- `Calendar` = react-day-picker v10 (`mode="single"`, `selected`, `onSelect`) inside a `Popover` for date pickers.
- `Toaster` from `@/components/ui/sonner`; `toast.success/error/info/promise` from `sonner`.
- Available ui files: alert-dialog, avatar, badge, breadcrumb, button, calendar, card, checkbox, command, dialog, dropdown-menu, input-group,
  input, label, popover, progress, radio-group, scroll-area, select, separator, sheet, skeleton, sonner, switch, table, tabs, textarea,
  toggle-group, toggle, tooltip. **Always Read the file before using a component; use only its real exports/props.**

### 2.4 Design tokens (slice A writes them into `app/globals.css`; everyone uses the Tailwind classes)
- Dark (default): `--background #0f0f10`, `--card #1a1a1c`, `--card-foreground #f4f4f5`, `--popover #1a1a1c`, `--popover-foreground #f4f4f5`,
  `--border #2a2a2e`, `--input #2a2a2e`, `--foreground #f4f4f5`, `--muted #1f1f23`, `--muted-foreground #a1a1aa`, `--accent #232327`,
  `--accent-foreground #f4f4f5`, `--primary #6109b6`, `--primary-foreground #ffffff`, `--ring #6109b6`, `--destructive #ef4444`,
  `--secondary #232327`, `--secondary-foreground #f4f4f5`.
- Light: `--background #ffffff`, `--card #ffffff`, `--card-foreground #09090b`, `--popover #ffffff`, `--popover-foreground #09090b`,
  `--border #e4e4e7`, `--input #e4e4e7`, `--foreground #09090b`, `--muted #f4f4f5`, `--muted-foreground #71717a`, `--accent #f4f4f5`,
  `--accent-foreground #09090b`, `--primary #6109b6`, `--primary-foreground #ffffff`, `--ring #6109b6`, `--destructive #dc2626`,
  `--secondary #f4f4f5`, `--secondary-foreground #09090b`.
- Status (both themes), exposed as Tailwind colors via `@theme inline { --color-online: …; --color-offline: …; --color-warning: … }`:
  online `#22c55e`, offline `#ef4444`, warning `#f59e0b`. Use `bg-online`, `text-offline`, etc.
- Font: Inter via `next/font/google` in `app/layout.tsx` with `variable: '--font-sans'`; two weights only (400, 600).
  Headings: `font-semibold tracking-[-0.02em] leading-[1.05]`. Radius `--radius: 0.625rem` (unchanged).
- Navbar: "MSIGN" wordmark left → tabs Content / Screens / Groups / Websites (active = `text-primary` with a 2px `bg-primary` underline) →
  right: `OrgSwitcher`, `AdminMenu` (Users, Organizations, Settings, Log out), `ThemeToggle`, `UserAvatar`.

---

## 3. Data model (mirror of `supabase/migrations`)

Migrations, applied in order: `0001_schema.sql` (enums, tables, constraints, indexes), `0002_triggers.sql`, `0003_functions.sql`,
`0004_rls.sql`, `0005_storage.sql`, `0006_realtime.sql`. All ids `uuid default gen_random_uuid()` (core function, no extension), all
timestamps `timestamptz`. `⊘` = ON DELETE CASCADE, `∅` = ON DELETE SET NULL.

| Table | Columns (type, nullability, default) | FKs | Indexes |
|---|---|---|---|
| `organizations` | `id`, `name text NN`, `slug text NN unique`, `logo_url text`, `timezone text NN default 'America/New_York'`, `created_at` | — | slug unique |
| `profiles` | `id uuid PK`, `full_name text`, `avatar_url text`, `is_super_admin bool NN default false`, `created_at` | `id → auth.users ⊘` | — |
| `memberships` | `id`, `org_id NN`, `user_id NN`, `role membership_role NN default 'member'`, `created_at`; `unique(org_id,user_id)` | `org_id → organizations ⊘`, `user_id → profiles ⊘` | user_id (org_id lookups use the unique index's leading column) |
| `folders` | `id`, `org_id NN`, `name NN`, `created_at` | `org_id ⊘` | org_id |
| `content` | `id`, `org_id NN`, `folder_id`, `name NN`, `type content_type NN`, `storage_path text NN`, `thumb_path text`, `mime text NN`, `size_bytes bigint NN default 0`, `width int`, `height int`, `duration_seconds numeric`, `expires_at`, `created_by`, `created_at` | `org_id ⊘`, `folder_id → folders ∅`, `created_by → profiles ∅` | (org_id, folder_id), folder_id, (org_id, expires_at), `content_expires_at_idx` on (expires_at) where not null (cron's cross-org window), created_by |
| `websites` | `id`, `org_id NN`, `name NN`, `url NN`, `refresh_seconds int NN default 0 (>=0)`, `created_at` | `org_id ⊘` | org_id |
| `playlists` | `id`, `org_id NN`, `name NN`, `kind playlist_kind NN`, `updated_at NN default now()` (trigger-maintained), `created_at` | `org_id ⊘` | org_id |
| `playlist_items` | `id`, `playlist_id NN`, `position int NN default 0 (>=0)`, `item_type playlist_item_type NN`, `content_id`, `website_id`, `duration_seconds int (null or >0)`, `transition transition_type NN default 'fade'`, `mute bool NN default true`, `active_from date`, `active_to date`, `days_of_week int[]`, `daily_start time`, `daily_end time`, `created_at`; checks: content items have content_id only / website items website_id only; `days_of_week ⊆ {0..6}`; `active_from <= active_to` when both set | `playlist_id → playlists ⊘`, `content_id → content ⊘`, `website_id → websites ⊘` | (playlist_id, position), content_id, website_id |
| `screen_groups` | `id`, `org_id NN`, `name NN`, `playlist_id NN **unique**`, `created_at` | `org_id ⊘`, `playlist_id → playlists ⊘` (group and its playlist are 1:1, enforced) | org_id, playlist_id unique |
| `screens` | `id`, `org_id NN`, `name NN`, `playlist_id`, `group_id`, `device_token_hash text`, `rotation int NN default 0 (0/90/180/270)`, `last_seen_at`, `last_ip text`, `user_agent text`, `resolution text`, `current_item_id`, `playlist_version int NN default 0`, `paired_at`, `created_at` | `org_id ⊘`, `playlist_id → playlists ∅`, `group_id → screen_groups ∅`, `current_item_id → playlist_items ∅` | org_id, **unique partial (playlist_id) where not null** (`screens_playlist_id_key`: a screen playlist has exactly one screen), group_id, current_item_id, last_seen_at, unique partial (device_token_hash) where not null |
| `pairing_codes` | `id`, `code text NN unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$')` (= `PAIRING_CODE_ALPHABET`), `device_fingerprint text NN`, `device_token_hash text NN` (sha256 hex; never the raw token — decision §0.13), `expires_at NN default now()+15min`, `claimed_screen_id`, `created_at` | `claimed_screen_id → screens ∅` | expires_at, claimed_screen_id |
| `events` | `id`, `org_id NN`, `screen_id`, `type text NN` (check ∈ 7 event types), `payload jsonb NN default '{}'`, `created_at` | `org_id ⊘`, `screen_id → screens ∅` | (org_id, created_at desc), (screen_id, created_at desc) |

Enums: `membership_role('owner','admin','member')`, `content_type('image','video')`, `playlist_kind('screen','group')`,
`playlist_item_type('content','website')`, `transition_type('none','fade')`.

Cascade summary: deleting an org deletes everything it owns; deleting content/websites deletes their playlist items; deleting a playlist
deletes its items, deletes the group that owns it (1:1) and nulls `screens.playlist_id`; deleting a group nulls `screens.group_id`;
deleting a playlist item nulls `screens.current_item_id`; deleting a screen nulls `pairing_codes.claimed_screen_id` and `events.screen_id`.
The screen's own playlist is NOT deleted by cascade — `deleteScreen` deletes the screen row, then its playlist (§5).

Triggers (`0002_triggers.sql`):

| Trigger | Function | Behavior |
|---|---|---|
| `playlists_set_updated_at` | `set_updated_at()` | `before update on playlists` → `updated_at = now()` |
| `on_auth_user_created` | `handle_new_user()` (definer) | `after insert on auth.users` → insert `profiles(id, full_name, avatar_url)` from `raw_user_meta_data`, `on conflict do nothing` |
| `content_folder_same_org`, `screens_playlist_same_org`, `screens_group_same_org`, `screen_groups_playlist_same_org` | `assert_same_org(ref_table, fk_column)` (definer) | `before insert or update of <fk>`: the referenced row's `org_id` must equal `new.org_id`, else `raise … errcode 23503` (→ 422 via `withHandler`). Nulls pass |
| `playlist_items_same_org` | `assert_item_same_org()` (definer) | `before insert or update of playlist_id, content_id, website_id`: the content/website org must equal the playlist's org (23503) |
| `screens_playlist_kind`, `screen_groups_playlist_kind` | `assert_playlist_kind(kind)` (definer) | `before insert or update of playlist_id`: `screens.playlist_id` must reference a `kind = 'screen'` playlist, `screen_groups.playlist_id` a `kind = 'group'` one, else 23503. Nulls pass. Protects the cascades (`deleteScreen` deletes the screen's playlist; a group playlist cascades to its group) and `bump_playlist_version` |

These triggers are the DB safety net for cross-org references and playlist ownership (every v1 user is a super admin, so RLS never blocks
them); lib functions still validate first and return 422 with a readable message (§5.15, §5.18, §5.19, §5.20).

SQL functions (`0003_functions.sql`, all `set search_path = public`):

| Function | Signature | Security | Behavior |
|---|---|---|---|
| `is_super_admin()` | `→ boolean` | definer, stable | `profiles.is_super_admin` for `auth.uid()`, false when no row / no user |
| `is_org_member(p_org_id uuid)` | `→ boolean` | definer, stable | super admin OR has a membership row |
| `can_write_org(p_org_id uuid)` | `→ boolean` | definer, stable | super admin OR membership role in (owner, admin) |
| `playlist_org_id(p_playlist_id uuid)` | `→ uuid` | definer, stable | org of a playlist (used by playlist_items policies) |
| `bump_screen_versions(p_screen_ids uuid[])` | `→ setof uuid` | invoker | `playlist_version += 1` on the given screens, returns updated ids |
| `bump_playlist_version(p_playlist_id uuid)` | `→ setof uuid` | invoker | `playlists.updated_at = now()`, then `playlist_version += 1` on every screen whose EFFECTIVE playlist is the id (group playlist if grouped, else own); returns the screen ids |

Call the bump functions via `client.rpc('bump_playlist_version', { p_playlist_id })` → `data: string[]`. EXECUTE on every public
function (helpers, bumps, trigger functions) is revoked from `anon`/`public`; helpers and bumps are granted to `authenticated` and
`service_role` (policies evaluate as `authenticated`).

RLS (`0004_rls.sql`, every table enabled, every policy `to authenticated`): org-scoped tables (`folders`, `content`, `websites`, `playlists`,
`screen_groups`, `screens`): select if `is_org_member(org_id)`, insert/update/delete if `can_write_org(org_id)`. `playlist_items`: same
through `playlist_org_id(playlist_id)`. `organizations`: select if member/super admin; insert/update/delete only super admin. `profiles`:
any authenticated user reads all; update own row only and `is_super_admin` cannot change (`with check (is_super_admin = public.is_super_admin())`).
`memberships`: read if member of that org, write if `can_write_org`. `pairing_codes`: **no policies and table grants revoked from
anon/authenticated** (service role only). `events`: select members, insert `can_write_org`, no update/delete. Anon-key queries (or a
session outside the org) return **zero rows on every policy-bearing table**; `pairing_codes` (grants revoked) and every RPC (EXECUTE
revoked) answer PostgREST error `42501 permission denied` instead of `[]` — the acceptance #7 check accepts `[]` OR a 42501 error for
those two cases.

Storage (`0005_storage.sql`): buckets `media` (private, 500 MB, image/jpeg|png|webp|gif, video/mp4|webm|quicktime), `thumbs` (public, 10 MB,
image/jpeg|png|webp), `logos` (public, 5 MB, `LOGO_MIMES` = image/jpeg|png|webp|gif|svg+xml). Object keys are bucket-relative and stored
WITHOUT a bucket prefix: `content.storage_path = "{org_id}/{content_id}.{ext}"` (bucket media), `content.thumb_path = "{org_id}/{content_id}-thumb.jpg"`
(bucket thumbs), logos at `"{org_id}/logo.{ext}"` (bucket logos; `organizations.logo_url` stores the full public URL). Policies on
`storage.objects`: `msign_super_admin_all` (super admins, all three buckets, `authenticated`) and `msign_authenticated_read` (select on
thumbs/logos for `authenticated`, **scoped to the caller's orgs**: the first path segment must be a uuid and `is_org_member(that uuid)`
must hold — so a future merchant user can list only its own `{org_id}/` folder). **No anon policy**: the anon key cannot list objects;
public files are served through `{NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/{bucket}/{key}` (no RLS). TUS endpoint:
`{NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`.

Realtime (`0006_realtime.sql`): policies on `realtime.messages` — `msign_screen_channel_receive` (`select`, `anon`+`authenticated`, topic
`^screen-<uuid>$`) and `msign_org_channel_receive` (`select`, `authenticated`, topic `^org-<uuid>$` and `is_org_member(<uuid>)`). Both use
the exact 8-4-4-4-12 hex uuid pattern, so the `::uuid` cast can never raise inside a policy. No `insert` policy: only the service role
can publish. See §7.

---

## 4. `types/rows.ts`, `types/db.ts` and `types/api.ts` (exported names)

`types/rows.ts` (re-exported by `types/db.ts` — import from `@/types/db`): `Json`; enums `MembershipRole`, `ContentType`, `PlaylistKind`,
`PlaylistItemType`, `TransitionType`; `EVENT_TYPES` (const) + `EventType`; row types `OrganizationRow`, `ProfileRow`, `MembershipRow`, `FolderRow`,
`ContentRow`, `WebsiteRow`, `PlaylistRow`, `PlaylistItemRow`, `ScreenGroupRow`, `ScreenRow`, `PairingCodeRow`, `EventRow`.

`types/db.ts`: everything above plus `Database` (with `__InternalSupabase`, `Tables` incl. `Relationships` — `screen_groups_playlist_id_fkey`
and `screens_playlist_id_fkey` are `isOneToOne: true` (both playlist FKs are unique) —, `Views`, `Functions`, `Enums`, `CompositeTypes`); helpers `TableName`, `Tables<T>`, `TablesInsert<T>`, `TablesUpdate<T>`,
`Enums<T>`, `DbClient` (= `SupabaseClient<Database>`); aliases `Organization`, `Profile`, `Membership`, `Folder`, `Content`, `Website`, `Playlist`,
`PlaylistItem`, `ScreenGroup`, `Screen`, `PairingCode`. There is **no `Event` alias** (use `EventRow`); `Screen` shadows the DOM global inside
modules that import it — write `window.screen` for the browser screen. All timestamps/dates/times are ISO strings; `numeric`/`bigint` are `number`.

`types/api.ts` (isomorphic):
- Envelope: `ApiSuccess<T> = { data: T }`, `ApiFailure = { error: { message; issues?: ZodIssue[] } }`, `ApiResponse<T>`; `OkResponse { ok: true }`,
  `CountResponse { count }`, `DeletedResponse { deleted }`, `UrlResponse { url }`, `ActiveOrgResponse { org_id }`.
- Enum consts + types: `SORT_DIRS/SortDir`, `CONTENT_SORTS/ContentSort`, `SCREEN_SORTS/ScreenSort`, `WEBSITE_SORTS/WebsiteSort`, `GROUP_SORTS/GroupSort`,
  `SCREEN_STATUSES/ScreenStatus` (list filter: online | offline), `SCREEN_PRESENCE/ScreenPresence` (UI: online | offline | unpaired, from `screenStatus()` §5.10),
  `ROTATIONS/Rotation` (numeric), `REFRESH_OPTIONS/RefreshSeconds` (numeric), `SCREEN_ACTIONS/ScreenAction`,
  `MEDIA_TYPES/MediaType`, `ACCEPTED_MIMES/AcceptedMime`, `LOGO_MIMES/LogoMime`, `MAX_LOGO_BYTES` (5 MiB), `MAX_UPLOAD_BYTES` (500 MiB),
  `RESUMABLE_THRESHOLD_BYTES` (6 MiB), `DEFAULT_ITEM_DURATION_SECONDS` (10), `PAIRING_CODE_ALPHABET`, `PAIRING_CODE_LENGTH` (6), `PAIRING_CODE_TTL_MS`,
  `ACTIVE_ORG_COOKIE` (`'msign_org'`), `ACTIVE_ORG_COOKIE_OPTIONS` (`{ path: '/', httpOnly: false, sameSite: 'lax', maxAge: 31536000 }`).
- Query shapes: `ContentListQuery { q?, sort: ContentSort, dir?, type?, folder_id? (uuid | 'root'), expired: boolean }`, `FolderListQuery { q? }`,
  `WebsiteListQuery { q?, sort, dir? }`, `ScreenListQuery { q?, sort, dir?, status?, group_id? (uuid | 'none') }`, `GroupListQuery { q?, sort, dir? }`,
  `PlaylistListQuery { kind? }`.
- Views: `ContentView = Content & { thumb_url, expired, folder_name }`, `FolderView = Folder & { item_count }`, `WebsiteView = Website & { favicon_url }`,
  `CurrentItemView { id, name, thumb_url, item_type, media_type, website_url }`, `ScreenView = Omit<Screen,'device_token_hash'> & { paired (= hash !== null), online,
  group_name, effective_playlist_id, current_item }`, `PlaylistItemView = PlaylistItem & { name, media_type, thumb_url, source_duration_seconds, website_url, expired }`
  (`thumb_url` is **always null for websites** in both views; `website_url` is the site URL for websites and null for content — UIs render the
  browser-frame placeholder with `faviconUrl(website_url)` for `media_type === 'website'`),
  `PlaylistView = Playlist & { items }`, `ScreenDetailView = ScreenView & { playlist: PlaylistView | null (EFFECTIVE), group: {id,name,playlist_id} | null }`,
  `GroupView = ScreenGroup & { screen_count, online_count, offline_count }`, `GroupDetailView = GroupView & { screens: ScreenView[] (members only, name asc),
  playlist: PlaylistView }`, `OrganizationView = Organization & { screen_count, content_count }`, `UserView { id, email, full_name, last_sign_in_at,
  created_at, is_super_admin }`, `UsageRef { id, name }`, `UsageResponse { screens, groups }`, `UploadSignResponse`, `AppUser { id, email }`,
  `AppBootstrap { user, profile, org, orgs }`, `CronTickResponse { screens_checked, went_offline, came_online, playlists_touched, codes_deleted }`.
- Device: `PairingCodeResponse { code, expires_at, device_token }` (raw token, once — decision §0.13), `PairingStatusResponse = { claimed: false, expires_at } | { claimed: true, screen_id }`,
  `PendingPairingState { code, device_token, expires_at }` (localStorage `msign.pending`),
  `HeartbeatRequest { current_item_id: string | null, resolution?, playlist_version (−1 = no manifest), uptime_seconds? }`, `HeartbeatResponse { playlist_version }`,
  `ManifestSchedule`, `ManifestItem` (incl. `expires_at: string | null`), `Manifest` (see §6.3), `PlayerDeviceState { device_token, screen_id }`.
- Realtime: `SCREEN_COMMAND_EVENTS/ScreenCommandEvent`, `ScreenCommandPayload { at }`, `ScreenStatusPayload { screen_id, last_seen_at, current_item_id, online: true }`,
  `ORG_CHANNEL_EVENTS/OrgChannelEvent`, `CHANGED_TABLES/ChangedTable` (incl. `'orgs'`), `OrgChangedPayload { table, id?, at }`,
  `RealtimeScreensValue { statuses: Record<screen_id, ScreenStatusPayload>, connected }`.

Sort semantics (server side, `dir` optional — default per sort key): `name` → `name asc` (case-insensitive: `.order('name', { ascending })`),
`newest` → `created_at desc`, `oldest` → `created_at asc`, `size` → `size_bytes desc`, `type` → `type asc, name asc`, `last_seen` → `last_seen_at desc
nulls last`. `dir` when present overrides the direction of the primary column (API-only; no UI control). `q` = `ilike '%q%'` on `name` (escape `%`/`_`).

---

## 5. Server libraries — every exported function

Conventions: server lib functions take the client as first argument (`DbClient`); `ctx: OrgContext` bundles user/org/session client;
`admin` is always the service-role client. Functions throw `ApiError` (never return error objects). Every mutating function ends with
`await notifyOrgChanged(ctx.org.id, table, id)` (best effort: it logs instead of throwing) so other admin tabs refetch. **Broadcast helpers
are always `await`ed — never fire-and-forget**: on Vercel the function is frozen as soon as the handler returns, so an un-awaited
`httpSend` would silently drop `sync`/`status`/`changed` in production while working in `next dev`. Shorthands in the prose below such as
"`notifyOrgChanged('screens', id)`" always mean the full `notifyOrgChanged(ctx.org.id, 'screens', id)` call from §5.8.

### 5.1 `lib/api.ts` ★ (A)
```ts
import type { NextRequest } from 'next/server'
export class ApiError extends Error { status: number; issues?: ZodIssue[]; constructor(status: number, message: string, issues?: ZodIssue[]) }
export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>>          // 200 (or init.status), JSON { data }
export function fail(message: string, status: number, issues?: ZodIssue[]): NextResponse<ApiFailure>
export async function parseBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>>  // invalid JSON → 400; schema fail → 422 + issues
export function parseQuery<S extends z.ZodType>(request: Request, schema: S): z.infer<S>   // URLSearchParams → plain object (last value wins) → 422
export type HandlerContext<P = Record<string, string>> = { params: Promise<P> }            // NOT "RouteContext": Next 15.5 declares a global of that name
export type HandlerFn<P = Record<string, string>> = (request: NextRequest, ctx: HandlerContext<P>) => Promise<Response>
export function withHandler<P = Record<string, string>>(fn: HandlerFn<P>): HandlerFn<P>
```
`withHandler` catch: first `unstable_rethrow(e)` (from `next/navigation`, so `redirect()`/`notFound()` keep working); then `ApiError` → its
status/message/issues; `ZodError` → 422; `isAuthApiError(e)` (exported by `@supabase/supabase-js`; thrown by `auth.admin.*`, `code` is a
string like `email_exists`, `status` 4xx) → `fail(e.message, e.status ?? 500)`; PostgREST errors (`{ code, message }` objects) → 409 for
`23505` (unique), 422 `'Invalid reference'` for `23503` (FK / cross-org / playlist-kind trigger), 404 for `PGRST116` (no rows), else 500;
anything else → 500 `"Internal error"` and `console.error`.
`requireCronSecret` lives in `lib/cron.ts` (§5.26), not here. Route template:
```ts
export const PATCH = withHandler<{ id: string }>(async (request, ctx) => {
  const { id } = await ctx.params
  const ctxOrg = await requireOrgContext()
  const input = await parseBody(request, screenUpdateSchema)
  return ok(await updateScreen(ctxOrg, createAdminClient(), id, input))
})
```

### 5.2 `lib/supabase/*` ★ (A)
```ts
// client.ts ('use client'-safe) — browser client, module singleton
export function createBrowserClient(): DbClient        // import { createBrowserClient as ssrBrowserClient } from '@supabase/ssr'; ssrBrowserClient<Database>(url, anon)
// server.ts — session-bound server client (RLS enforced)
export async function createServerClient(): Promise<DbClient>   // import { createServerClient as ssrServerClient } from '@supabase/ssr'; ssrServerClient<Database>(url, anon, { cookies: { getAll, setAll (try/catch) } }) with cookies()
// admin.ts — service role. NEVER import from client code. New instance per call (no socket opens; server code never subscribes).
export function createAdminClient(): DbClient          // createClient<Database>(url, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } })
// middleware.ts
export async function updateSession(request: NextRequest): Promise<{ response: NextResponse; user: User | null }>
```
`middleware.ts` (root): calls `updateSession`; public paths: `/login`, `/auth/confirm`, `/player`, `/api/device/*`, `/api/cron/*`, `/_next/*`,
static files. Unauthenticated page request → redirect `/login?next={pathname}`; unauthenticated `/api/*` → pass through (route returns 401 JSON);
authenticated on `/login` → redirect `/screens`. Matcher: `['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm|woff2?)$).*)']`.

### 5.3 `lib/api-client.ts` ★ (A) — browser side
```ts
export class ApiClientError extends Error { status: number; issues?: ZodIssue[] }
export async function apiFetch<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T>
  // sets Content-Type/body from `json`, `credentials: 'same-origin'`, unwraps { data }, throws ApiClientError on { error } / non-2xx
export function buildQuery(params: Record<string, string | number | boolean | null | undefined>): string  // '?a=b&c=1' (skips undefined/null/'' and false)
```

### 5.4 `lib/auth.ts` ★ (A)
```ts
export type SessionContext = { user: User; profile: Profile; supabase: DbClient }        // supabase = session-bound server client
export type OrgContext = SessionContext & { org: Organization }
export async function getSessionUser(): Promise<SessionContext | null>                    // non-throwing (layouts)
export async function requireUser(): Promise<SessionContext>                              // ApiError(401, 'Unauthorized')
export async function requireSuperAdmin(): Promise<SessionContext>                        // requireUser + profile.is_super_admin else ApiError(403)
export async function requireOrgContext(): Promise<OrgContext>                            // requireUser + getActiveOrg; ApiError(400, 'No active organization') when none
```
`getSessionUser`: `supabase = await createServerClient()` → `supabase.auth.getUser()` (**never `getSession()`** — on the server it returns the
unverified cookie payload) → `profiles` select by `user.id` (`maybeSingle`). No user, or no profile row (trigger failed / pre-existing auth
user) → return `null` (`console.warn` the missing profile). `requireUser` throws 401 on `null`.

### 5.5 `lib/orgs.ts` ★ (A)
```ts
export { ACTIVE_ORG_COOKIE, ACTIVE_ORG_COOKIE_OPTIONS } from '@/types/api'                // defined in types/api.ts (isomorphic); this module is server-only (next/headers)
export async function listVisibleOrgs(supabase: DbClient): Promise<Organization[]>        // RLS-filtered, order by name asc
export async function getActiveOrg(supabase?: DbClient): Promise<Organization | null>     // cookie id if it is in listVisibleOrgs, else first org, else null
```
Switching: `POST /api/orgs/active { org_id }` validates the org is visible, sets the cookie (`cookies().set(ACTIVE_ORG_COOKIE, org_id,
ACTIVE_ORG_COOKIE_OPTIONS)` on the response), returns `{ org_id }`; the client then calls `router.refresh()`. The cookie is read only on the
server (`getActiveOrg`); no client component reads it — the active org reaches the client through `AppBootstrap.org`. Deleting the active
org: the next layout render falls back to the first org.

### 5.6 `lib/query-keys.ts` ★ (A)
```ts
export const queryKeys = {
  content:   { all:          (orgId: string) => ['content', orgId] as const,
               list:         (orgId: string, q: ContentListQuery) => ['content', orgId, 'list', q] as const,
               detail:       (orgId: string, id: string) => ['content', orgId, 'detail', id] as const,
               usage:        (orgId: string, id: string) => ['content', orgId, 'usage', id] as const,
               expiredCount: (orgId: string) => ['content', orgId, 'expired-count'] as const },
  folders:   { all: (orgId: string) => ['folders', orgId] as const, list: (orgId: string, q: FolderListQuery) => ['folders', orgId, 'list', q] as const },
  websites:  { all: (orgId: string) => ['websites', orgId] as const, list: (orgId: string, q: WebsiteListQuery) => ['websites', orgId, 'list', q] as const,
               detail: (orgId: string, id: string) => ['websites', orgId, 'detail', id] as const, usage: (orgId: string, id: string) => ['websites', orgId, 'usage', id] as const },
  screens:   { all: (orgId: string) => ['screens', orgId] as const, list: (orgId: string, q: ScreenListQuery) => ['screens', orgId, 'list', q] as const,
               detail: (orgId: string, id: string) => ['screens', orgId, 'detail', id] as const },
  groups:    { all: (orgId: string) => ['groups', orgId] as const, list: (orgId: string, q: GroupListQuery) => ['groups', orgId, 'list', q] as const,
               detail: (orgId: string, id: string) => ['groups', orgId, 'detail', id] as const },
  playlists: { all: (orgId: string) => ['playlists', orgId] as const, detail: (orgId: string, id: string) => ['playlists', orgId, 'detail', id] as const },
  orgs:      { all: () => ['orgs'] as const, list: () => ['orgs', 'list'] as const, detail: (id: string) => ['orgs', 'detail', id] as const },
  users:     { all: () => ['users'] as const, list: () => ['users', 'list'] as const },
}
```
Every factory has explicit parameter types (strict mode). Root segment == `ChangedTable` name, so
`queryClient.invalidateQueries({ queryKey: [table, orgId] })` refreshes a resource after a `changed` broadcast (`'orgs'` →
`queryClient.invalidateQueries({ queryKey: queryKeys.orgs.all() })`). Invalidate `queryKeys.X.all(orgId)` after your own mutations.
React Query v5 only accepts the object form — `invalidateQueries({ queryKey })`; the bare-array form does not compile.

### 5.7 `lib/utils.ts` ★ (A)
```ts
export function cn(...inputs: ClassValue[]): string                       // existing
export function formatBytes(bytes: number): string                        // '1.2 MB'
export function formatDuration(seconds: number | null | undefined): string // '0:05', '1:03:20'; '' for null
export function relativeTime(value: string | Date | null | undefined, now?: Date): string // 'just now', '3 minutes ago', 'never' for null (date-fns formatDistanceStrict + addSuffix)
export function initials(nameOrEmail: string): string                     // 'JD' / 'A'
export function isRotation(n: number): n is Rotation
export function slugify(name: string): string                             // lowercase, a-z0-9 and '-', trimmed, max 60
export function escapeLike(q: string): string                             // escapes % _ \ for ilike
export function toDateString(date: Date): string                          // date-fns format(date, 'yyyy-MM-dd') — LOCAL calendar day, never toISOString()
export function fromDateString(value: string): Date                       // date-fns parse(value, 'yyyy-MM-dd', new Date()) — local midnight of that day
export function faviconUrl(url: string): string                           // `https://www.google.com/s2/favicons?domain=${new URL(url).host}&sz=64`; '' when url does not parse
```
`toDateString`/`fromDateString` are the ONLY Calendar ⇄ `YYYY-MM-DD` conversions (schedule `active_from/active_to`, expiration picker):
`date.toISOString().slice(0, 10)` shifts the day for users east/west of UTC and is forbidden. `faviconUrl` is isomorphic here so client
cards can render website favicons; `lib/websites.ts` re-exports it.

### 5.8 `lib/channels.ts` ★ (G, isomorphic, pure) and `lib/broadcast.ts` ★ (G, server-only)
```ts
// lib/channels.ts — imported by server AND client code (useOrgRealtime, usePlayerChannel)
export function screenChannel(screenId: string): string                   // `screen-${screenId}`
export function orgChannel(orgId: string): string                         // `org-${orgId}`
export const CHANNEL_CONFIG = { config: { private: true } } as const      // pass to every .channel(name, CHANNEL_CONFIG), server and browser
export function isScreenStatusPayload(v: unknown): v is ScreenStatusPayload   // object with string screen_id + last_seen_at, current_item_id string|null, online === true
export function isOrgChangedPayload(v: unknown): v is OrgChangedPayload       // object with table ∈ CHANGED_TABLES, id string|undefined, at string
export function isScreenCommandPayload(v: unknown): v is ScreenCommandPayload // object with at: string

// lib/broadcast.ts — service role only
export async function broadcast(channel: string, event: string, payload: object): Promise<void>
export async function broadcastToScreens(screenIds: string[], event: ScreenCommandEvent, payload?: ScreenCommandPayload): Promise<void>
export async function notifyOrgChanged(orgId: string, table: ChangedTable, id?: string): Promise<void>   // broadcast(orgChannel, 'changed', { table, id, at })
export async function broadcastScreenStatus(orgId: string, payload: ScreenStatusPayload): Promise<void>  // broadcast(orgChannel, 'status', payload)
```
Implementation of `broadcast` (supersedes spec §10's subscribe/send/teardown — decision §0.1; REST is required):
```ts
const admin = createAdminClient()
const ch = admin.channel(channel, CHANNEL_CONFIG)                 // private → httpSend adds ?private=true
try { await ch.httpSend(event, payload) }                         // POST {realtime}/api/broadcast/{topic}/events/{event}, needs Realtime ≥ v2.97.0
catch (e) {
  if (String(e).includes('v2.97.0')) await ch.send({ type: 'broadcast', event, payload })   // legacy REST batch on an older local stack
  else console.error('[broadcast]', channel, event, e)
} finally { await admin.removeChannel(ch) }
```
Never subscribes, never throws (resolve after logging) — and every caller `await`s it (§5 conventions). `payload.at` defaults to
`new Date().toISOString()`. No `setAuth()` is needed and none is called: realtime-js only adds `Authorization` when it holds an access token,
so the service key travels in the `apikey` header alone, which is exactly what hosted Realtime needs for a service-role REST publish —
do not "fix" this by opening a websocket. Browser consumers (`useOrgRealtime`, `usePlayerChannel`) receive broadcast payloads typed
`any` by realtime-js: treat them as `unknown`, pass them through the `is*Payload` guards above, and `console.warn` + ignore anything
that fails.

### 5.9 `lib/events.ts` ★ (G)
```ts
export type LogEventInput = { org_id: string; screen_id?: string | null; type: EventType; payload?: Json }
export async function logEvent(client: DbClient, input: LogEventInput): Promise<void>    // insert; errors are console.error'd, never thrown
export async function lastScreenStatusEvent(admin: DbClient, screenId: string): Promise<EventType | null>  // latest type in (screen_online, screen_offline, screen_paired)
```
Payload conventions: `screen_paired { name }`, `screen_online { last_seen_at }` (the new value), `screen_offline { last_seen_at }` (the last
heartbeat before the gap), `screen_deleted { name }`, `playlist_updated { playlist_id, screen_ids }`, `content_uploaded { content_id, name, type, size_bytes }`,
`content_deleted { content_id, name }`. Status events alternate: a `screen_online` is never written directly after another `screen_online` —
the heartbeat writes the missing `screen_offline` first (§5.24, decision §0.5).

### 5.10 `lib/status.ts` ★ (G) — isomorphic, pure
```ts
export const ONLINE_WINDOW_MS = 75_000
export const HEARTBEAT_INTERVAL_MS = 30_000
export function isOnline(lastSeenAt: string | Date | null | undefined, now?: Date): boolean
export function mergeScreenStatus(screen: ScreenView, status: ScreenStatusPayload | undefined, now: Date): ScreenView
  // last_seen_at = max(screen, status); current_item_id from status when newer; online recomputed with isOnline
export function screenStatus(view: Pick<ScreenView, 'paired' | 'online'>): ScreenPresence
  // !paired → 'unpaired' (seeded placeholder screens, revoked screens); else online ? 'online' : 'offline'
```
`ScreenPresence` (`types/api.ts`) is what `StatusPill`/`TvFrame`/`ScreenCard` render; the list filter `SCREEN_STATUSES` stays online/offline
(an unpaired screen filters as `offline`).

### 5.11 `lib/schedule.ts` ★ (G) — isomorphic, pure (used by the player and the editor)
```ts
// All functions take ManifestSchedule directly (types/api.ts) — playlist_items rows and ManifestItem.schedule satisfy it structurally; no alias.
export function hasSchedule(s: ManifestSchedule): boolean  // any field set (empty days_of_week counts as unset)
export function zonedParts(now: Date, timeZone: string): { date: string; minutes: number; weekday: number } // 'YYYY-MM-DD', minutes since midnight, 0=Sunday
export function zoneOffsetMs(at: Date, timeZone: string): number                 // UTC offset of the zone at that instant (Intl formatToParts), e.g. −14_400_000 for EDT
export function endOfDayInZone(date: string, timeZone: string): string           // ISO instant of 23:59:59.999 of calendar day 'YYYY-MM-DD' in the zone
export function dateInZone(iso: string | Date, timeZone: string): string         // 'YYYY-MM-DD' of that instant in the zone (= zonedParts(...).date)
export function isItemActive(s: ManifestSchedule, now: Date, timeZone: string): boolean
export function describeSchedule(s: ManifestSchedule): string  // 'Always' | e.g. 'Mon–Fri · 09:00–17:00 · 2026-09-01 → 2026-09-30'
```
`isItemActive`: date range inclusive on both ends compared as `YYYY-MM-DD` strings in the zone; `days_of_week` null/empty = every day;
daily window uses `[start, end)` in minutes; `start > end` = overnight window (`m >= start || m < end`); `start == end` = all day; only one of
start/end set → the other defaults to `00:00` / `24:00`. Times accept `HH:MM` or `HH:MM:SS`. Invalid `timeZone` → fall back to `'UTC'`.
`endOfDayInZone`: `guess = Date.UTC(y, m − 1, d, 23, 59, 59, 999)`; `result = guess − zoneOffsetMs(guess, tz)`; if `zoneOffsetMs(result, tz)`
differs (DST edge) recompute once with that offset; return `new Date(result).toISOString()`.
**Content expiration rule** (binding for `ExpirationDialog`, `ContentCard`, seed and README): a picked calendar day `D` is stored as
`expires_at = endOfDayInZone(D, org.timezone)` — the item plays through the end of that day in the org's zone and is `expired` (badge, manifest,
cron, player) from the next millisecond; the picker pre-selects `fromDateString(dateInZone(expires_at, org.timezone))` and cards show
"Expires {dateInZone(expires_at, org.timezone)}". Picking yesterday therefore yields an immediate **Expired** badge (acceptance #4) in every
browser time zone.

### 5.12 `lib/storage.ts` ★ (B) — path helpers are isomorphic; signed-URL helpers are server only
```ts
export const BUCKETS = { media: 'media', thumbs: 'thumbs', logos: 'logos' } as const
export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS]
export const DEVICE_SIGNED_URL_TTL_SECONDS = 86_400
export const ADMIN_SIGNED_URL_TTL_SECONDS = 3_600
export const MIME_EXTENSIONS: Record<AcceptedMime, string>   // jpg png webp gif mp4 webm mov
export function contentTypeForMime(mime: string): ContentType | null
export function extensionForMime(mime: string): string | null
export function logoExtensionForMime(mime: string): string | null          // 'svg' for image/svg+xml, else extensionForMime; null when not in LOGO_MIMES
export function mediaPath(orgId: string, contentId: string, ext: string): string   // `${orgId}/${contentId}.${ext}`
export function thumbPath(orgId: string, contentId: string): string                // `${orgId}/${contentId}-thumb.jpg`
export function logoPath(orgId: string, ext: string): string                       // `${orgId}/logo.${ext}`
export function publicUrl(bucket: BucketName, key: string): string                 // `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${key}`
export function publicThumbUrl(thumbPath: string | null | undefined): string | null
export function resumableUploadUrl(): string                                       // `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`
export async function createMediaSignedUrl(admin: DbClient, key: string, ttlSeconds: number, download?: string): Promise<string>  // download = filename → Content-Disposition attachment
export async function createMediaSignedUrls(admin: DbClient, keys: string[], ttlSeconds: number): Promise<Map<string, string>>
  // storage createSignedUrls; entries with `error` or a null `signedUrl` are OMITTED from the map (console.warn)
export async function removeObjects(admin: DbClient, bucket: BucketName, keys: string[]): Promise<void>   // best effort, never throws
export async function removeOrgObjects(admin: DbClient, orgId: string): Promise<void>                    // list + remove `${orgId}/` in all 3 buckets, best effort
```
`removeOrgObjects`: per bucket, page through `storage.from(b).list(orgId, { limit: 1000, offset })` (`offset += 1000`) until a page
returns fewer than `limit` entries (the default page is 100 — a single call would orphan every file past it), collect `${orgId}/${name}`
keys, then `remove` in batches of 100. Still best-effort: every error is `console.error`'d, nothing throws.

### 5.13 `lib/thumbs.ts` (B) — browser only
```ts
export type ImageMeta = { width: number; height: number }
export type VideoMeta = { width: number; height: number; duration_seconds: number }
export async function extractImageMeta(file: File): Promise<ImageMeta>
export async function extractVideoMeta(file: File): Promise<VideoMeta>              // <video preload="metadata"> loadedmetadata
export async function makeImageThumb(file: File, maxWidth?: number): Promise<Blob>  // canvas → image/jpeg q0.82, default maxWidth 640 (gif: first frame)
export async function captureVideoFrame(file: File, atSeconds?: number): Promise<Blob> // seek min(1, duration/2) → canvas → jpeg
```

### 5.14 `lib/uploads.ts` (B)
```ts
export async function signUpload(ctx: OrgContext, admin: DbClient, input: UploadSignInput): Promise<UploadSignResponse>
```
Generates `content_id = crypto.randomUUID()`, `storage_path = mediaPath(org.id, content_id, ext)`, `thumb_path = thumbPath(org.id, content_id)`,
`admin.storage.from('media').createSignedUploadUrl(storage_path, { upsert: true })` → `{ signedUrl, token }` (upsert so a retried XHR upload does
not 409), `resumable = size_bytes > RESUMABLE_THRESHOLD_BYTES`, `upload_url = resumableUploadUrl()`, `bucket: 'media'`. Rejects mime not in
`ACCEPTED_MIMES` (422) and size > `MAX_UPLOAD_BYTES` (413 via ApiError). `name` uses `nameSchema` (max 120) — the same limit as `contentCreateSchema`.

### 5.15 `lib/content.ts` (B)
```ts
export function toContentView(row: Content & { folders?: { name: string } | null }, now?: Date): ContentView
export async function listContent(supabase: DbClient, orgId: string, query: ContentListQuery): Promise<ContentView[]>
export async function getContent(supabase: DbClient, orgId: string, id: string): Promise<ContentView>       // 404
export async function createContent(ctx: OrgContext, admin: DbClient, input: ContentCreateInput): Promise<ContentView>  // insert with given id, created_by = user.id; logEvent content_uploaded; notifyOrgChanged
export async function updateContent(ctx: OrgContext, admin: DbClient, id: string, input: ContentUpdateInput): Promise<ContentView> // rename / move / expiration; if expires_at changed → touch every playlist referencing it
export async function getContentUsage(supabase: DbClient, orgId: string, id: string): Promise<UsageResponse>
export async function deleteContent(ctx: OrgContext, admin: DbClient, id: string): Promise<void>
export async function countExpired(supabase: DbClient, orgId: string, now?: Date): Promise<number>
export async function deleteExpired(ctx: OrgContext, admin: DbClient, now?: Date): Promise<number>          // deleteContent for each expired row
export async function getContentUrl(admin: DbClient, content: Content, download?: boolean): Promise<string> // 1h signed URL; download → attachment named content.name
export async function playlistIdsUsingContent(supabase: DbClient, contentId: string): Promise<string[]>
```
`createContent` trusts nothing from the client: 422 unless `input.storage_path === mediaPath(org.id, input.id, extensionForMime(input.mime))`,
`input.thumb_path ∈ { null, thumbPath(org.id, input.id) }` and `input.type === contentTypeForMime(input.mime)`; `folder_id` (when set) must be a
folder of `ctx.org` (session select, else `ApiError(422, 'Unknown folder')`). `updateContent` applies the same folder check.
`deleteContent` order: collect `playlist_ids` using it → delete row with the session client (items cascade) → `touchPlaylist(admin, id)` for
each affected playlist → `removeObjects(admin, 'media', [storage_path])` + thumb → `logEvent content_deleted` → `notifyOrgChanged(ctx.org.id, 'content', id)`.
List/detail selects use the literal `'*, folders(name)' as const` (§2.2) so `toContentView` receives a typed row.
Usage = screens whose EFFECTIVE playlist contains the item (own playlist, or group playlist via `screen_groups.playlist_id`) + groups whose
playlist contains it.

### 5.16 `lib/folders.ts` (B)
```ts
export async function listFolders(supabase: DbClient, orgId: string, query: FolderListQuery): Promise<FolderView[]>  // name asc, item_count via content(count)
export async function createFolder(ctx: OrgContext, input: FolderInput): Promise<FolderView>
export async function renameFolder(ctx: OrgContext, id: string, input: FolderInput): Promise<FolderView>
export async function deleteFolder(ctx: OrgContext, id: string): Promise<void>     // content.folder_id → null by FK; notifyOrgChanged(ctx.org.id, 'folders', id) and notifyOrgChanged(ctx.org.id, 'content')
```
`listFolders` selects `'*, content(count)' as const` and maps `item_count = row.content[0]?.count ?? 0` (PostgREST count embed).

### 5.17 `lib/websites.ts` (C)
```ts
export { faviconUrl } from '@/lib/utils'                 // defined in lib/utils.ts (isomorphic, §5.7); re-exported here for server callers
export function toWebsiteView(row: Website): WebsiteView // favicon_url = faviconUrl(row.url)
export async function listWebsites(supabase: DbClient, orgId: string, query: WebsiteListQuery): Promise<WebsiteView[]>
export async function getWebsite(supabase: DbClient, orgId: string, id: string): Promise<WebsiteView>
export async function createWebsite(ctx: OrgContext, input: WebsiteInput): Promise<WebsiteView>
export async function updateWebsite(ctx: OrgContext, admin: DbClient, id: string, input: WebsiteInput): Promise<WebsiteView>  // url/refresh change → touch playlists using it
export async function getWebsiteUsage(supabase: DbClient, orgId: string, id: string): Promise<UsageResponse>
export async function deleteWebsite(ctx: OrgContext, admin: DbClient, id: string): Promise<void>   // same guard/sequence as deleteContent (no storage, no event)
```

### 5.18 `lib/playlists.ts` ★ (E)
```ts
export async function getEffectivePlaylistId(client: DbClient, screen: Pick<Screen, 'group_id' | 'playlist_id'>): Promise<string | null>
export async function createPlaylist(client: DbClient, orgId: string, name: string, kind: PlaylistKind): Promise<Playlist>
export function toPlaylistItemView(item: PlaylistItem & { content: Content | null; websites: Website | null }, now?: Date): PlaylistItemView
export async function listPlaylists(supabase: DbClient, orgId: string, query: PlaylistListQuery): Promise<Playlist[]>
export async function getPlaylistView(supabase: DbClient, orgId: string, playlistId: string): Promise<PlaylistView>   // 404; items ordered by position
export async function savePlaylistItems(ctx: OrgContext, admin: DbClient, playlistId: string, items: PlaylistItemInput[]): Promise<PlaylistView>
export async function touchPlaylist(admin: DbClient, playlistId: string): Promise<string[]>
export async function deletePlaylist(client: DbClient, playlistId: string): Promise<void>
```
`savePlaylistItems`: verify playlist belongs to `ctx.org` (404 otherwise); verify every `content_id`/`website_id` belongs to the org (422);
existing = current item ids; delete existing ∖ input; upsert input rows with `position = index`, `playlist_id` forced; then
`touchPlaylist(admin, playlistId)`; return `getPlaylistView`. Ids are client-generated (`crypto.randomUUID()`) and stable across saves.
`touchPlaylist`: `admin.rpc('bump_playlist_version', { p_playlist_id })` → screen ids → `broadcastToScreens(ids, 'sync')` →
`logEvent(admin, { org_id: playlist_org_id, type: 'playlist_updated', payload: { playlist_id, screen_ids } })` → `notifyOrgChanged(org, 'playlists', id)`
and `notifyOrgChanged(org, 'screens')` → returns ids. It is idempotent in effect (bumping twice only causes an extra `sync`).

### 5.19 `lib/screens.ts` ★ (D)
```ts
export const SCREEN_SELECT = '*, screen_groups(name, playlist_id), current_item:playlist_items!screens_current_item_id_fkey(*, content(*), websites(*))' as const
  // the LITERAL type, never annotated `: string` (a string-typed select resolves to GenericStringError[], §2.2)
export type ScreenSource = Screen & { screen_groups: { name: string; playlist_id: string } | null; current_item: (PlaylistItem & { content: Content | null; websites: Website | null }) | null }
  // must equal the parsed row type of supabase.from('screens').select(SCREEN_SELECT) — verify with
  // `QueryData<ReturnType<typeof screenQuery>>[number]` (from '@supabase/supabase-js') or a `satisfies` check; no casts anywhere
export function toScreenView(row: ScreenSource, now?: Date): ScreenView
export async function listScreens(supabase: DbClient, orgId: string, query: ScreenListQuery): Promise<ScreenView[]>  // status filter applied in JS after isOnline
export async function getScreenView(supabase: DbClient, orgId: string, id: string): Promise<ScreenView>              // 404
export async function getScreenDetail(supabase: DbClient, orgId: string, id: string): Promise<ScreenDetailView>
export async function claimScreen(ctx: OrgContext, admin: DbClient, input: ClaimScreenInput): Promise<ScreenView>
export async function updateScreen(ctx: OrgContext, admin: DbClient, id: string, input: ScreenUpdateInput): Promise<ScreenView>
export async function deleteScreen(ctx: OrgContext, admin: DbClient, id: string): Promise<void>
export async function sendScreenAction(ctx: OrgContext, id: string, action: ScreenAction): Promise<void>            // 404 if not in org; broadcastToScreens([id], action)
export async function bumpAndSyncScreens(admin: DbClient, screenIds: string[]): Promise<void>  // rpc bump_screen_versions → broadcastToScreens(updated, 'sync'); no-op for []
export async function syncOrgScreens(admin: DbClient, orgId: string): Promise<void>            // bumpAndSyncScreens for every screen of the org (org name/timezone/logo changes)
export async function createScreenWithPlaylist(ctx: OrgContext, name: string, extra?: Partial<TablesInsert<'screens'>>): Promise<Screen> // playlist(kind 'screen', name) then screen; deletes the playlist if the screen insert fails
```
`toScreenView`: `paired = row.device_token_hash !== null`, `online = isOnline(last_seen_at, now)`, `group_name`, `effective_playlist_id =
screen_groups?.playlist_id ?? playlist_id`, `current_item` from the embed (null when absent; `thumb_url = null` and `website_url = websites.url`
for website items, `website_url = null` for content). `getScreenDetail`: self-heals a screen with `playlist_id null && group_id null` by
`createPlaylist(supabase, orgId, name, 'screen')` + update; `playlist = getPlaylistView(effective)`, `group = { id, name, playlist_id } | null`.
`claimScreen` (decision §0.13 — the device already holds the raw token; two admins may enter the same code): 1) `admin` reads `pairing_codes`
where `code`, `claimed_screen_id is null`, `expires_at > now()` (404 `'Code not found or expired'`); 2) `screen = createScreenWithPlaylist(ctx, name,
{ device_token_hash: row.device_token_hash, paired_at: now })` (session client → RLS) — an insert failing with `23505` on
`screens_device_token_hash_key` means the other admin won: throw `ApiError(409, 'Code already claimed')`; 3) `admin.from('pairing_codes')
.update({ claimed_screen_id: screen.id, expires_at: now + PAIRING_CODE_TTL_MS }).eq('code', code).is('claimed_screen_id', null).gt('expires_at', nowIso).select('id')`
must return exactly 1 row — otherwise delete the screen row and `deletePlaylist(admin, screen.playlist_id)` and throw `ApiError(409, 'Code already
claimed')`; 4) `logEvent screen_paired { name }`; `notifyOrgChanged(ctx.org.id, 'screens', screen.id)`; return `getScreenView`. (The extended
`expires_at` keeps a claimed code answering `{ claimed: true, screen_id }` to the device's polls; cron deletes it afterwards. No token is ever
written to or read from `pairing_codes` after creation — only the hash is copied.)
`updateScreen`: `group_id` (non-null) must be a `screen_groups` row with `org_id = ctx.org.id` (session select) else `ApiError(422, 'Unknown group')`;
`name` → plain update; `rotation` or `group_id` change → update then `bumpAndSyncScreens(admin, [id])` (NOT touchPlaylist: no playlist changed);
`notifyOrgChanged(ctx.org.id, 'screens', id)`.
`deleteScreen`: read (404) → `admin` sets `device_token_hash = null` FIRST → `broadcastToScreens([id], 'unpair')` → delete row (session) →
`deletePlaylist(admin, own playlist_id)` → `logEvent screen_deleted { name }` (screen_id null) → `notifyOrgChanged(ctx.org.id, 'screens', id)`. The order
matters: the player verifies `unpair` by calling the manifest, which must already answer 401.

### 5.20 `lib/groups.ts` (F)
```ts
export async function listGroups(supabase: DbClient, orgId: string, query: GroupListQuery): Promise<GroupView[]>
export async function getGroupDetail(supabase: DbClient, orgId: string, id: string): Promise<GroupDetailView>   // screens = members (group_id = id), name asc
export async function createGroup(ctx: OrgContext, input: GroupInput): Promise<GroupView>            // createPlaylist(kind 'group', name) then group
export async function updateGroup(ctx: OrgContext, id: string, input: GroupInput): Promise<GroupView> // rename (also renames the playlist)
export async function deleteGroup(ctx: OrgContext, admin: DbClient, id: string): Promise<void>       // member ids → set group_id null → bumpAndSyncScreens → delete group → deletePlaylist
export async function setGroupScreens(ctx: OrgContext, admin: DbClient, id: string, screenIds: string[]): Promise<GroupDetailView>
```
`setGroupScreens`: target set = `screenIds` (must all be org screens, 422 otherwise); remove = current members ∖ target (group_id → null);
add = target ∖ current (group_id → id, even if they were in another group); `bumpAndSyncScreens(admin, add ∪ remove)`; `notifyOrgChanged(ctx.org.id, 'groups', id)`
and `notifyOrgChanged(ctx.org.id, 'screens')`.

### 5.21 `lib/users.ts` (A)
```ts
export async function listUsers(admin: DbClient): Promise<UserView[]>              // auth.admin.listUsers({ perPage: 1000 }) joined with profiles
export async function inviteUser(admin: DbClient, email: string): Promise<UserView> // auth.admin.inviteUserByEmail(email, { redirectTo: `${APP_URL}/auth/confirm?next=/set-password` }) then profiles.is_super_admin = true (upsert)
export async function removeUser(admin: DbClient, id: string, currentUserId: string): Promise<void>  // 400 'You cannot remove yourself'; auth.admin.deleteUser
```
auth-js `User` has optional fields — coerce once, here and in Appendix B: `email = user.email ?? ''`, `last_sign_in_at = user.last_sign_in_at ?? null`,
`full_name = profile?.full_name ?? null`, `is_super_admin = profile?.is_super_admin ?? false`. `auth.admin.*` returns `{ data, error }` where
`error` is an `AuthApiError` (never thrown by the SDK): `inviteUser` maps `error.code === 'email_exists'` → `ApiError(409, 'A user with this email
already exists')`, `removeUser` maps `user_not_found` → `ApiError(404, 'User not found')`, anything else → `throw error` (→ `withHandler`'s
`isAuthApiError` branch, §5.1).
Invite flow: `app/auth/confirm/route.ts` (GET `token_hash`, `type`, `next`) → server client `auth.verifyOtp({ type, token_hash })` →
`NextResponse.redirect(new URL(next, request.url))` (default `/screens`; `next` must start with `/` and not `//`) or
`/login?error=invalid_link`. Do not call `redirect()` from `next/navigation` inside `withHandler`. `/set-password` (client) →
`supabase.auth.updateUser({ password })` → `/screens`.
The Supabase "Invite user" email template must link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/set-password`
(slice I documents this in README).

### 5.22 `lib/organizations.ts` (A)
```ts
export async function listOrgViews(supabase: DbClient): Promise<OrganizationView[]>   // supabase.from('organizations').select('*, screens(count), content(count)' as const).order('name'); screen_count = row.screens[0]?.count ?? 0 (PostgREST count embed — never fetch the rows)
export async function getOrgView(supabase: DbClient, id: string): Promise<OrganizationView>   // same select, .eq('id', id).single() (404)
export async function createOrg(ctx: SessionContext, input: OrgCreateInput): Promise<Organization>   // slug = slugify(name), unique-ified with -2, -3 …
export async function updateOrg(ctx: SessionContext, admin: DbClient, id: string, input: OrgUpdateInput): Promise<Organization>
export async function deleteOrg(ctx: SessionContext, admin: DbClient, id: string): Promise<void>     // removeOrgObjects best effort → delete row (cascade)
export async function uploadOrgLogo(ctx: SessionContext, admin: DbClient, id: string, file: File): Promise<Organization>
```
`updateOrg` / `uploadOrgLogo`: after the row update, when `name`, `timezone` or `logo_url` actually changed → `syncOrgScreens(admin, id)` (players
refetch the manifest, which carries timezone/org name/logo) → `notifyOrgChanged(id, 'orgs', id)`. `uploadOrgLogo`: `file.type ∈ LOGO_MIMES`
else 422, `file.size ≤ MAX_LOGO_BYTES` else 413; key `logoPath(id, logoExtensionForMime(file.type))`; `admin.storage.from('logos').upload(key, file,
{ upsert: true, contentType: file.type })`; `logo_url = publicUrl('logos', key) + '?v=' + Date.now()`.

### 5.23 `lib/pairing.ts` ★ (G, server-only — node:crypto)
```ts
export { PAIRING_CODE_ALPHABET, PAIRING_CODE_LENGTH, PAIRING_CODE_TTL_MS } from '@/types/api'   // re-export; validators/UI import from types/api
export function generatePairingCode(): string                 // 6 chars, crypto.randomInt per char
export function generateDeviceToken(): string                 // randomBytes(48).toString('base64url')
export function hashDeviceToken(token: string): string        // createHash('sha256').update(token).digest('hex')
export async function createPairingCode(admin: DbClient, fingerprint: string): Promise<PairingCodeResponse>   // mints code + token; stores { code, device_fingerprint, device_token_hash }; retry up to 5× on 23505 (code collision); expires_at = now + TTL
export async function getPairingStatus(admin: DbClient, code: string, fingerprint: string): Promise<PairingStatusResponse>  // ApiError(404, 'Code not found') when unusable
```
Decision §0.13: `createPairingCode` generates `token = generateDeviceToken()`, inserts `device_token_hash = hashDeviceToken(token)` and returns
`{ code, expires_at, device_token: token }` — the only time the raw token leaves the server, and it is never stored. `getPairingStatus`: select by
code → none → 404; `device_fingerprint !== fingerprint` → 404 (another device cannot even learn the screen id); `claimed_screen_id` null →
`expires_at` passed ? 404 : `{ claimed: false, expires_at }`; claimed → `{ claimed: true, screen_id: claimed_screen_id }` (repeatable, carries no
secret; the row disappears when cron deletes it after its extended `expires_at`).

### 5.24 `lib/device-auth.ts` and `lib/heartbeat.ts` (G)
```ts
// device-auth.ts
export async function authenticateDevice(request: Request, admin?: DbClient): Promise<Screen>  // Bearer token → hash → screens.device_token_hash; missing/unknown/nulled → ApiError(401)
export function getRequestIp(request: Request): string | null                                   // x-forwarded-for first hop → x-real-ip → null
// heartbeat.ts
export async function recordHeartbeat(admin: DbClient, screen: Screen, input: HeartbeatRequest, request: Request, now?: Date): Promise<HeartbeatResponse>
```
`recordHeartbeat` (a heartbeat must never fail because of the device's data):
1. `wasOnline = isOnline(screen.last_seen_at, now)`.
2. Resolve `current_item_id`: null unless `input.current_item_id` exists in the effective playlist —
   `effective = getEffectivePlaylistId(admin, screen)`; if `effective === null` or `input.current_item_id === null` → `current_item_id = null` and
   skip the lookup (never pass `null` to `.eq`, it is a 22P02); else `admin.from('playlist_items').select('id').eq('id', input.current_item_id)
   .eq('playlist_id', effective).maybeSingle()` — any lookup error is treated as "not found" (null), never thrown.
3. Update `screens` `{ last_seen_at: now, last_ip: getRequestIp(request), user_agent: header (≤ 500 chars), resolution: input.resolution ?? screen.resolution,
   current_item_id }` `.eq('id', screen.id).select('playlist_version').single()`. If the update fails with code `23503` (item deleted between
   2 and 3) retry once with `current_item_id: null`.
4. Events (best effort): if `!wasOnline`: when `screen.last_seen_at !== null` and `lastScreenStatusEvent(admin, id) !== 'screen_offline'`
   → `logEvent screen_offline { last_seen_at: screen.last_seen_at }` (retroactive, decision §0.5); then `logEvent screen_online { last_seen_at: now }`.
5. `broadcastScreenStatus(org_id, { screen_id, last_seen_at: now, current_item_id, online: true })` (best effort).
6. Return `{ playlist_version }` from the updated row (the DB value, not the client's) — even when 4/5 logged errors.

### 5.25 `lib/manifest.ts` (G)
```ts
export function resolveDuration(item: PlaylistItem, content: Content | null): number  // override ?? (video ? ceil(content.duration_seconds) : null) ?? 10
export async function buildManifest(admin: DbClient, screen: Screen): Promise<Manifest>
```
`buildManifest`: org (name, logo_url, timezone) → `getEffectivePlaylistId` → items with `content(*)`/`websites(*)` ordered by position → drop items whose
target is missing or whose content `expires_at < now` → `createMediaSignedUrls(admin, paths, DEVICE_SIGNED_URL_TTL_SECONDS)` → drop (and `console.warn`)
media items whose `storage_path` has no entry in the map → map to `ManifestItem` (`type = content.type | 'website'`, `url` = signed URL | website.url,
`thumb = publicThumbUrl`, `refresh_seconds` = website value | 0, `expires_at = content.expires_at | null`, `schedule` = the five columns).
`rotation` cast via `isRotation` (fallback 0). `generated_at = now`. Schedules are NOT evaluated server side.

### 5.26 `lib/cron.ts` (G)
```ts
export function requireCronSecret(request: Request): void        // Authorization: Bearer {CRON_SECRET}; throws ApiError(401); the only reader of CRON_SECRET
export async function runCronTick(admin: DbClient, now?: Date): Promise<CronTickResponse>
```
`requireCronSecret` fails closed: `process.env.CRON_SECRET` empty/undefined → `ApiError(500, 'CRON_SECRET is not configured')` (never accept
`"Bearer "` + empty); otherwise compare the Bearer value with `crypto.timingSafeEqual` on `Buffer`s of equal length (unequal length → 401),
else `ApiError(401, 'Unauthorized')`.
`runCronTick`: 1) for every screen with `last_seen_at not null`: `online = isOnline(last_seen_at, now)`; `last = lastScreenStatusEvent(admin, id)`;
offline now and last ∈ (screen_online, screen_paired) → insert `screen_offline { last_seen_at }`; online now and last = `screen_offline` → insert
`screen_online { last_seen_at }` (covers a heartbeat whose event insert failed). 2) `select distinct playlist_id from playlist_items` joined with
`content!inner(expires_at)` where `content.expires_at ∈ (now − 10 min, now]` → `touchPlaylist(admin, id)` for each (players drop the expired item
without an edit; the 10-minute window overlaps ticks, and touching twice is harmless) → `playlists_touched`. 3) `delete pairing_codes where
expires_at < now` → `codes_deleted` (claimed codes were extended by 15 min at claim time, §5.19).

### 5.27 `lib/validators/*` — exported zod schemas and `type XInput = z.infer<…>`
- `common.ts` ★: `uuidSchema`, `nameSchema` (`trim().min(1).max(120)`), `searchSchema` (`trim().max(200).optional()`), `sortDirSchema` (`z.enum(SORT_DIRS)`),
  `flagSchema` (`'1' | 'true'` → `boolean`, absent → `false`), `timezoneSchema` (string validated with `Intl.DateTimeFormat`), `optionalUuidOr(literal)`.
- `content.ts`: `contentListQuerySchema` (→ `ContentListQuery`, `sort` default `'newest'`), `contentCreateSchema` → `ContentCreateInput`
  `{ id: uuid, name: nameSchema, type: 'image'|'video', storage_path, thumb_path: string|null, mime: ACCEPTED_MIMES, size_bytes: int 0..MAX, width: int|null,
  height: int|null, duration_seconds: number|null, folder_id: uuid|null (default null) }`, `contentUpdateSchema` → `ContentUpdateInput`
  `{ name?, folder_id?: uuid|null, expires_at?: iso datetime|null }` (at least one key), `contentUrlQuerySchema` → `{ download: boolean }` (`flagSchema`).
- `folders.ts`: `folderListQuerySchema`, `folderInputSchema` → `FolderInput { name }`.
- `uploads.ts`: `uploadSignSchema` → `UploadSignInput { name: nameSchema, mime: ACCEPTED_MIMES, size_bytes: int 1..MAX }`.
- `websites.ts`: `websiteListQuerySchema` (`sort` default `'name'`), `websiteInputSchema` → `WebsiteInput { name, url: https URL ≤ 2048, refresh_seconds: z.literal(REFRESH_OPTIONS) (default 0) }`.
- `playlists.ts` ★: `playlistListQuerySchema`, `playlistItemInputSchema` → `PlaylistItemInput { id: uuid, item_type, content_id: uuid|null, website_id: uuid|null,
  duration_seconds: int 1..86400 | null, transition (default 'fade'), mute (default true), active_from: iso date|null, active_to: iso date|null,
  days_of_week: int[0..6][] | null, daily_start: iso time|null, daily_end: iso time|null }` with a refine enforcing the content/website target rule
  and `active_from <= active_to`; `savePlaylistItemsSchema = { items: PlaylistItemInput[] (max 500) }` → `SavePlaylistItemsInput`.
- `screens.ts` ★: `screenListQuerySchema` (`sort` default `'name'`), `claimScreenSchema` → `ClaimScreenInput { code: trim().toUpperCase() matching
  `^[${PAIRING_CODE_ALPHABET}]{${PAIRING_CODE_LENGTH}}$` (import both from `@/types/api`), name }`, `screenUpdateSchema` → `ScreenUpdateInput
  { name?, rotation?: z.literal(ROTATIONS), group_id?: uuid|null }` (at least one key), `screenActionSchema` → `{ action: z.enum(SCREEN_ACTIONS) }`.
- `groups.ts`: `groupListQuerySchema` (`sort` default `'name'`), `groupInputSchema` → `GroupInput { name }`, `groupScreensSchema` → `{ screen_ids: uuid[] (max 500) }`.
- `users.ts`: `inviteUserSchema` → `{ email }`.
- `orgs.ts`: `orgCreateSchema` → `OrgCreateInput { name, timezone? }`, `orgUpdateSchema` → `OrgUpdateInput { name?, timezone?, logo_url?: url|null }`, `activeOrgSchema` → `{ org_id: uuid }`.
- `device.ts`: `fingerprintSchema = z.string().trim().min(8).max(200)` (**required** — the player always has one, §10),
  `pairingCodeRequestSchema` → `{ fingerprint: fingerprintSchema }`, `pairingCodeParamSchema` (`trim().toUpperCase()` + the same
  `^[ALPHABET]{6}$` regex as `claimScreenSchema`), `pairingStatusQuerySchema` → `{ fingerprint: fingerprintSchema }`,
  `heartbeatSchema: z.ZodType<HeartbeatRequest> = z.object({ current_item_id: uuid|null (default null), resolution?: string ≤ 40,
  playlist_version: int ≥ −1, uptime_seconds?: number ≥ 0 })` — annotated with the `types/api.ts` type so a drift is a compile error;
  there is **no** `HeartbeatInput` alias (import `HeartbeatRequest`).

---

## 6. API routes

Auth column: **session** = `requireOrgContext()` (active org from cookie); **super** = `requireSuperAdmin()`; **device** = `authenticateDevice`;
**cron** = `requireCronSecret`; **none** = public. All responses use the envelope; errors: 400 bad JSON, 401 no session/token, 403 not super admin,
404 not found in org, 409 conflict, 413 too large, 422 validation (`issues`) / invalid reference, 500.

### 6.1 Admin
| Method | Path | Auth | Body / query schema | Response `data` |
|---|---|---|---|---|
| GET | `/api/orgs` | session (no org needed → `requireUser`) | — | `OrganizationView[]` |
| POST | `/api/orgs` | super | `orgCreateSchema` | `Organization` (201) |
| GET | `/api/orgs/[id]` | super | — | `OrganizationView` |
| PATCH | `/api/orgs/[id]` | super | `orgUpdateSchema` | `Organization` |
| DELETE | `/api/orgs/[id]` | super | — | `OkResponse` |
| POST | `/api/orgs/[id]/logo` | super | multipart field `file` (`file.type ∈ LOGO_MIMES` else 422; `≤ MAX_LOGO_BYTES` else 413) | `Organization` |
| POST | `/api/orgs/active` | `requireUser` | `activeOrgSchema` | `ActiveOrgResponse` (+ sets `msign_org` cookie) |
| GET | `/api/users` | super | — | `UserView[]` |
| POST | `/api/users` | super | `inviteUserSchema` | `UserView` (201) |
| DELETE | `/api/users/[id]` | super | — | `OkResponse` |
| GET | `/api/folders` | session | `folderListQuerySchema` | `FolderView[]` |
| POST | `/api/folders` | session | `folderInputSchema` | `FolderView` (201) |
| PATCH | `/api/folders/[id]` | session | `folderInputSchema` | `FolderView` |
| DELETE | `/api/folders/[id]` | session | — | `OkResponse` |
| GET | `/api/content` | session | `contentListQuerySchema` | `ContentView[]` |
| POST | `/api/content` | session | `contentCreateSchema` | `ContentView` (201) |
| GET | `/api/content/expired-count` | session | — | `CountResponse` |
| POST | `/api/content/delete-expired` | session | — | `DeletedResponse` |
| GET | `/api/content/[id]` | session | — | `ContentView` |
| PATCH | `/api/content/[id]` | session | `contentUpdateSchema` | `ContentView` |
| DELETE | `/api/content/[id]` | session | — | `OkResponse` |
| GET | `/api/content/[id]/url` | session | `contentUrlQuerySchema` (`?download=1` → attachment) | `UrlResponse` (1h signed) |
| GET | `/api/content/[id]/usage` | session | — | `UsageResponse` |
| POST | `/api/uploads/sign` | session | `uploadSignSchema` | `UploadSignResponse` |
| GET | `/api/websites` | session | `websiteListQuerySchema` | `WebsiteView[]` |
| POST | `/api/websites` | session | `websiteInputSchema` | `WebsiteView` (201) |
| GET | `/api/websites/[id]` | session | — | `WebsiteView` |
| PATCH | `/api/websites/[id]` | session | `websiteInputSchema` | `WebsiteView` |
| DELETE | `/api/websites/[id]` | session | — | `OkResponse` |
| GET | `/api/websites/[id]/usage` | session | — | `UsageResponse` |
| GET | `/api/playlists` | session | `playlistListQuerySchema` | `Playlist[]` |
| GET | `/api/playlists/[id]` | session | — | `PlaylistView` |
| PUT | `/api/playlists/[id]/items` | session | `savePlaylistItemsSchema` (full ordered list) | `PlaylistView` |
| GET | `/api/screens` | session | `screenListQuerySchema` | `ScreenView[]` |
| POST | `/api/screens/claim` | session | `claimScreenSchema` | `ScreenView` (201) |
| GET | `/api/screens/[id]` | session | — | `ScreenDetailView` |
| PATCH | `/api/screens/[id]` | session | `screenUpdateSchema` | `ScreenView` |
| DELETE | `/api/screens/[id]` | session | — | `OkResponse` |
| POST | `/api/screens/[id]/actions` | session | `screenActionSchema` | `OkResponse` |
| GET | `/api/groups` | session | `groupListQuerySchema` | `GroupView[]` |
| POST | `/api/groups` | session | `groupInputSchema` | `GroupView` (201) |
| GET | `/api/groups/[id]` | session | — | `GroupDetailView` |
| PATCH | `/api/groups/[id]` | session | `groupInputSchema` | `GroupView` |
| DELETE | `/api/groups/[id]` | session | — | `OkResponse` |
| PUT | `/api/groups/[id]/screens` | session | `groupScreensSchema` | `GroupDetailView` |

Route files: static segments (`claim`, `expired-count`, `delete-expired`, `active`) live beside `[id]` folders; Next resolves static first.

### 6.2 Device and cron
| Method | Path | Auth | Body / query | Response `data` |
|---|---|---|---|---|
| POST | `/api/device/pairing-code` | none | `pairingCodeRequestSchema` (`{ fingerprint }`, required) | `PairingCodeResponse` (201) = `{ code, expires_at, device_token }` — the raw token, exactly once (decision §0.13) |
| GET | `/api/device/pairing-status/[code]` | none | `pairingStatusQuerySchema` (`?fingerprint=`, required) | `PairingStatusResponse` = `{ claimed: false, expires_at }` \| `{ claimed: true, screen_id }`; 404 when the code is unknown/expired or the fingerprint differs |
| GET | `/api/device/manifest` | device | — | `Manifest` |
| POST | `/api/device/heartbeat` | device | `heartbeatSchema` | `HeartbeatResponse` |
| GET | `/api/cron/tick` | cron | — | `CronTickResponse` |

Heartbeat route: `screen = await authenticateDevice(request, admin)` → `input = parseBody(heartbeatSchema)` → `ok(await recordHeartbeat(admin, screen, input, request))`
(all logic in §5.24). Manifest route: `ok(await buildManifest(admin, screen))`.

### 6.3 Manifest shape (`Manifest` in `types/api.ts`)
```json
{ "screen": { "id": "…", "name": "Lobby TV", "rotation": 0, "timezone": "America/New_York" },
  "org": { "name": "MTech Demo", "logo_url": null },
  "playlist_version": 7, "generated_at": "2026-08-28T12:00:00.000Z",
  "items": [{ "id": "<playlist_item id>", "type": "image|video|website", "content_id": "…|null", "url": "https://…signed…|https://site",
              "thumb": "https://…/public/thumbs/…|null", "name": "…", "duration_seconds": 10, "transition": "fade", "mute": true,
              "refresh_seconds": 0, "expires_at": "2026-09-30T00:00:00.000Z|null",
              "schedule": { "active_from": null, "active_to": null, "days_of_week": null, "daily_start": null, "daily_end": null } }] }
```

---

## 7. Realtime

| Channel | Event | Payload | Sent by | Subscribed by |
|---|---|---|---|---|
| `screen-{screen_id}` | `sync` | `ScreenCommandPayload { at }` | `touchPlaylist`, `bumpAndSyncScreens` | player → refetch manifest |
| `screen-{screen_id}` | `reload` | `{ at }` | `sendScreenAction('reload')` | player → `location.reload()` (≥ 30 s apart) |
| `screen-{screen_id}` | `identify` | `{ at }` | `sendScreenAction('identify')` | player → `IdentifyOverlay` 10 s |
| `screen-{screen_id}` | `unpair` | `{ at }` | `deleteScreen` | player → `fetchManifest`; only a 401 wipes storage + cache → pairing screen |
| `org-{org_id}` | `status` | `ScreenStatusPayload` | heartbeat (`recordHeartbeat`) | `RealtimeBridge` → `useOrgRealtime` (statuses for lists + detail) |
| `org-{org_id}` | `changed` | `OrgChangedPayload` | every admin mutation via `notifyOrgChanged` | `RealtimeBridge` → invalidate `[table, orgId]` (`'orgs'` → `['orgs']` + `router.refresh()`) |

**Private channels everywhere** (decision §0.2): every `.channel(name, …)` call — server `broadcast`, `useOrgRealtime`, `usePlayerChannel` — passes
`CHANNEL_CONFIG` from `lib/channels.ts`. `0006_realtime.sql` lets the anon key receive on `screen-*` and org members receive on their `org-*`;
nobody but the service role can publish, so status/changed payloads cannot be forged and screens cannot be unpaired or reloaded by anon-key holders.
The residual assumption is that screen UUIDs are unguessable; the `screen-*` payloads are hint-only `{ at }` objects anyway.

Server side: `lib/broadcast.ts` (§5.8), service-role client, REST `httpSend`, no subscription. Browser side: `createBrowserClient()` (anon key +
session cookie for admins, anon key only for the player) `.channel(name, CHANNEL_CONFIG).on('broadcast', { event }, ({ payload }) => …).subscribe((status) => …)`.
realtime-js types `payload` as `any`: every handler treats it as `unknown` and narrows with `isScreenStatusPayload` / `isOrgChangedPayload` /
`isScreenCommandPayload` from `lib/channels.ts`; a payload that fails its guard is `console.warn`ed and ignored (same rule in D and H).
Call `await supabase.realtime.setAuth()` BEFORE `subscribe()`: realtime-js builds the join payload from the token it holds at that moment, and a
private-channel join without the user's JWT is refused (the admin policy needs `auth.uid()`).
**Exactly one subscription per topic per browser client**: realtime-js returns the existing channel for a repeated topic and a second `subscribe()`
throws, so the admin app subscribes to the org channel only inside `RealtimeBridge` and the player only inside `usePlayerChannel`. On `'SUBSCRIBED'`
after a `'CHANNEL_ERROR'`/`'TIMED_OUT'`/`'CLOSED'` the player refetches the manifest (reconnect). Correctness never depends on realtime: the
heartbeat's `playlist_version` mismatch forces a manifest refetch, the manifest is refreshed every 12 h regardless, and admin lists refetch on
focus / after mutations.

---

## 8. Hooks

| Hook (file) | Signature | Behavior |
|---|---|---|
| `useApp()` (`hooks/useApp.ts`) | `(): AppContextValue` where `AppContextValue = AppBootstrap & { setActiveOrg(orgId: string): Promise<void> }`; the same file exports `AppContext = createContext<AppContextValue \| null>(null)` and the `AppContextValue` type | `useContext(AppContext)`; throws if used outside `AppProvider`. `AppProvider` imports `AppContext` from `@/hooks/useApp` — never the reverse (that was the cycle AppProvider → RealtimeBridge → useApp → AppProvider). `setActiveOrg` → `POST /api/orgs/active` → `router.refresh()` |
| `useDebounce<T>(value, delayMs = 300)` | `(value: T, delayMs?: number): T` | debounced value (search inputs) |
| `useNow(intervalMs = 1000)` | `(intervalMs?: number): Date` | ticking clock for "last seen" labels and online recomputation (use 5000 for grids) |
| `useOrgRealtime(orgId)` (★ `hooks/useRealtimeScreens.ts`, D) | `(orgId: string \| null): RealtimeScreensValue` | the ONLY org-channel subscription in the admin app, called by `RealtimeBridge`: `const supabase = createBrowserClient(); await supabase.realtime.setAuth(); supabase.channel(orgChannel(orgId), CHANNEL_CONFIG)` (inside an effect with a cancelled flag); `status` (guard: `isScreenStatusPayload`) → `prev = statuses[payload.screen_id]` (the previous payload; when none, the row in the cached detail/list, if any); `statuses[screen_id] = payload`; when `prev` exists and `payload.current_item_id !== prev.current_item_id` → `queryClient.invalidateQueries({ queryKey: queryKeys.screens.detail(orgId, payload.screen_id) })` **immediately** (the "Now playing" chip on `/screens/[id]` depends on it — a directly opened detail page has no cached list) and `queryClient.invalidateQueries({ queryKey: queryKeys.screens.all(orgId) })` throttled 5 s; `changed` (guard: `isOrgChangedPayload`) → throttled 1 s per table: `'orgs'` → `queryClient.invalidateQueries({ queryKey: queryKeys.orgs.all() })` + `router.refresh()`, else `queryClient.invalidateQueries({ queryKey: [table, orgId] })`; `connected = status === 'SUBSCRIBED'`; resets `statuses` and resubscribes when `orgId` changes; `removeChannel` on unmount; null `orgId` → no subscription |
| `useRealtimeScreens()` (same file) | `(): RealtimeScreensValue` | reads `RealtimeContext` (exported from the same file, default `{ statuses: {}, connected: false }`); consumers merge with `mergeScreenStatus(screen, statuses[screen.id], now)` |
| `useUpload({ orgId, folderId, onComplete? })` (B) | `({ orgId: string; folderId: string \| null; onComplete?(c: ContentView): void }): { uploads: UploadItem[]; addFiles(files: File[]): void; cancel(id: string): void; clearFinished(): void }` with `UploadItem = { id: string; file: File; name: string; size: number; progress: number; status: 'queued' \| 'preparing' \| 'uploading' \| 'finalizing' \| 'done' \| 'error' \| 'canceled'; error?: string; content_id?: string }` | queue + state only; the per-file pipeline lives in `lib/upload-client.ts` (browser-only): validate (mime/size, toast on reject) → `POST /api/uploads/sign` with `name = file.name.slice(0, 120)` → meta + thumb via `lib/thumbs` → upload media (≤ 6 MB: a direct `XMLHttpRequest` `PUT` to `UploadSignResponse.signed_url` (already `…/storage/v1/object/upload/sign/media/{path}?token=…`) with headers `{ 'x-upsert': 'true', 'content-type': mime, 'cache-control': 'max-age=3600', apikey: NEXT_PUBLIC_SUPABASE_ANON_KEY }`, body = the `File` (raw, not FormData), `xhr.upload.onprogress` → `progress` (0–100), non-2xx → error; **never** `uploadToSignedUrl` — it is fetch-based with no progress and no abort; > 6 MB: `tus.Upload(file, { endpoint: upload_url, headers: { authorization: 'Bearer ' + session.access_token, 'x-upsert': 'true' }, uploadDataDuringCreation: true, removeFingerprintOnSuccess: true, chunkSize: 6 * 1024 * 1024, metadata: { bucketName: 'media', objectName: storage_path, contentType: mime, cacheControl: '3600' }, onProgress })`) → thumb `supabase.storage.from('thumbs').upload(thumb_path, blob, { contentType: 'image/jpeg', upsert: true })` — `supabase` is the **browser client** (`createBrowserClient()`; the session cookie satisfies the super-admin storage policy) → `POST /api/content` → invalidate `content`/`folders` → `onComplete`. A retry re-signs (new `content_id`). Max 3 concurrent uploads; `cancel(id)` calls `upload.abort()` (tus) or `xhr.abort()` (small files) and marks the item `canceled` |
| `usePlaylistAutosave({ playlistId, initialItems, onSaved? })` (E) | `({ playlistId: string; initialItems: PlaylistItemView[]; onSaved?(v: PlaylistView): void }): { items: PlaylistItemView[]; setItems(updater: (prev: PlaylistItemView[]) => PlaylistItemView[]): void; status: 'idle' \| 'dirty' \| 'saving' \| 'saved' \| 'error'; error: string \| null; flush(): Promise<void>; lastSavedAt: Date \| null }` | debounce 500 ms → `PUT /api/playlists/{id}/items` with `toPlaylistItemInput(items)`; serializes saves (dirty during a save → save again after); ignores server refetches while dirty; dirty/equality comparison uses `toPlaylistItemInput` output only (never `created_at`); `beforeunload` guard when dirty (browser navigation only); `flush()` cancels the pending debounce and saves NOW with `apiFetch(…, { keepalive: true })` (`apiFetch` forwards `init.keepalive`) so the request survives unmount — `PlaylistEditor` calls it on unmount because in-app `<Link>` navigation never fires `beforeunload`; toast on error only |
| `useHeartbeat(opts)` (H) | `({ enabled: boolean; deviceToken: string \| null; getState(): HeartbeatRequest; onVersionMismatch(serverVersion: number): void; onUnauthorized(): void; onResult?(ok: boolean): void }): { lastOkAt: Date \| null; failing: boolean }` | POST every `HEARTBEAT_INTERVAL_MS` (first beat immediately when enabled); `enabled` = paired (device state present) — the body's `playlist_version` is `-1` until a manifest exists, so the first reply always calls `onVersionMismatch` (harmless: `usePlayerManifest.refetch` coalesces); 401 → `onUnauthorized`; `serverVersion !== getState().playlist_version` → `onVersionMismatch`. **`failing` semantics** (the player's offline signal, decision §0.15): a failure = network error / timeout / HTTP ≥ 500 (**never** 401/4xx); `failing = consecutiveFailures >= 2`; after a failure the next beat is scheduled with `nextDelay(consecutiveFailures − 1)` (5 s → 60 s, `lib/player/backoff.ts`) instead of 30 s so an outage is detected and recovery noticed quickly; any 2xx resets the counter, sets `failing = false` and restores the 30 s cadence; `onResult(ok)` fires per beat |
| `usePlayerManifest(opts)` (H) | `({ deviceToken: string \| null; onUnauthorized(): void }): { manifest: Manifest \| null; status: 'idle' \| 'loading' \| 'ready' \| 'offline'; refetch(): Promise<void>; lastFetchedAt: Date \| null }` | loads `msign.manifest` from localStorage first; fetches; concurrent `refetch()` calls share one in-flight request; on failure retries with `nextDelay` backoff (5 s → 60 s) and reports `offline`; persists last good manifest; 401 → `onUnauthorized`; exports `MANIFEST_MAX_AGE_MS = 12 * 3_600_000` and refetches on a 60 s timer whenever `generated_at` is older than that and status ≠ `offline` (signed URLs last 24 h) |
| `useMediaCache(manifest, offline)` (H) | `(manifest: Manifest \| null, offline: boolean): { readyIds: Set<string>; isReady(itemId: string): boolean; srcFor(item: ManifestItem): string \| null; progress: { done: number; total: number } }` | preloads images AND videos in manifest order via `fetch` → Cache Storage under `cacheKeyFor(content_id)`, recording `bytes`; evicts keys not in the manifest; keeps object URLs for cached items ≤ `LARGE_MEDIA_BYTES` (64 MiB, `lib/player/media-cache.ts`) and, only while `offline`, for larger ones (created when `offline` flips true, revoked when false); `srcFor`: object URL when present → else the signed URL when not offline → else null (engine skips); websites always ready and `srcFor` = `item.url` |
| `usePlayerChannel(opts)` (H) | `({ screenId: string \| null; onSync(): void; onReload(): void; onIdentify(): void; onUnpair(): void; onReconnect(): void }): { connected: boolean }` | subscribes `screenChannel(screenId)` with `CHANNEL_CONFIG` (the only player subscription); payloads narrowed with `isScreenCommandPayload` (ignored otherwise); coalesces `sync`/`identify` to one per second and `reload` to one per 30 s |
| `usePlayerDevice()` (H) | `(): { device: PlayerDeviceState \| null; hydrated: boolean; save(state: PlayerDeviceState): void; clear(): void }` | localStorage `msign.device` |
| `usePlayerPairing(opts)` (H) | `({ enabled: boolean; fingerprint: string \| null; onPaired(state: PlayerDeviceState): void }): { code: string \| null; expiresAt: string \| null; error: string \| null }` | the whole unpaired flow (§10): resumes `msign.pending` when its `expires_at` is in the future, else `requestPairingCode(fingerprint)` → persists `PendingPairingState { code, device_token, expires_at }`; polls `pollPairingStatus(code, fingerprint)` every 3 s; `{ claimed: true, screen_id }` → `onPaired({ device_token: pending.device_token, screen_id })` + clears `msign.pending`; 404 → discard pending and request a new code; other errors → keep polling with `nextDelay` backoff (max 60 s); `enabled=false` stops everything |

React Query usage (all admin lists):
```ts
const { org } = useApp()
const q = useQuery({ queryKey: queryKeys.screens.list(org.id, params), queryFn: () => apiFetch<ScreenView[]>(`/api/screens${buildQuery(params)}`) })
const m = useMutation({ mutationFn: (input: ScreenUpdateInput) => apiFetch<ScreenView>(`/api/screens/${id}`, { method: 'PATCH', json: input }),
  onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.screens.all(org.id) }); toast.success('Screen updated') },
  onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong') })
```

---

## 9. Components (props are exact; add internal sub-components freely, one per file)

### 9.1 Shell (`components/shell/*`, slice A, ★)
- `AppProvider({ value: AppBootstrap; children })` — client; mounts `QueryClientProvider` (one `QueryClient` in `useState`, `staleTime 10_000`, `retry 1`),
  `ThemeProvider` (`attribute="class" defaultTheme="dark" enableSystem={false}`), `TooltipProvider`, `Toaster`, `<AppContext.Provider>` (with
  `AppContext` imported from `@/hooks/useApp`, which owns the context object and the `AppContextValue` type — `AppProvider` exports only the
  component, so no module cycle exists), and `RealtimeBridge` (inside both providers).
- `RealtimeBridge({ children })` — client: `const value = useOrgRealtime(useApp().org?.id ?? null)`; renders `<RealtimeContext.Provider value={value}>`.
  Mounted once; every admin page gets `changed` invalidation for free and reads statuses via `useRealtimeScreens()`.
- `Navbar()` — reads `useApp()`; renders wordmark, `NavTabs`, `OrgSwitcher`, `AdminMenu`, `ThemeToggle`, `UserAvatar`.
- `NavTabs()` — links Content `/content`, Screens `/screens`, Groups `/groups`, Websites `/websites`; active by `usePathname().startsWith`.
- `OrgSwitcher()` — dropdown of `orgs` + "New organization" (opens `OrgDialog`); selecting calls `setActiveOrg`.
- `AdminMenu()` — Users `/admin/users`, Organizations `/admin/orgs`, Settings `/admin/settings`, Log out (`createBrowserClient().auth.signOut()` → `router.replace('/login')`).
- `ThemeToggle()`, `UserAvatar({ name: string | null; email: string })`.
- `PageHeader({ title: string; description?: string; primary?: ReactNode; menu?: ReactNode; children?: ReactNode })` — title + primary outline button + kebab menu slot; `children` renders the toolbar row.
- `ListToolbar({ search: string; onSearchChange(v: string): void; sort: { value: string; options: { value: string; label: string }[]; onChange(v: string): void }; filters?: ReactNode; activeFilterCount?: number })` — Sort dropdown, Filters popover, Search input (debounced 300 ms internally). No direction control (`dir` is API-only).
- `KebabMenu({ items: KebabItem[]; align?: 'start' | 'end'; label?: string })` with `KebabItem = { label: string; icon?: ReactNode; onSelect(): void; destructive?: boolean; disabled?: boolean; separatorBefore?: boolean }`.
- `ConfirmDialog({ open: boolean; onOpenChange(open: boolean): void; title: string; description?: ReactNode; confirmLabel?: string; destructive?: boolean; confirmText?: string; loading?: boolean; onConfirm(): void | Promise<void> })` — `confirmText` = the string the user must type (org delete).
- `RenameDialog({ open; onOpenChange; title: string; label?: string; initialValue: string; onSubmit(value: string): Promise<void> })`.
- `EmptyState({ icon?: ReactNode; illustration?: ReactNode; title: string; description?: string; action?: ReactNode })`.
- `NoOrgState()` — "Create an organization to get started" → `/admin/orgs`. Every org page renders it when `useApp().org` is null.
- `StatusPill({ status: ScreenPresence; size?: 'sm' | 'md'; className?: string })` — `online` green dot "Online", `offline` red dot "Offline",
  `unpaired` grey (`muted-foreground`) dot "Not paired"; callers pass `screenStatus(view)` (§5.10), never a raw boolean.
- `PageContainer({ children; className? })` — `mx-auto max-w-7xl px-6 py-6`.
- `components/auth/LoginForm()` — reads `useSearchParams()`: on success `router.replace(next.startsWith('/') && !next.startsWith('//') ? next : '/screens')`;
  when `error=invalid_link` shows "This invite link is invalid or has expired." above the form. `components/auth/SetPasswordForm()`.
  **`app/(auth)/login/page.tsx` renders `<Suspense fallback={null}><LoginForm /></Suspense>`** (`import { Suspense } from 'react'`) — the page is
  statically prerendered and Next 15 aborts `next build` on an unwrapped `useSearchParams()` ("missing-suspense-with-csr-bailout"); apply the same
  wrapper to `/set-password` and any other `(auth)` page that reads search params.
- `components/admin/*`: `UsersTable({ users: UserView[]; currentUserId: string; onRemove(u: UserView): void })`, `InviteUserDialog({ open; onOpenChange })`,
  `OrgsTable({ orgs: OrganizationView[]; activeOrgId: string | null; onOpen(o): void; onRename(o): void; onDelete(o): void })`,
  `OrgDialog({ open; onOpenChange; org?: Organization })` (create/rename), `DeleteOrgDialog({ org: OrganizationView | null; onOpenChange(open: boolean): void })`,
  `SettingsForm({ org: Organization })` (PATCH → toast → `router.refresh()` so the navbar/org name and `AppBootstrap.org` update),
  `LogoUpload({ org: Organization })` (`accept` = `LOGO_MIMES`, client-side size check against `MAX_LOGO_BYTES`, `router.refresh()` on success),
  `TimezoneSelect({ value: string; onChange(v: string): void })` (`Intl.supportedValuesOf('timeZone')` with a curated fallback list).
- Page components (client, own the state): `components/admin/UsersPage()`, `OrgsPage()`, `SettingsPage()`.

### 9.2 Content (`components/content/*`, slice B)
- `ContentLibrary()` — page component: toolbar state (`ContentListQuery`), folder navigation, queries, dialogs, `UploadDropzone`. **Single source of
  truth = the `folder` URL search param**: absent → root view = `folder_id: 'root'` (unfiled files) plus `FolderView[]` cards first; `folder=<uuid>` →
  `folder_id: <uuid>`, no folder cards, `ContentBreadcrumb`; `folder=all` → `folder_id` undefined (whole org), no folder cards. Selecting a folder in
  `ContentFilters` navigates (sets the param) — there is no separate filter state for folders. **Search from the root view searches the whole org**:
  when the debounced `q` is non-empty and no `folder` param is set, send `folder_id` undefined, hide the folder cards and show
  `ContentView.folder_name` as a caption on each card (a file just moved into a folder must be findable, acceptance #3); clearing the search
  restores the root view. Inside a folder (`folder=<uuid>`) search stays scoped to that folder.
- `ContentGrid({ folders: FolderView[]; items: ContentView[]; onOpenFolder(f: FolderView): void; onFolderAction(action: 'rename' | 'delete', f: FolderView): void; onItemAction(action: ContentCardAction, item: ContentView): void })`.
- `ContentCard({ item: ContentView; onAction(action: ContentCardAction): void })`; **`ContentCardAction` is exported from `components/content/ContentCard.tsx`**
  (`'rename' | 'move' | 'expiration' | 'preview' | 'download' | 'delete'`) and imported by `ContentGrid`/`ContentLibrary`. Shows the red **Expired** badge
  when `item.expired`, else "Expires {dateInZone(item.expires_at, org.timezone)}" when an expiration is set (§5.11 rule).
  `download` → `GET /api/content/{id}/url?download=1` → click a hidden `<a href={url} download={item.name}>` (the signed URL carries the attachment disposition).
- `FolderCard({ folder: FolderView; onOpen(): void; onRename(): void; onDelete(): void })`.
- `UploadDropzone({ onFiles(files: File[]): void; disabled?: boolean; children: ReactNode })` — wraps the page; full-page overlay while dragging; `accept` = ACCEPTED_MIMES.
- `UploadProgress({ uploads: UploadItem[]; onCancel(id: string): void; onClear(): void })` — bottom-right panel (`UploadItem` is exported by `hooks/useUpload.ts`, §8 — the only definition).
- `ExpirationDialog({ item: ContentView | null; onOpenChange(open: boolean): void })` — `Calendar` (`mode="single"`) + Clear. Pre-selects
  `item.expires_at ? fromDateString(dateInZone(item.expires_at, org.timezone)) : undefined`; Save submits `PATCH { expires_at: endOfDayInZone(toDateString(picked), org.timezone) }`
  (end of that calendar day in the org zone — §5.11), Clear submits `{ expires_at: null }`. `org` from `useApp()`.
- `MoveDialog({ item: ContentView | null; folders: FolderView[]; onOpenChange(open: boolean): void })`.
- `PreviewModal({ item: ContentView | null; onClose(): void })` — fetches `/api/content/{id}/url`; `<video controls autoPlay>` for videos.
- `DeleteContentDialog({ item: ContentView | null; onOpenChange(open: boolean): void })` — loads usage, lists screens/groups, confirms.
- `DeleteExpiredDialog({ open; onOpenChange })` — shows `/api/content/expired-count`.
- `NewFolderDialog({ open; onOpenChange; onCreated?(f: FolderView): void })`, `ContentBreadcrumb({ folder: FolderView | null; onRoot(): void })`,
  `ContentFilters({ value: ContentListQuery; folders: FolderView[]; onChange(next: ContentListQuery): void })` — type, folder (All folders / Unfiled / each folder), expired only.

### 9.3 Websites (`components/websites/*`, slice C)
- `WebsiteLibrary()` page component; `WebsiteCard({ website: WebsiteView; onAction(action: 'edit' | 'preview' | 'open' | 'delete'): void })`;
  `WebsiteDialog({ open; onOpenChange; website?: WebsiteView })`; `WebsitePreviewModal({ website: WebsiteView | null; onClose(): void })` (sandboxed iframe);
  `DeleteWebsiteDialog({ website: WebsiteView | null; onOpenChange(open: boolean): void })`; `IframeNotice()` (helper text about X-Frame-Options/CSP);
  `WebsitesEmptyState({ onCreate(): void })` — exact copy: "Websites are just as easy to display on your screens as images and videos. Simply add a
  website here, then drag it into the playlist of any screen." + **Add Website**.

### 9.4 Screens (`components/screens/*`, slice D)
- `ScreensBoard()` page component (list + `useRealtimeScreens()` merge + dialogs); `ScreenDetail({ id: string })` page component for `/screens/[id]`.
- `ScreenGrid({ screens: ScreenView[]; now: Date; onAction(action: ScreenCardAction, screen: ScreenView): void })`.
- `ScreenCard({ screen: ScreenView; now: Date; onAction(action: ScreenCardAction): void })`; **`ScreenCardAction` is exported from `components/screens/ScreenCard.tsx`**
  (`'open' | 'rename' | 'rotation' | 'identify' | 'reload' | 'group' | 'ungroup' | 'delete'`) and imported by `ScreenGrid`/`ScreensBoard`. `status = screenStatus(screen)`;
  the last-seen line reads "Last seen {relativeTime(last_seen_at, now)}" when paired and **"Never paired"** when `status === 'unpaired'` (the seeded
  placeholder screens); Identify/Reload are disabled while unpaired.
- `TvFrame({ thumbUrl: string | null; status: ScreenPresence; rotation?: number; websiteUrl?: string | null; children?: ReactNode })` — TV mockup,
  gradient fallback, `StatusPill` on the frame; when `thumbUrl` is null and `websiteUrl` is set, renders the browser-frame placeholder with
  `<img src={faviconUrl(websiteUrl)}>` (website items have no thumb).
- `PairDialog({ open; onOpenChange; onPaired?(screen: ScreenView): void })` — code input (6, auto-uppercase, `PAIRING_CODE_ALPHABET`) + name; shows
  "Pairing into {org.name}" (read-only; decision §0.4); `POST /api/screens/claim`.
- `RotationDialog({ screen: ScreenView | null; onOpenChange(open: boolean): void })` — `RotationSelect` + Save → `PATCH { rotation }` (the card's 'rotation' action).
- `ScreenHeader({ screen: ScreenDetailView; groups: GroupView[]; now: Date })` — inline rename, `StatusPill`, last seen, `DeviceInfo`, `RotationSelect`, `GroupSelect`, Identify/Reload buttons, `NowPlayingChip`.
- `DeviceInfo({ screen: ScreenView })`, `NowPlayingChip({ item: CurrentItemView | null; online: boolean })` — `ScreenDetail` passes
  `mergeScreenStatus(detail, statuses[id], now).current_item` (the merged view; the `CurrentItemView` itself refreshes through the immediate detail
  invalidation in `useOrgRealtime`, §8) and renders a favicon via `faviconUrl(item.website_url)` for website items,
  `RotationSelect({ value: number; onChange(v: Rotation): void; disabled? })`, `GroupSelect({ value: string | null; groups: GroupView[]; onChange(v: string | null): void })`,
  `ScreenFilters({ value: ScreenListQuery; groups: GroupView[]; onChange(next: ScreenListQuery): void })`, `DeleteScreenDialog({ screen: ScreenView | null; onOpenChange(open: boolean): void })`,
  `MoveToGroupDialog({ screen: ScreenView | null; groups: GroupView[]; onOpenChange(open: boolean): void })`.
- `ScreenDetail` renders `PlaylistEditor` for `screen.playlist` (with `GroupBanner` when grouped); when `playlist` is null it shows an inline
  "This screen has no playlist" `EmptyState` (cannot normally happen: `getScreenDetail` self-heals).

### 9.5 Playlist editor (`components/playlist/*`, slice E)
- `PlaylistEditor({ playlistId: string; initial: PlaylistView; banner?: ReactNode; onSaved?(v: PlaylistView): void })` — two panes, one `DndContext`:
  library cards are `useDraggable` with id `lib:{content|website}:{id}`, the right pane is `useDroppable` id `playlist-drop`, rows are `useSortable`
  with id `row:{item_id}` inside `SortableContext(verticalListSortingStrategy)`; drop from library → append; row reorder → `arrayMove`.
  Owns the `usePlaylistAutosave` instance and flushes it on unmount: `useEffect(() => () => { void flush() }, [])` (in-app navigation within the
  500 ms debounce must not lose an edit — acceptance #5).
- `PlaylistRow({ item: PlaylistItemView; onChange(patch: Partial<PlaylistItemInput>): void; onRemove(): void })` — thumb (browser-frame placeholder +
  `faviconUrl(item.website_url)` for websites), name, red **Expired** badge when `item.expired` (tooltip "Expired content is not shown on screens"),
  `DurationInput`, `TransitionSelect`, mute `Switch` (videos only), `SchedulePopover`, remove.
- `LibraryPanel({ orgId: string; onAdd(pick: LibraryPick): void })`; tabs Content | Websites, search (debounced), uses `queryKeys.content.list`
  (`{ sort: 'newest', expired: false, q }` — `folder_id` undefined, whole org) / `queryKeys.websites.list`. Expired content IS listed (with its red
  Expired badge) but `LibraryCard.onAdd` is disabled, the card is not draggable, and a tooltip says "Expired content is not shown on screens".
- `LibraryCard({ pick: LibraryPick; onAdd(): void; disabled?: boolean })`, `SchedulePopover({ value: ManifestSchedule; onChange(v: ManifestSchedule): void })`
  (two `Calendar`s or a range picker: `active_from/active_to` = `toDateString(date)`, pre-selected with `fromDateString(value)` — §5.7, never `toISOString`;
  days-of-week checkboxes 0–6; `daily_start/daily_end` `<input type="time">` → `HH:MM`),
  `DurationInput({ value: number | null; placeholder: number; onChange(v: number | null): void })`, `TransitionSelect({ value: TransitionType; onChange(v: TransitionType): void })`,
  `GroupBanner({ groupName: string; groupId: string })` (purple banner "This screen plays group '{name}'"), `SaveStatus({ status; lastSavedAt })`
  ("Unsaved changes" while `dirty`, "Saving…", "Saved {relativeTime}", "Save failed").
- Client helpers in `components/playlist/playlist-utils.ts` (slice E, no React) — **the exporting module for the shared editor types**:
  `export type LibraryPick = { kind: 'content'; content: ContentView } | { kind: 'website'; website: WebsiteView }` (imported by `LibraryPanel`,
  `LibraryCard`, `PlaylistEditor`), `toPlaylistItemInput(items: PlaylistItemView[]): PlaylistItemInput[]`,
  `newItemFromPick(pick: LibraryPick, playlistId: string, position: number): PlaylistItemView` (id = `crypto.randomUUID()` (admin = secure context),
  `playlist_id = playlistId`, `created_at = new Date().toISOString()` (placeholder, replaced by the server row after save), defaults transition 'fade',
  mute true, `duration_seconds` null, schedule fields null, view fields from the pick — `thumb_url` null and `website_url` set for websites).

### 9.6 Groups (`components/groups/*`, slice F)
- `GroupsBoard()` page component; `GroupEditor({ id: string })` page component for `/groups/[id]` (PlaylistEditor + `GroupScreensPanel`).
- `GroupCard({ group: GroupView; onAction(action: 'edit' | 'rename' | 'screens' | 'delete'): void })` — name, screen count, online/offline dots.
- `GroupScreensPanel({ group: GroupDetailView; screens: ScreenView[]; onChange(screenIds: string[]): void; saving?: boolean })` — checklist of ALL org
  screens (`screens` = `GET /api/screens`, merged with `useRealtimeScreens()`); checked = `group.screens` ids.
- `GroupDialog({ open; onOpenChange; group?: GroupView; onCreated?(g: GroupView): void })`, `ManageScreensDialog({ group: GroupView | null; onOpenChange(open: boolean): void })`,
  `DeleteGroupDialog({ group: GroupView | null; onOpenChange(open: boolean): void })`, `GroupsEmptyState({ onCreate(): void })` (spec copy) —
  renders `<EmptyState illustration={<img src="/illustrations/groups.svg" alt="" className="h-40 w-auto" />} …>` (the file is slice A's
  `public/illustrations/groups.svg`, §1.1).

### 9.7 Player (`components/player/*`, slice H)
- `PlayerApp()` — root client component rendered by `app/player/page.tsx`; owns the state machine (§10).
- `PairingScreen({ code: string | null; expiresAt: string | null; appUrl: string; error?: string | null })` — MSIGN wordmark (`<img src="/msign.svg">`,
  slice A's single wordmark file), huge code, "Enter this code at {appUrl} → Screens → Add Screen". No org logo here (decision §0.3).
- `PlaybackEngine({ manifest: Manifest; cache: ReturnType<typeof useMediaCache>; offline: boolean; timeZone: string; onCurrentItem(itemId: string | null): void })`
  — `offline` is the derived signal from §10 (`heartbeat.failing || manifest.status === 'offline'`); while true, website items are skipped and media
  plays only from the cache.
- `MediaLayer({ item: ManifestItem | null; src: string | null; active: boolean; onEnded(): void; onError(): void })` — `<img>` or `<video muted={item.mute} playsInline autoPlay>`.
- `WebsiteLayer({ item: ManifestItem | null; active: boolean })` — `<iframe sandbox="allow-scripts allow-same-origin">`, reload timer per `refresh_seconds`.
- `StandbyScreen({ orgName: string; logoUrl: string | null })` — logo + clock. `IdentifyOverlay({ name: string; visible: boolean })`.
- `RotationRoot({ rotation: Rotation; children })` — CSS transform, swaps width/height for 90/270. `KeepAwake()` — `navigator.wakeLock` when available
  (re-request on `visibilitychange`), else a hidden muted `<video playsInline autoPlay loop>` whose `srcObject` is a `canvas.captureStream(1)`
  MediaStream (a 2×2 canvas repainted once per second; no media file on disk; any error in the fallback must be silent — never let keep-awake break playback).
- `CursorHider()` (3 s idle), `FullscreenPrompt()` (request fullscreen on first tap when `!document.fullscreenElement`), `PlayerErrorBoundary` (class component; reload after 10 s).

---

## 10. Player runtime contract

State machine (`PlayerApp`): `boot` → (`msign.device` missing) `unpaired` | (present) `paired`.
- `unpaired` (`usePlayerPairing`, §8): fingerprint = `newId()` persisted at `msign.fingerprint` (created once, reused forever) →
  `POST /api/device/pairing-code { fingerprint }` → `{ code, expires_at, device_token }` persisted as `msign.pending` (decision §0.13: the device
  holds the raw token from now on) → show code → poll `GET /api/device/pairing-status/{code}?fingerprint={fingerprint}` every 3 s →
  `{ claimed: true, screen_id }` → `save({ device_token: pending.device_token, screen_id })`, remove `msign.pending` → `paired`; 404 (unknown /
  expired) → drop pending and request a new code (the displayed `expires_at` countdown is informational; the server decides). A reload during
  pairing resumes the pending code instead of minting a new one.
- `paired` → `loading`: cached `msign.manifest` (if any) renders immediately; `usePlayerManifest` fetches fresh → `ready`; `useHeartbeat` starts
  (`enabled` = paired); `usePlayerChannel` subscribes. `playing` when ≥ 1 active item is ready in the cache; `standby` when the active list is
  empty (or nothing is playable offline). Websites are skipped while `offline`.
- **`offline`** (decision §0.15): `offline = heartbeat.failing || manifest.status === 'offline'`, computed in `PlayerApp` and passed to BOTH
  `useMediaCache(manifest, offline)` and `PlaybackEngine`. `heartbeat.failing` = 2 consecutive heartbeat failures (network error / HTTP ≥ 500 —
  never 401, §8), cleared by the next 2xx. When `failing` flips true → false, call `manifest.refetch()` once (the outage may have hidden a `sync`).
- **Unpair**: on the `unpair` event call `fetchManifest(token)`; **only a 401** (also the existing 401 path from manifest/heartbeat) → `clear()` device +
  manifest, `caches.delete('msign-media-v1')` → `unpaired`. Any other outcome → log and keep playing (the message was stale or forged).
- Playback loop: active items = `manifest.items.filter(i => isItemActive(i.schedule, now, manifest.screen.timezone) && !(i.expires_at && new Date(i.expires_at) <= now))`
  re-evaluated on every advance and every 30 s; images/websites advance after `duration_seconds`; videos advance on `ended` with a `duration_seconds + 1 s`
  safety timer (an override shorter than the file cuts early); media error → skip; `fade` = 300 ms opacity crossfade between two stacked layers (next item
  pre-mounted in the inactive layer), `none` = instant swap. Manifest replaced → keep playing, recompute list, continue from the same item id if present.
- Storage keys: `msign.device` = `PlayerDeviceState` JSON, `msign.manifest` = last good `Manifest` JSON, `msign.fingerprint` = string,
  `msign.pending` = `PendingPairingState` JSON (only while unpaired). Unpair wipes `msign.device`, `msign.manifest` and `msign.pending`;
  `msign.fingerprint` is created once and never wiped.
- Cache: Cache Storage bucket `msign-media-v1`; key `/__msign/media/{content_id}` (never the signed URL, which rotates); `cacheMedia` fetches
  the signed URL and `cache.put(key, response)` for images and videos alike; `evictExcept(contentIds)` after each manifest; object URLs per §8
  `useMediaCache` (large videos play from the signed URL while online; object URLs are revoked when an item leaves the current/next slot or the
  cache evicts it); no Cache API (insecure context) → play from signed URLs directly.
- Backoff (`lib/player/backoff.ts`): `nextDelay(attempt) = min(5000 * 2 ** attempt, 60000)`; reset on success. No error UI on the TV; log to console.
- Heartbeat body (`HeartbeatRequest`): `{ current_item_id, resolution: `${window.screen.width}x${window.screen.height}`, playlist_version: manifest?.playlist_version ?? -1, uptime_seconds }`;
  mismatch → refetch manifest.
- `lib/player/device-api.ts`: `requestPairingCode(fingerprint): Promise<PairingCodeResponse>`, `pollPairingStatus(code, fingerprint): Promise<PairingStatusResponse>`,
  `fetchManifest(token)`, `sendHeartbeat(token, body: HeartbeatRequest)`, each throwing `DeviceApiError { status }` (`status: 0` for network errors).
  `lib/player/media-cache.ts`: `CACHE_NAME`, `LARGE_MEDIA_BYTES`, `cacheKeyFor(contentId)`, `openCache()`, `cacheMedia(item)` (→ bytes),
  `getCachedBlobUrl(contentId)`, `evictExcept(contentIds)`. `lib/player/player-storage.ts`: `DEVICE_KEY`, `MANIFEST_KEY`, `FINGERPRINT_KEY`, `PENDING_KEY`,
  `readJson<T>(key)`, `writeJson(key, value)`, `remove(key)`, and **`newId(): string`** = `globalThis.crypto?.randomUUID?.()` when defined, else a v4-shaped
  uuid built from `crypto.getRandomValues(new Uint8Array(16))` (available in insecure contexts), else a `Math.random` fallback — `crypto.randomUUID` is
  secure-context-only and is undefined on `http://<lan-ip>:3000/player` (TV testing), so the player never calls it directly. Admin code may keep
  using `crypto.randomUUID()` (localhost/https are secure contexts).
- `app/player/layout.tsx`: black full-screen container, `<meta name="viewport">` default, no navbar; the page is `'use client'`-free and just renders `<PlayerApp />`.

---

## 11. Seed script contract (`scripts/seed.ts`, slice I) — run with `pnpm seed`

- Loads env with `dotenv` (`config({ path: '.env.local' })` then `config()`); requires `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`; uses `createClient<Database>` from `@supabase/supabase-js` with the service role (import `Database`
  relatively — `../types/db` — the `types/*` files only use relative imports among themselves).
- Idempotent (safe to re-run): 1) user by email (`auth.admin.listUsers` → find, else `createUser({ email, password, email_confirm: true })`);
  upsert `profiles { id, full_name: 'MTech Admin', is_super_admin: true }`. 2) org `{ name: 'MTech Demo', slug: 'mtech-demo', timezone: 'America/New_York' }`
  by slug; membership `owner`. 3) folder `Promotions` by (org, name). 4) three 1280×720 placeholder PNGs (`Placeholder Purple.png`, `Placeholder Teal.png`,
  `Placeholder Amber.png`) generated in-process (see below), uploaded with `upsert: true` to `media/{org}/{id}.png` and a 320×180 version to
  `thumbs/{org}/{id}-thumb.png` (seed thumbs may be PNG; `thumb_path` is opaque to consumers), rows in `content` with real `size_bytes`, `width`, `height`,
  `mime 'image/png'`, `created_by` = admin, `folder_id` = null. 5) website `MTech Distributors` → `https://mtechdistributors.com`, `refresh_seconds 0`.
  6) screens `Demo TV Left` and `Demo TV Right`, each with its own playlist (`kind 'screen'`, name = screen name, same org — the same-org and
  playlist-kind triggers reject anything else; one playlist per screen — `screens.playlist_id` is unique), unpaired (`device_token_hash null` →
  they render as "Not paired" / "Never paired"). Seeded content has `expires_at null`; if the seed ever sets one it must use the §5.11 rule
  (end of the chosen day in the org timezone), which the README (slice I) also documents for admins. Lookups by (org_id, name); nothing is
  duplicated on re-run. Prints a summary and exits 0; exits 1 with the error on failure.
- PNG generation without extra deps: RGBA scanlines with filter byte 0 → `zlib.deflateSync` → chunks `IHDR`, `IDAT`, `IEND` with CRC32
  (`zlib.crc32` exists on Node ≥ 22.2 — the local Node is v24; keep a 12-line table fallback for older Node). Solid fill plus a lighter diagonal band so the three
  files differ.

---

## 12. Acceptance checklist mapping

| # | Spec item | Implemented by |
|---|---|---|
| 1 | Log in as seeded super admin | `scripts/seed.ts`; `LoginForm`, `middleware.ts`, `lib/supabase/*`, `(admin)/layout.tsx` + `AppProvider` |
| 2 | Upload jpg + mp4 → thumbs, sizes, durations | `useUpload` + `lib/upload-client.ts`, `lib/thumbs.ts`, `POST /api/uploads/sign`, `POST /api/content`, storage policies, `ContentCard` |
| 3 | Folders, move, rename, search/sort/filters | `/api/folders/*`, `PATCH /api/content/[id]`, `contentListQuerySchema`, `ListToolbar`, `ContentFilters` (+ `folder` URL param), `MoveDialog`, `RenameDialog` |
| 4 | Expiration → badge → delete expired | `ExpirationDialog`, `toContentView.expired`, `GET /api/content/expired-count`, `POST /api/content/delete-expired`, `DeleteExpiredDialog` |
| 5 | Playlist build, drag-reorder, durations persist, version increments | `PlaylistEditor`, `usePlaylistAutosave`, `PUT /api/playlists/[id]/items`, `savePlaylistItems`, `touchPlaylist` → `bump_playlist_version` |
| 6 | Group with both screens; edits touch both versions | `POST /api/groups`, `PUT /api/groups/[id]/screens`, `setGroupScreens`, `bump_playlist_version` (effective playlist logic), `GroupScreensPanel` |
| 7 | Org isolation; anon-key queries return zero rows | RLS in `0004_rls.sql` (zero rows on every policy-bearing table; `pairing_codes` and RPCs answer `42501` — accept either, §3), same-org + playlist-kind triggers in `0002_triggers.sql`, session-bound client in `requireOrgContext`, org-scoped `queryKeys`, `getActiveOrg` cookie validation, org-scoped storage read policy, no anon storage/realtime listing |
| 8 | `/player` shows code; Add Screen claims; Online with ticking last-seen | `PairingScreen` + `usePlayerPairing`, `/api/device/pairing-code` (mints code + token, §0.13), `/api/device/pairing-status/[code]`, `PairDialog` → `POST /api/screens/claim` (copies the hash; CAS on the code row), first heartbeat (`playlist_version: -1`) + `broadcastScreenStatus`, `RealtimeBridge`/`useRealtimeScreens`, `useNow`, `ScreenCard` (`screenStatus`) |
| 9 | Saves reach player in seconds; rotation; identify; reload | `touchPlaylist` → `sync`; `updateScreen` rotation → `bumpAndSyncScreens`; `sendScreenAction`; `usePlayerChannel` (private channel), `RotationRoot`, `IdentifyOverlay` |
| 10 | Network loss: loops cached media; recovery logs offline/online | `useMediaCache` + Cache Storage (images and videos, §0.14), `usePlayerManifest` backoff, `useHeartbeat.failing` → `offline` (§0.15: websites skipped, cached media loops) → `manifest.refetch()` on recovery; `recordHeartbeat` logs the retroactive `screen_offline` + `screen_online` on recovery regardless of cron timing; `lib/cron.ts` logs `screen_offline` for screens that stay down |
| 11 | Delete screen → player returns to pairing; old token 401 | `deleteScreen` (null hash → `unpair` broadcast → delete), `authenticateDevice` 401, `PlayerApp` unpair verification (`fetchManifest` → 401 → wipe `msign.device`/`manifest`/`pending` + cache) |
| 12 | Website with 1m refresh reloads iframe | `WebsiteDialog` (`REFRESH_OPTIONS`), `ManifestItem.refresh_seconds`, `WebsiteLayer` reload timer |
| 13 | `pnpm build` zero type errors; no file > 300 lines | every slice: run tsc; split at ~250 lines (§1.1 splitting rule) |

---

## Appendix A — cookie / session matrix
| Cookie | Set by | Read by | Attributes |
|---|---|---|---|
| Supabase auth cookies (`sb-*`) | `@supabase/ssr` (login, middleware refresh) | server/browser clients | managed by `@supabase/ssr` |
| `msign_org` (`ACTIVE_ORG_COOKIE`, `types/api.ts`) | `POST /api/orgs/active` (`ACTIVE_ORG_COOKIE_OPTIONS`) | `getActiveOrg()` (server) only — no client component reads it; the active org reaches the client as `AppBootstrap.org` | `path=/; sameSite=lax; httpOnly=false; maxAge=31536000` |

## Appendix B — `(admin)/layout.tsx` (server)
```ts
const session = await getSessionUser(); if (!session) redirect('/login')
const orgs = await listVisibleOrgs(session.supabase); const org = await getActiveOrg(session.supabase)
return <AppProvider value={{ user: { id: session.user.id, email: session.user.email ?? '' }, profile: session.profile, org, orgs }}><Navbar /><PageContainer>{children}</PageContainer></AppProvider>
```
(`AppUser.email` is `string`; auth-js `User.email` is optional — coerce with `?? ''` exactly as `listUsers` does, §5.21.)
`app/(auth)/layout.tsx` mounts `ThemeProvider` (same props) + `Toaster` only; `app/(auth)/login/page.tsx` = `<Suspense fallback={null}><LoginForm /></Suspense>`
(§9.1 — `useSearchParams()` on a static page needs the boundary or `next build` fails). `app/layout.tsx`: `<html lang="en" suppressHydrationWarning className={inter.variable}>`,
`<body className="min-h-screen bg-background text-foreground antialiased">`.

---

## 13. Addendum — Merchant TV accounts + self-claim (added 2026-09-03, additive)

Merchants get an MTech-issued email/password that works ONLY on the TV player; the admin shell stays staff-only
(`(admin)/layout.tsx` adds `if (!session.profile.is_super_admin) redirect('/player')` after the Appendix B session check).

- **Schema (`0007_merchant.sql`)**: `screens.fingerprint text` (null for admin-claimed screens) + partial index
  `(org_id, fingerprint) where fingerprint is not null`. Re-claiming with the same fingerprint reuses the screen row
  (token rotates; the old token starts answering 401).
- **`lib/merchants.ts`** (service role): `listMerchants(admin): MerchantView[]` (non-super-admin users holding a membership,
  joined with their org name), `createMerchant(admin, {email, password, org_id}): MerchantView`
  (`auth.admin.createUser({email, password, email_confirm: true})`, `email_exists`→409, membership upsert role `'member'`
  on conflict `org_id,user_id`, rollback deletes the auth user). Deletion reuses `removeUser` via `DELETE /api/users/[id]`.
- **`lib/validators/merchants.ts`**: `createMerchantSchema = { email: emailSchema, password: z.string().min(8).max(72), org_id: uuidSchema }`.
- **`lib/screens/self-claim.ts`**: `selfClaimScreen(admin, userId, fingerprint): Promise<PlayerDeviceState>` — first membership
  org by `created_at` (none → 403 "No organization assigned…"); fingerprint match → rotate `device_token_hash` + `paired_at`;
  else create playlist (kind `'screen'`) + screen named `"{org.name} TV {n}"` (n = org screen count + 1) with
  `fingerprint`/`paired_at` set, seed `playlist_items` from the org's non-expired content (oldest first, `item_type 'content'`,
  null duration → defaults), `touchPlaylist` when ≥1 item seeded, `logEvent screen_paired {self_claimed: true, seeded_items}`,
  `notifyOrgChanged('screens')`. Raw token returned exactly once (§0.13 rule).
- **Routes**: `POST /api/device/self-claim` `{fingerprint}` → 201 `PlayerDeviceState` — public middleware prefix, enforces its
  own `requireUser()` (session cookie). `GET /api/merchants` → `MerchantView[]`, `POST /api/merchants` → 201 `MerchantView`
  (both `requireSuperAdmin()` + `createAdminClient()`).
- **Types**: `types/api.ts` gains `MerchantView = { id, email, org_id, org_name, last_sign_in_at, created_at }`;
  `ScreenRow`/`types/db.ts` screens Insert/Update gain `fingerprint`.
- **Player**: `lib/player/device-api.ts` gains `selfClaim(fingerprint): Promise<PlayerDeviceState>`. `PairingScreen` props gain
  `fingerprint: string | null` and `onClaimed(state: PlayerDeviceState)` plus a mode toggle ("Merchant? Sign in with email
  instead") to `components/player/MerchantLogin.tsx` (`{ fingerprint, onClaimed, onBack }`: `signInWithPassword` →
  `selfClaim` → `auth.signOut()` → `onClaimed`; shows "Continue as {email}" when a session already exists). `PlayerApp`'s
  claim handler removes `msign.pending` before `save`. `StandbyScreen` gains `noContent?: boolean` and renders
  **"Please contact MTech with photos and videos of the digital menu."**; `PlaybackEngine` passes
  `noContent = manifest.items.length === 0` (standby with items merely unplayable right now keeps the plain logo/clock).
- **Admin UI**: `/admin/users` renders `MerchantsSection` (list + remove via `DELETE /api/users/[id]` + `MerchantDialog`:
  email, generated-or-typed password, org `Select` from `GET /api/orgs`). `queryKeys.merchants = { all: () => ['merchants'], list: () => ['merchants', 'list'] }`.
- **Android shell (`android/`, not part of the Next build)**: kiosk WebView APK `com.mtech.msign` loading
  `BuildConfig.BASE_URL + '/player'`; debug BASE_URL `http://10.0.2.2:3000` (cleartext allowed in the debug manifest only),
  release BASE_URL = the production deployment. Fullscreen immersive, keep-screen-on, `mediaPlaybackRequiresUserGesture = false`,
  back button consumed, boot receiver + LEANBACK_LAUNCHER. Signing: `android/msign-release.jks` via `android/keystore.properties`.

---

## 14. Addendum — Menus + Screen Wall + store managers (added 2026-09-03, additive)

A back-office "Wall" where a menu / board / web page is dragged onto a TV to show it and pin it.

- **Schema (`0008_menu_kind.sql`, `0009_menus.sql`)**: `playlist_kind` gains `'menu'` (own migration — enum values
  can't be used in the tx that adds them). `screens.menu_id uuid → playlists(id) on delete set null` + `screens.locked
  boolean not null default false`. New triggers `screens_menu_same_org` (reuses generic `assert_same_org('playlists','menu_id')`)
  and `screens_menu_kind` (`assert_screen_menu_kind` — menu_id must be a kind='menu' playlist; the existing kind guard is
  hardcoded to playlist_id). `bump_playlist_version` extended: a screen with `menu_id` reacts only to its menu; menu_id null
  rows keep the previous group/own-playlist behavior exactly.
- **Menus = kind='menu' playlists** (reuse playlists + playlist_items). `lib/menus.ts`: `listMenus(supabase, orgId): MenuView[]`
  (board count, screen count, cover thumb), `getMenu(supabase, orgId, id): PlaylistView` (404 unless kind='menu'),
  `createMenu(ctx, name)`, `renameMenu(ctx, id, name)`, `deleteMenu(ctx, admin, id)` (screens fall back via FK + re-synced).
  Boards are edited through the EXISTING `PUT /api/playlists/[id]/items` + `PlaylistEditor` (kind-agnostic).
- **Content resolution precedence** (the two chokepoints, both updated): `getEffectivePlaylistId` and `toScreenView`'s
  `effective_playlist_id` → `menu_id ?? group_playlist ?? playlist_id`. `ScreenView` gains `menu_name`; `menu_id`/`locked`
  ride through from `ScreenRow`.
- **Assignment (`lib/screens/assign.ts`, `POST /api/screens/[id]/assign`)**: `{kind:'menu', menu_id}` → set `menu_id` (reference);
  `{kind:'content'|'website', ...}` → the screen's OWN playlist = [that item], detached from menu+group; `{kind:'clear'}` →
  empty own playlist, detached, unlocked. A successful non-clear assign sets `locked=true`; a locked screen → **409**. Lock/unlock
  via `PATCH /api/screens/[id] { locked }` (`screenUpdateSchema`/`updateScreen` extended). `assignScreenSchema` = discriminated
  union on `kind`.
- **Routes**: `GET|POST /api/menus`, `GET|PATCH|DELETE /api/menus/[id]`, `POST /api/screens/[id]/assign` — all `requireOrgContext()`
  (org-scoped; a store manager with role admin can write). Types: `MenuView = Playlist & { item_count, screen_count, thumb_url }`.
- **UI**: `/wall` (`components/wall/*`: `WallBoard` one DndContext, `WallTray` draggable Menus/Boards/Web tabs, `WallTile`
  droppable `TvFrame` + lock overlay + kebab; drop → `/assign`, disabled droppable when locked). `/menus` + `/menus/[id]`
  (`components/menus/*`: library cards → `PlaylistEditor`). `NavTabs` adds Wall + Menus. `queryKeys.menus`.
- **Store managers (§ "Both")**: membership role `'admin'` = store manager (org-scoped write via RLS `can_write_org`, no policy
  change); `'member'` stays TV-only. `AppBootstrap.role` surfaces it (loaded by `getMembershipRole` in `(admin)/layout.tsx`).
  The outer `(admin)/layout` admits super admins + role admin/owner (else → `/player`); `(admin)/admin/layout.tsx` keeps
  Users/Orgs/Settings to super admins (else → `/wall`). `AdminMenu`/`OrgSwitcher` hide staff-only items for non-super-admins.
  `createMerchant`/`MerchantDialog` gain an access level (TV only / Manager).

---

## 15. Addendum — Portrait orientation + player watermark (added 2026-09-08, additive)

Vertical ("portrait") screens: a tall menu shows upright in a landscape browser window and fills a display that is
already portrait. Distinct from `rotation`, which stays for how a TV is physically mounted.

- **Schema (`0012_orientation.sql`)**: `screens.orientation text not null default 'landscape'`, check
  `in ('landscape','portrait')`. `ScreenRow.orientation: string` rides through `SCREEN_SELECT` (`*`) into `ScreenView`.
- **Types**: `ORIENTATIONS = ['landscape','portrait'] as const` / `Orientation` (types/api.ts);
  `isOrientation(s: string): s is Orientation` (lib/utils). `Manifest.screen` gains `orientation: Orientation`
  (`buildManifest` narrows via `isOrientation`, fallback `'landscape'`).
- **`PATCH /api/screens/[id]`**: `screenUpdateSchema` gains `orientation?: z.enum(ORIENTATIONS)`; `updateScreen` writes it
  and, when it changes, calls `bumpAndSyncScreens` (same rule as rotation — the player must redraw).
- **Player**: `RotationRoot({ rotation, orientation? = 'landscape', children })` — in portrait the children render inside an
  upright 9:16 stage contain-fitted and centered on the (possibly rotated) surface, sized with pure CSS `min()` because the
  surface is exactly 100vw×100vh (or swapped for 90/270). Children still lay out with `absolute inset-0`, now against the
  stage. `Watermark()` — the MTech Distributors mark (`public/mtech-logo.png`, opaque white ground → shown on a small white
  chip) pinned bottom-right inside the stage; `PlayerApp` renders it whenever a manifest is playing (not on the code screen).
- **Admin UI**: `OrientationSelect({ value: string; onChange(v: Orientation): void; disabled? })` sits next to
  `RotationSelect` in `ScreenHeader` (PATCH `{ orientation }`, toast "Orientation updated"). `RotationDialog` (card action
  `'rotation'`, menu label "Orientation & rotation") now saves `{ orientation, rotation }` together. `TvFrame` gains
  `orientation?: string` and previews a portrait screen as a centered 9:16 stage on the 16:9 frame; `ScreenCard` and
  `WallTile` pass it. `RotationSelect`'s 0° label reads "0° (not rotated)" so it no longer collides with Landscape.

---

## 16. Addendum — Server-signed thumbnail uploads (added 2026-09-08, fix)

**Bug**: `0005_storage.sql` only grants super admins write access to the `thumbs` bucket, but the browser uploaded each
thumbnail with the user's own session. A store manager's (role `admin`) thumbnail upload was therefore rejected by RLS,
`thumb_path` was saved as `null`, and every card / tile / manifest item showed the placeholder icon. Media itself was fine
(server-signed URL).

- `UploadSignResponse` gains `thumb_signed_url: string` and `thumb_token: string`. `signUpload` creates signed upload
  URLs for the media object AND the thumbnail (`thumbs` bucket, `upsert: true`) in parallel.
- `lib/upload-client.ts` uploads the thumbnail with `storage.from('thumbs').uploadToSignedUrl(thumb_path, thumb_token, blob)`
  — no storage policy involved, so it works for every console user. Storage policies are unchanged.
- Existing image rows with `thumb_path = null` were backfilled once from the originals (server-side resize matching
  `lib/thumbs.ts`: max width 640, aspect kept, JPEG q0.82, black behind transparency). No runtime self-healing exists — a
  null `thumb_path` still renders the placeholder icon.

---

## 17. Addendum — Touch exit hotspot, click-to-watch tiles, wall delete (added 2026-09-08, additive)

- **Player**: `ExitFullscreenHotspot()` — five consecutive taps/clicks within 5 s inside the top-left 96 px of the PHYSICAL
  screen EXIT fullscreen (rendered by `PlayerApp` outside `RotationRoot`, so orientation/rotation don't move it). Taps are
  counted by a window-level `pointerdown` CAPTURE listener on `clientX/clientY` (nothing layered over the corner can hide
  them); an invisible 96 px square only stops a web-page iframe from swallowing the events. Feedback: a high-contrast
  ripple (`@keyframes tap-dot`, globals.css; white with a dark halo so it reads on any content) where each registered tap
  landed + a five-dot progress pill at top-left that clears when the window lapses. The hotspot is active ONLY while
  `document.fullscreenElement` is set: outside fullscreen nothing is counted or drawn, and a `fullscreenchange` to
  non-fullscreen (Esc, browser UI, the hotspot) drops any partial count. A manual exit calls
  `suppressAutoFullscreenFor(5000)` (`lib/player/fullscreen.ts`, module state) so `FullscreenPrompt`'s tap-to-enter is
  blocked for 5 s; after that a SINGLE tap re-enters as normal. A reload resets everything. Bottom-right stays free for
  `Watermark`. `ContextMenuBlocker()` (also rendered by `PlayerApp`) cancels `contextmenu` (right-click / long-press)
  while fullscreen only.

---

## 18. Addendum — "Powered by MTech" badge with per-TV positioning (added 2026-09-08, additive)

- **Schema (`0013_watermark_position.sql`)**: `screens.watermark_x / watermark_y double precision null` = the badge CENTRE
  as fractions (0..1) of the player stage; both null = default bottom-right (check constraint).
- **Types**: `WatermarkPosition = { x, y }`; `Manifest.screen.watermark: WatermarkPosition | null`; `ScreenRow` carries
  the two columns (ride into `ScreenView`).
- **`PATCH /api/screens/[id]`**: `screenUpdateSchema.watermark?: { x, y } | null`. `updateScreen` refuses it with **403**
  unless `ctx.profile.is_super_admin`; a change calls `bumpAndSyncScreens` (the TV redraws).
- **Player**: `Watermark({ position })` renders the "Powered by MTech" pill (replaces the logo chip); `WatermarkBadge({
  position, className?, ref? })` is shared with the admin preview. Size + corner offsets live in globals.css `.mtech-badge`
  (`[data-corner]` when unpositioned): `cqmin` against the stage — `RotationRoot`'s surface and portrait stage declare
  `container-type: size` — inside `@supports (font-size: 1cqmin)`, with a `vmin` fallback for Android WebViews that lack
  container units (otherwise the badge rendered unstyled at the top-left). `lib/player/platform.ts` `isAndroidWebView()` (UA `; wv)`): `ExitFullscreenHotspot`
  never listens inside the Android app.
- **Admin**: `WatermarkPositionDialog({ screen, onOpenChange })` — full-screen preview (stage matches the TV's orientation,
  `container-type: size`, background = the TV's preview thumb) where the badge is dragged (grab offset kept) or placed by
  clicking; the centre is clamped so the badge stays fully inside; Save → PATCH; "Reset to corner" → `watermark: null`;
  Esc closes. `WallTile` gains `onPositionWatermark?` → kebab "Position watermark"; `WallBoard` passes it only when
  `profile.is_super_admin`.

---

## 19. Addendum — Employees + side-by-side locations in Team (added 2026-09-08, additive)

- **Schema (`0014_employees.sql`)**: `profiles.employer_id uuid null → profiles(id) on delete cascade` (+ partial index).
  An employee = a non-staff login whose profile points at the merchant (owner) login; access = memberships to a subset of
  the owner's locations with role `'admin'` (Manager) or `'member'` (TV only). Employees never have employees.
- **Types**: `MerchantLocation = { id, name, screen_count, content_count }`; `EmployeeView = { id, email, role,
  location_ids, last_sign_in_at, created_at }`; `MerchantView.locations: MerchantLocation[]` + `employees: EmployeeView[]`.
- **lib/merchants split** (all re-exported from `lib/merchants.ts`): `lib/merchants/list.ts` (`listMerchants` is
  profiles-driven: skips staff and employees as top-level rows, folds employees under their employer, tallies TVs/content
  per org in two cheap selects; `getMerchant`, `toTier`), `lib/merchants/employees.ts` (`createEmployee`,
  `updateEmployee`, `deleteEmployee`, `deleteEmployeesOf`), `lib/merchants/copy.ts` (`copyLocationContent`).
  `deleteMerchant` removes the employees' logins first. `setMerchantPassword` works for employees too (refuses staff).
- **Routes (super admin)**: `POST /api/merchants/[id]/employees` `{ email, password, role, org_ids[] }` → 201 MerchantView;
  `PATCH /api/merchants/[id]/employees/[employeeId]` `{ role?, org_ids? }` → MerchantView; `DELETE` → OkResponse.
  Validators `createEmployeeSchema` / `updateEmployeeSchema`. Password reset reuses `POST /api/merchants/[employeeId]/password`;
  location rename reuses `PATCH /api/orgs/[id] { name }`.
- **UI**: `MerchantManageDialog` is now `sm:max-w-4xl` with the locations as side-by-side `LocationPanel`s (inline rename,
  TV/content counts, access badges, "Open in console" = `setActiveOrg` + `/tvs`) plus an "Add a location" panel;
  `MerchantEmployees` (list with inline access `Select`, per-location toggle chips when the merchant has 2+ locations,
  reset password, remove, and the "Add employee" form) sits ABOVE the owner's "Reset password". Team search also matches
  employee emails and the Access cell shows the employee count. `generatePassword` lives in `components/admin/password.ts`.

---

## 20. Addendum — Player on old TV browsers (added 2026-09-09, additive)

TV browsers (LG webOS ≈ Chrome 68/79/87/94 for 2020–2023 sets, Samsung Tizen, old Android WebViews) rendered
`/player` as a blank page: Tailwind v4's cascade layers (Chrome 99+) dropped every style, and the app script failed
before hydration, so nothing painted. The console stays desktop-only; the player is made engine-tolerant.

- **`app/player.css`** — the player's own plain stylesheet, imported globally by the root layout AFTER globals.css
  (un-layered, so it wins over Tailwind and is the only CSS old engines apply). `.pl-*` classes for every player
  surface (root/fill/surface/stage/media/iframe/standby/code/identify/hotspot/progress/dot/ripple/boot/fatal) plus
  `.mtech-badge` (+ `--live` for the admin preview) and `@keyframes pl-tap`. Rules are Chrome ~64-safe: no `@layer`,
  `oklch`, `color-mix`, `min()`/`clamp()` or flex `gap` (margins); `cqmin` only inside `@supports`.
- **`RotationRoot`** measures `window.innerWidth/Height` (resize-tracked) and computes the swapped surface and the
  portrait 9:16 stage in px — no CSS `min()`.
- **`lib/player/polyfills.ts`** — `POLYFILLS_JS`, an ES5 string: `globalThis`, `queueMicrotask`, `Array/String.prototype.at`,
  `flat`/`flatMap`, `Object.fromEntries`/`hasOwn`, `replaceAll`, `Promise.allSettled`/`any`, `structuredClone` (JSON),
  `replaceChildren`. The root layout INLINES it as the first `<script>` in `<head>` on every page: Next emits its async
  chunks ahead of the layout's head content, so an external tag (or `next/script beforeInteractive`, which only preloads)
  could lose the race; an inline script runs during parsing.
- **Syntax targets** — `package.json#browserslist` (chrome ≥ 64 … — the single config; a `.browserslistrc` alongside it is
  a browserslist error). Production builds use **webpack** (`next build`, no `--turbopack`): Turbopack's runtime chunk
  carries `?.`/`??` regardless of browserslist. `next.config.ts` lists every `@supabase/*` package in `transpilePackages`,
  but `@supabase/realtime-js`/`auth-js` still ship `?.`/`??`, so the Supabase client is kept OUT of the player page:
  `usePlayerChannel` only `import()`s `lib/player/realtime.ts` (the channel subscription, moved there) when
  `lib/player/engine.ts` `supportsModernSyntax()` passes (a `new Function('null ?? 1')` probe, cached). Older engines run
  the player without realtime: content changes arrive with the 30 s heartbeat's version check, a 401 still unpairs;
  `identify`/`reload` commands are not delivered there. **Effective floor: Chrome ~66** (LG webOS 5+ / 2020+, Samsung
  Tizen 5.5+, Android WebView 66+); realtime on Chrome 80+. Older sets show the boot message with their user agent.
- **Android app 1.2** appends `MSIGN-Android/<version>` to its user agent (`isAndroidWebView()` matches it or `; wv)`); the
  boot script swaps the advice to "update Android System WebView" when it sees it. The shell retries main-frame failures
  (5 s → 60 s, and immediately on a `ConnectivityManager` network callback) behind a native notice, pins `textZoom = 100`,
  cancels TLS errors with a "check date and time" notice, and logs the page console under the `MSIGN` logcat tag.

---

## 21. Addendum — Smooth video, no end-of-video overlay, synchronized playback (added 2026-09-10, additive)

- **Video source (`useMediaCache.srcFor`)**: videos play from their signed **https URL while online**; the Cache Storage
  copy (object URL) is the offline path only. TV engines (Android WebView, LG, Samsung) hand an https `<video>` to the
  platform hardware decoder but push `blob:` sources through the browser's software decoder — the cause of stuttering
  even at 720p. Images keep using object URLs.
- **End of video**: `MediaLayer` fires `onNearEnd` 0.35 s before the end (free-running mode; the engine starts the next
  item so the crossfade covers the finish) and hides the element on `ended` — TV browsers paint their own grey "paused"
  overlay on a finished video. A lone video gets `loop` (seamless, no remount); `disableRemotePlayback` is set.
- **Manifest durations**: `resolveDuration` keeps detected video durations exact (to 10 ms, min 1 s) instead of `ceil`.
- **Synchronized playback** — `playlists.sync boolean not null default false` (`0015_playlist_sync.sql`);
  `PlaylistRow.sync`; `Manifest.sync` = the effective playlist's flag; `HeartbeatResponse.server_time` (ISO).
  `PATCH /api/playlists/[id]` (`playlistUpdateSchema`: `name?`, `sync?`; `updatePlaylist` → `touchPlaylist` on a sync
  change so every TV re-syncs). `PlaylistEditor` shows a **Sync across TVs** switch in its header.
  Player: `lib/player/clock.ts` (`noteServerTime` from `manifest.generated_at` and every heartbeat; `syncedNow()`),
  `lib/player/sync.ts` (`slotAt(items, nowMs)`: the active list repeats as consecutive duration slots from the Unix
  epoch — any TV with the same list computes the same slot and offset with no coordination). `PlaybackEngine` in sync
  mode (`tickSync`) shows the clock's slot, wakes at the next boundary, holds an unplayable slot in standby (keeps the
  phase) and passes `syncStartMs` to `MediaLayer`, which seeks the video to `(syncedNow − syncStartMs)` once metadata is
  known and re-aligns every 3 s when drift exceeds 0.5 s. `identify`/`reload`/`sync` commands are unchanged.
- **Per-TV sync (`0016_screen_sync.sql`)**: `screens.sync boolean not null default false` (`ScreenRow.sync`, rides into
  `ScreenView`). `Manifest.sync = screen.sync || playlist.sync`. `PATCH /api/screens/[id] { sync }` (`screenUpdateSchema`;
  a change → `bumpAndSyncScreens`). TVs page: **Select TVs** enters selection mode (tiles become checkboxes, dropping is
  disabled, the frame click toggles selection); the toolbar offers **Sync selected** / **Unsync selected** (one PATCH per
  TV) and **Done**. Tiles with `sync` show a **Synced** badge; the tile kebab has **Sync playback / Turn sync off**.
- **Starting line (`0017_sync_started_at.sql`)**: `screens.sync_started_at` / `playlists.sync_started_at timestamptz`
  are set to now when sync turns on and cleared when it turns off (`updateScreen`, `updatePlaylist`). `Manifest.sync_epoch`
  = the applicable one (screen's when the TV is flagged, else the playlist's); `slotAt(items, nowMs, epochMs)` counts the
  loop from it (`epochMsOf(iso)`, 0 when null), so pressing Sync starts every TV from item 1 / 0:00 at that instant.
  **`POST /api/screens/sync` `{ ids[], sync }`** (`screensSyncSchema`, `setScreensSync`) updates a whole selection in ONE
  statement with ONE timestamp → `bumpAndSyncScreens`; the TVs page uses it for **Sync/Unsync selected**. The selection
  toolbar also has **Identify selected** and **Reload selected** (one `POST /api/screens/[id]/actions` per paired TV).

- **Visible failure** — `app/player/page.tsx` server-renders a `.pl-boot` message ("Starting MSIGN…" + the browser's
  user agent via an inline script) ABOVE the player (`z-index: 5`); `PlayerApp` removes it on mount, so on an engine
  that never runs the app the message stays and names the browser. `PlayerErrorBoundary` shows `.pl-fatal` (error +
  user agent) instead of a bare black screen, still reloading after 10 s.
- Verified with an ES2020 parse of every chunk the built `/player` page loads (acorn), an ES5 parse of the inline polyfill,
  and the CDP tests.
- **Wall**: clicking a `WallTile`'s TV frame opens `/player?code=<login_code>` in a new tab (identical to the kebab's
  "Open full screen"; a screen without a code falls back to `onOpen`). `WallTile` gains `onDelete(): void`; the kebab ends
  with "Delete screen" (destructive, separator) and `WallBoard` renders `DeleteScreenDialog` for it. "Clear" is no longer
  styled destructive — it empties the TV; deleting removes the screen.
