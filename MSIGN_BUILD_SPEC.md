# MSIGN — MTech Digital Signage Platform (Full Build Spec)

Build a production, multi-tenant digital signage platform in this repo. Two surfaces in one Next.js app: an **Admin web app** (manage content, screens, playlists, groups, websites for any merchant from anywhere) and a **TV Player web app** (runs fullscreen in any TV browser, pairs with a code, plays its playlist, phones home over the internet — no port forwarding, player always pulls/subscribes). Everything must be fully wired end to end: real database, real auth, real file storage, real-time push to screens. No mock data anywhere.

---

## 1. Stack

- Next.js 15, App Router, TypeScript, no `src/` dir
- Tailwind CSS + shadcn/ui + lucide-react + sonner (toasts) + next-themes (dark default, light toggle)
- Supabase: Postgres (RLS), Auth (email/password), Storage, Realtime (broadcast)
- `@supabase/ssr` for server/client Supabase clients; service-role client only inside route handlers
- `@tanstack/react-query` for admin data fetching (pairs with realtime for live-updating lists)
- `@dnd-kit/core` + `@dnd-kit/sortable` for playlist drag-and-drop
- `zod` validation on every API route; `date-fns` for relative times
- Package manager: pnpm. Scaffold if repo is empty: `pnpm create next-app@latest . --ts --tailwind --eslint --app --no-src-dir` then `pnpm dlx shadcn@latest init`
- Deploy target: Vercel + Supabase cloud. Include `vercel.json` cron config.

## 2. Code organization — hard rules

- **No file over ~300 lines. Ever.** If a file approaches it, split it. Pages stay under ~100 lines — they compose components, they don't contain logic.
- One component per file, single responsibility. Business logic lives in `lib/`, client state in `hooks/`, never inline in pages.
- API route handlers stay thin: parse (zod) → call a `lib/` function → respond. Shared logic never duplicated across routes.

```
app/
  (auth)/login/page.tsx
  (admin)/layout.tsx                  # shell: navbar, org switcher, theme
  (admin)/content/page.tsx
  (admin)/screens/page.tsx
  (admin)/screens/[id]/page.tsx
  (admin)/groups/page.tsx
  (admin)/websites/page.tsx
  (admin)/admin/users/page.tsx
  (admin)/admin/orgs/page.tsx
  (admin)/admin/settings/page.tsx
  player/page.tsx
  api/
    content/…  folders/…  websites/…  playlists/…  screens/…  groups/…
    users/…  orgs/…  uploads/…
    device/pairing-code/route.ts
    device/pairing-status/[code]/route.ts
    device/manifest/route.ts
    device/heartbeat/route.ts
    cron/tick/route.ts
components/
  shell/      Navbar.tsx OrgSwitcher.tsx ThemeToggle.tsx PageHeader.tsx ListToolbar.tsx
  content/    ContentGrid.tsx ContentCard.tsx FolderCard.tsx UploadDropzone.tsx
              UploadProgress.tsx ExpirationDialog.tsx MoveDialog.tsx PreviewModal.tsx
  screens/    ScreenCard.tsx ScreenGrid.tsx PairDialog.tsx ScreenHeader.tsx DeviceInfo.tsx
  playlist/   PlaylistEditor.tsx PlaylistRow.tsx LibraryPanel.tsx LibraryCard.tsx
              SchedulePopover.tsx DurationInput.tsx
  groups/     GroupCard.tsx GroupScreensPanel.tsx
  websites/   WebsiteCard.tsx WebsiteDialog.tsx
  player/     PairingScreen.tsx PlaybackEngine.tsx MediaLayer.tsx WebsiteLayer.tsx
              StandbyScreen.tsx IdentifyOverlay.tsx
  ui/         (shadcn)
lib/
  supabase/   client.ts server.ts admin.ts middleware.ts
  validators/ one zod schema file per resource
  broadcast.ts manifest.ts schedule.ts pairing.ts storage.ts thumbs.ts orgs.ts utils.ts
hooks/
  useRealtimeScreens.ts useUpload.ts usePlaylistAutosave.ts useHeartbeat.ts
  usePlayerManifest.ts useMediaCache.ts
types/        db.ts api.ts
supabase/migrations/
scripts/seed.ts
```

## 3. Design system

- Dark theme default: bg `#0f0f10`, cards `#1a1a1c`, borders `#2a2a2e`, text `#f4f4f5` / muted `#a1a1aa`
- Accent: MTech purple `#6109b6` (active nav tab, primary buttons, focus rings). Status: online `#22c55e`, offline `#ef4444`, warning `#f59e0b`
- Typography: Inter, tracking `-0.02em` on headings, line-height 1.05 headings, max two font weights
- Top navbar (all admin pages): "MSIGN" logo left → tabs **Content / Screens / Groups / Websites** → right side: org switcher, **Admin** dropdown (Users, Organizations, Settings, Log out), theme toggle, avatar circle with initial
- Every list page header: page title + primary outline button, right side: **Sort** dropdown, **Filters** popover, **Search** input (debounced 300ms) — build once as `ListToolbar`
- All mutations show a toast; all deletes get a confirm dialog

## 4. Data model (SQL migrations in /supabase/migrations, RLS on every table)

```
organizations   id, name, slug unique, logo_url, timezone text default 'America/New_York', created_at
profiles        id (= auth.users.id), full_name, avatar_url, is_super_admin bool default false
memberships     id, org_id, user_id, role enum('owner','admin','member'), unique(org_id,user_id)
folders         id, org_id, name, created_at
content         id, org_id, folder_id null, name, type enum('image','video'), storage_path, thumb_path,
                mime, size_bytes, width, height, duration_seconds null, expires_at null, created_by, created_at
websites        id, org_id, name, url, refresh_seconds int default 0, created_at
playlists       id, org_id, name, kind enum('screen','group'), updated_at, created_at
playlist_items  id, playlist_id, position int, item_type enum('content','website'),
                content_id null, website_id null, duration_seconds int null, transition enum('none','fade') default 'fade',
                mute bool default true, active_from date null, active_to date null,
                days_of_week int[] null, daily_start time null, daily_end time null
screens         id, org_id, name, playlist_id null, group_id null, device_token_hash text null,
                rotation int default 0, last_seen_at, last_ip, user_agent, resolution,
                current_item_id null, playlist_version int default 0, paired_at, created_at
screen_groups   id, org_id, name, playlist_id, created_at
pairing_codes   id, code char(6) unique, device_fingerprint, expires_at (now()+15min), claimed_screen_id null, created_at
events          id, org_id, screen_id null, type text, payload jsonb, created_at
```

Rules:
- Effective playlist for a screen = `group.playlist` if `group_id` set, else `screen.playlist_id`. Every screen gets its own playlist auto-created; every group gets one on creation.
- RLS: members read/write rows where `org_id` in their memberships (owner/admin write, member read-only); `is_super_admin()` helper function bypasses org scoping. Devices never touch Supabase directly — device API routes use the service-role client after verifying the device token.
- Online = `last_seen_at` within 75 seconds (computed at read; also live via realtime, see §10).
- `events` types: `screen_paired`, `screen_online`, `screen_offline`, `screen_deleted`, `playlist_updated`, `content_uploaded`, `content_deleted`.

## 5. Auth, roles, tenancy

- Supabase email/password. Seed script `pnpm seed`: creates super admin from `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`, org "MTech Demo", one folder, 3 generated placeholder images, one website (https://mtechdistributors.com), and **2 unpaired placeholder screens** ("Demo TV Left", "Demo TV Right") so all admin UI is buildable and testable before the player exists.
- Middleware: everything except `/player`, `/api/device/*`, `/login` requires a session. Every admin query is scoped to the active org.
- Super admin: org switcher in the navbar (dropdown of all orgs + "New organization"); active org persisted in a cookie. Each org = one merchant (e.g. "Sabra Pizza"). Super admins manage any merchant's screens from anywhere.
- **v1 access: MTech staff only.** Every user is a super admin. Keep `memberships` + the role enum in the schema for a future merchant portal, but build no merchant-facing login or invite flows.

## 6. Content page (`/content`)

- Grid of cards: 16:9 thumbnail, name, size, video duration badge, red **Expired** badge when `expires_at < now()`. Folder cards render first; clicking enters folder (breadcrumb at top).
- **Upload Files** button + full-page drag-and-drop dropzone. Accept jpg/png/webp/gif/mp4/webm/mov, up to 500MB, multi-file, per-file progress bars. Upload direct-to-storage via Supabase signed upload URLs (resumable for >6MB), then POST metadata to create the row.
- Client-side extraction before upload completes the row: image width/height; video width/height/duration + capture frame at 1s to canvas → upload as `{id}-thumb.jpg` to public `thumbs` bucket. Media itself goes to private `media` bucket.
- Kebab next to page title: **New folder**, **Delete expired content** (confirm dialog shows count, deletes all expired in org).
- Card kebab: Rename, Move to folder, Set expiration (date picker, clearable), Preview (modal, videos play), Download, Delete. Delete is guarded: if used in any playlist, warn and list which screens/groups; confirm also strips those playlist items and broadcasts sync.
- Sort: Name / Newest / Oldest / Size / Type. Filters: type, folder, expired only. Search by name.

## 7. Screens page (`/screens`)

- **Add Screen** → dialog: 6-char pairing code input + screen name (+ org select) → claims code → card appears. (Pairing goes live in phase 9; the dialog can ship earlier and just validate against `pairing_codes`.)
- Card: TV-frame mockup showing the current item's thumbnail (gradient fallback), **Online**/**Offline** pill on the frame, screen name, "Last seen {relative}" ticking live, kebab: Open playlist, Rename, Rotation (0/90/180/270), Identify, Reload player, Move to group / Remove from group, Delete screen.
- Delete screen: revokes device token (null the hash) → player 401s, wipes itself, returns to pairing screen.
- Filters: status, group. Sort: Name / Last seen / Newest. Search.

## 8. Screen detail + playlist editor (`/screens/[id]`)

- Header: name (inline editable), status pill, last seen, device info (resolution, IP, user agent), rotation select, group select, **Identify** and **Reload** buttons, live "Now playing: {item}" chip.
- Two-pane editor:
  - LEFT: tabs **Content | Websites**, searchable mini-grid of the org library. Drag a card into the right pane to append, or click a + button on the card.
  - RIGHT: the playlist — vertically sortable rows (`@dnd-kit`): thumb, name, duration input (images/websites; videos show detected duration with editable override), transition select, mute toggle (videos only), schedule popover (date range, days-of-week checkboxes, daily start/end time), remove button.
- Autosave debounced 500ms → bump `playlists.updated_at` + increment `screens.playlist_version` for every affected screen → broadcast `sync` (see §10).
- If the screen is in a group: purple banner "This screen plays group '{name}'" — the editor edits the group playlist and warns it affects all screens in the group.

## 9. Groups (`/groups`) and Websites (`/websites`)

Groups:
- Empty state: illustration + "If you have multiple screens with the same playlist, a screen group allows you to manage them all in one place. Simply create a group playlist, and then assign screens to the group." + **Add Screen Group**.
- Create → name → group + playlist created → opens the same two-pane editor plus a "Screens" panel: checklist of org screens; checking sets `screens.group_id`.
- Group card: name, screen count, online/offline summary dots, kebab: Edit playlist, Rename, Manage screens, Delete (screens revert to their own playlists, broadcast sync to each).

Websites:
- Empty state: "Websites are just as easy to display on your screens as images and videos. Simply add a website here, then drag it into the playlist of any screen." + **Add Website**.
- Add/Edit dialog: name, URL (require https, validate), refresh interval (Never / 1m / 5m / 15m / 1h).
- Card: generic browser-frame thumb + favicon via `https://www.google.com/s2/favicons?domain={host}&sz=64`, name, URL, kebab: Edit, Preview (iframe modal), Open in new tab, Delete (same in-use guard as content).
- Helper text on the page: sites that block iframes (X-Frame-Options/CSP) won't render on screens — use Preview to test.

## 10. Realtime architecture

- Supabase Realtime **broadcast** channels:
  - `screen-{screen_id}` — player subscribes. Server events: `sync` (refetch manifest), `reload`, `identify`, `unpair`.
  - `org-{org_id}` — admin pages subscribe. Server broadcasts on every heartbeat: `{screen_id, last_seen_at, current_item_id, online:true}`. Screens page + detail update live; a local 75s timer flips cards to Offline when heartbeats stop.
- Server routes send broadcasts with the service-role client via a small `broadcast(channel, event, payload)` helper in `lib/broadcast.ts` (subscribe, send, teardown).
- Correctness never depends on realtime: heartbeat every 30s returns the server's `playlist_version`; on mismatch the player refetches the manifest. Realtime just makes updates near-instant.

## 11. Device API (route handlers under `/api/device/*`)

- `POST /api/device/pairing-code` `{fingerprint}` → creates 6-char code (unambiguous alphabet, no 0/O/1/I), returns `{code, expires_at}`.
- `GET /api/device/pairing-status/[code]` → `{claimed:false}` or `{claimed:true, device_token, screen_id}`. Token = 48 random bytes base64url; store only SHA-256 hash on the screen row; return the raw token exactly once.
- `GET /api/device/manifest` (Bearer device token) → `{screen:{id,name,rotation,timezone}, playlist_version, items:[{id, type:'image'|'video'|'website', url (24h signed URL for media), thumb, duration_seconds, transition, mute, schedule:{...}}]}` resolved from the effective playlist.
- `POST /api/device/heartbeat` (Bearer) `{current_item_id, resolution, playlist_version, uptime_seconds}` → updates `last_seen_at`, `last_ip`, `user_agent`, `current_item_id`; broadcasts to `org-{org_id}`; returns `{playlist_version}`.
- All device routes: verify token hash, 401 on failure or nulled hash.

## 12. Player app (`/player`)

- Fullscreen, black, no chrome. Request fullscreen on first tap when not in kiosk mode; hide cursor after 3s idle; keep-awake via a muted looping 1px video (NoSleep pattern).
- **Unpaired boot**: no token in localStorage → request pairing code → render it huge center-screen with MSIGN logo and "Enter this code at {NEXT_PUBLIC_APP_URL} → Screens → Add Screen" → poll pairing-status every 3s → on claim, persist `{device_token, screen_id}` and continue. Codes auto-refresh when they expire.
- **Paired loop**:
  1. Fetch manifest.
  2. Preload: images via `Image()`; videos via `fetch` → Cache Storage bucket `msign-media-v1` (evict anything not in the current manifest). Start playback as soon as item 1 is ready.
  3. Playback engine: filter items by schedule using the org timezone (`Intl.DateTimeFormat` in that zone). No active items → standby screen (logo + clock). Images/websites show for `duration_seconds` (image default 10). Videos play muted per flag, advance on `ended` (duration override cuts early). Websites render in a sandboxed iframe (`allow-scripts allow-same-origin`) with their refresh interval. Fade transition = 300ms opacity crossfade using two stacked layers (double-buffer the next item). Apply rotation with a CSS transform on the root, swapping width/height for 90/270.
  4. Heartbeat every 30s; refetch manifest on version mismatch.
  5. Subscribe `screen-{id}`: `sync` → refetch manifest; `reload` → `location.reload()`; `identify` → overlay the screen name for 10s; `unpair` → wipe storage → pairing screen. Refetch manifest on websocket reconnect.
  6. **Offline resilience**: if fetches fail, keep looping cached media (skip websites), retry with backoff 5s→60s, no error UI on the TV.
  7. Errors: media error → skip item and continue; global error boundary → auto-reload after 10s.

## 13. Admin API routes (`/api/*`, session + org guard, zod)

CRUD for folders, content (create-after-upload, rename, move, set-expiration, delete, delete-expired), websites, playlists + batch reorder of items, screens (claim `{code,name}`, rename, rotation, set-group, delete, actions `identify|reload` → broadcast), groups (CRUD, assign screens), users (invite, remove), organizations (CRUD). Signed-URL endpoints for uploads. Every mutation writes an `events` row where a type exists for it.

## 14. Cron (`/api/cron/tick`, every 5 min, guarded by CRON_SECRET, wired in vercel.json)

- Insert `screen_offline` events for screens crossing the 75s threshold since last tick (dedupe: only if the last event for that screen was `screen_online`/`screen_paired`), and `screen_online` on recovery.
- Delete expired pairing codes.

## 15. Users, Organizations, Settings

- **Users** (`/admin/users`): MTech staff table — email, name, last sign-in; Invite staff (email, created as super admin); remove.
- **Organizations** (`/admin/orgs`): list with screen/content counts; create, rename, open-as (switches active org), delete (cascades, confirm requires typing the org name).
- **Settings** (`/admin/settings`): org name, logo upload (shows on player standby + pairing screens), timezone select (drives all schedules).

## 16. Env

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=
CRON_SECRET=
```

## 17. README (write it)

Setup (supabase project, migrations, buckets `media` private / `thumbs` public / `logos` public, seed, dev), deploy to Vercel, and a **TV setup guide**: Fire TV Stick (Silk browser → open `{APP_URL}/player`, disable sleep, set as launch page) and Android box (Fully Kiosk Browser → start URL `{APP_URL}/player`, kiosk mode + keep screen on).

## 18. Acceptance checklist — every item must pass before done

1. Log in as seeded super admin.
2. Upload a jpg and an mp4 → correct thumbs, sizes, video duration.
3. Create folder, move a file in, rename it; search, sort, and each filter work.
4. Set an expiration in the past → Expired badge → "Delete expired content" removes it.
5. Build a playlist on a seeded screen (image 5s → video → website); drag-reorder and duration edits persist; `playlist_version` increments.
6. Create a group with both seeded screens → assigning/removing updates `group_id`; group playlist edits touch both screens' versions.
7. Org isolation verified: content/screens created in org A never appear under org B; anon-key queries return zero rows (RLS confirmed).
8. Open `/player` in a second browser → pairing code shows; Add Screen with the code → player leaves pairing within 3s; card shows **Online** with last-seen ticking.
9. Playlist saves reach the player within seconds; Rotation 90° rotates it; Identify overlays the name; Reload reloads it.
10. Kill the player's network for 2 minutes → it keeps looping cached image/video; restore → heartbeat resumes, Online returns, offline/online events logged.
11. Delete a screen → that player returns to the pairing screen; its old token gets 401 on manifest.
12. Website item with 1m refresh reloads its iframe.
13. `pnpm build` passes with zero type errors; no source file exceeds ~300 lines.

## 19. Build order — connectivity last

1. Supabase schema + RLS + buckets + seed (incl. 2 placeholder screens)
2. Auth + app shell (navbar, theme, org switcher, middleware)
3. Content library + uploads + folders + expiration
4. Websites
5. Screens page + screen detail (runs fully against seeded screens)
6. Playlist editor + autosave + versioning + scheduling UI
7. Groups
8. Users / Organizations / Settings
9. **Device API**: pairing, manifest, heartbeat
10. **Player app**: pairing screen, playback engine, offline caching, rotation, schedule evaluation
11. **Realtime**: broadcast sync, live status, remote actions + cron
12. TV setup docs + full acceptance pass
