# MSIGN for Samsung TVs (Tizen)

A thin Tizen web app that opens the MSIGN player full screen. Everything you see on the TV is
the web player, so content, menus, sync and future features reach the TV **without a new
package**; the package only changes when this shell does.

This folder is the app source (`config.xml`, `index.html`, `icon.png`). Building, signing and
installing is done by **`tools\Install to Samsung.cmd`** once the one-time setup below is done.

Everything here is free: Tizen Studio, the certificates, and (if you ever go there) Samsung's
app store. The cost is one afternoon of setup and ~10 minutes per additional TV.

---

## Part 1 — One-time setup on your PC

1. **Install Tizen Studio** (free, ~2 GB): https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html
   Take the default install folder (`C:\tizen-studio` or `%USERPROFILE%\tizen-studio`).
2. Open **Tizen Studio Package Manager** (installed alongside) and add, under *Extension SDK*:
   - **TV Extensions** (Samsung TV) — brings the TV tools and `sdb`.
   - **Samsung Certificate Extension** — needed to create the TV signing certificate.
3. Restart Tizen Studio after the extensions install.

## Part 2 — Put the TV in Developer Mode (per TV, once)

1. Note the TV's IP: **Settings → General → Network → Network Status → IP Settings**.
2. On the TV remote, open **Apps**, then press **1 2 3 4 5** (on some remotes: highlight the Apps
   icon and press the number keys via the on-screen number pad). A *Developer mode* dialog appears.
3. **Developer mode: ON**. **Host PC IP: this PC's IP** (run `ipconfig` on the PC — the same
   Wi-Fi/LAN as the TV). OK.
4. **Power the TV off and on** (fully — hold the power button on the remote until it restarts).
   Developer mode does not take effect until the TV restarts.

## Part 3 — Create the signing certificate (once; needs your Samsung account)

Tizen installs only signed packages, and Samsung's *distributor* certificate is tied to each
TV's device ID (DUID). Do this once, then just add DUIDs for new TVs.

1. Tizen Studio → **Tools → Device Manager**. Click the *Remote Device Manager* (the little
   screen icon), **+** → enter the TV's IP, port **26101** → Add → toggle **Connection ON**.
   The TV appears in the device list once connected.
2. Still in Device Manager, **right-click the TV → DUID** (or select it: the DUID shows at the
   bottom). Copy it — you'll paste it in step 5.
3. Tizen Studio → **Tools → Certificate Manager** → **+** (New) → choose **Samsung** → **TV**.
   Profile name: **`MSIGN`** (the installer uses this name; if you pick another, pass
   `-Profile <name>` to the script).
4. **Author certificate**: *Create a new author certificate* → author name `MTech Distributors`,
   a password you'll remember → Next. (Keep the password; the profile needs it.)
5. **Distributor certificate**: *Create a new distributor certificate* → privilege **Public** →
   sign in with your **Samsung account** when asked → in the **DUID** list, paste the TV's DUID
   (add one line per TV; you can come back and add more later) → Finish.
6. The profile **MSIGN** now shows as active (✓) in Certificate Manager. Done.

Adding a TV later: Part 2 on the new TV, then Certificate Manager → select `MSIGN` → edit the
distributor certificate → add its DUID → save. Then install (Part 4). Existing TVs are unaffected.

## Part 3b — Rehearse on the TV emulator (no TV needed)

Tizen Studio ships a Samsung TV emulator that runs the real Samsung web engine and the real
install/signature checks, so the whole loop can be practised at the office the day before.

1. Tizen Studio → **Tools → Emulator Manager** → the VM **MSIGN-TV** (platform
   `tv-samsung-10.0`, 1080p) → **Launch**. (Create it if missing: *Create* → TV → tv-samsung-10.0
   → HD1080 TV.) It boots to the Samsung home screen in about a minute.
2. Get its DUID: double-click `tools\Install to Samsung.cmd`, type **`emulator`** at the IP
   prompt, or run `install-to-samsung.ps1 -Ip emulator -GetDuid`. Put that DUID in the `MSIGN`
   distributor certificate (Part 3, step 5) next to the real TVs' DUIDs.
3. Install exactly like a real TV: `Install to Samsung.cmd` → type **`emulator`**. The app
   builds, signs, installs and launches inside the emulator; the MSIGN code screen appears.
4. On the MSIGN site, **TVs → Get the sign-in code**, type it with the emulator's remote
   (click the on-screen remote, or use the keyboard). The emulator now plays that TV's content.

Video in the emulator is software-decoded and may stutter; that is the emulator, not the TV.
The emulator's DUID can stay in the certificate — it hurts nothing.

## Part 4 — Build, sign and install (per TV, ~1 minute)

Double-click **`tools\Install to Samsung.cmd`** and type the TV's IP (several: separate with
spaces). It:

1. builds the app from this folder (`tizen build-web`),
2. signs and packages it with the `MSIGN` profile (`tizen package -t wgt -s MSIGN`),
3. connects to the TV over Wi-Fi (`sdb connect <ip>:26101`),
4. installs the package (`sdb install …wgt`) and launches **MSIGN** on the TV.

On the TV: MSIGN shows *Starting…* briefly and then the **Enter this TV's code** screen. On the
MSIGN site, **TVs → Show code**, type the code on the TV. It's now that screen.

The app also appears in the TV's **Apps** row (icon: MSIGN), so it can be reopened from there.

## Part 4b — A store visit WITHOUT Tizen Studio (the "kit")

Only signing needs Tizen Studio, and that happens at the office. A laptop at the store needs just
two files next to `install-to-samsung.ps1` / `Install to Samsung.cmd`:

- **`sdb.exe`** — copy it from the office PC's `tizen-studio\tools\sdb.exe` (a small standalone
  tool). If it complains about a missing DLL, copy the neighbouring `*.dll` files from that folder too.
- **`msign.wgt`** — the signed package the office produced (the installer saves it as
  `tools\msign.wgt` after a build).

The first visit to a new store is a two-step handshake because the package is signed per TV:

1. **Store:** TVs into Developer Mode (Part 2, host = the store laptop's IP). Then
   `powershell -File install-to-samsung.ps1 -GetDuid 192.168.1.60 192.168.1.61 …` — it prints one
   **DUID** per TV and saves `duids.txt`. Send the list to the office.
2. **Office (2 min):** Certificate Manager → `MSIGN` profile → distributor certificate → add the
   DUIDs → save. Run **Install to Samsung.cmd** once against any TV (or `tizen package` alone) to
   produce a fresh signed `tools\msign.wgt`. Send it back.
3. **Store:** `powershell -File install-to-samsung.ps1 -Wgt msign.wgt 192.168.1.60 192.168.1.61 …`
   — installs and launches on every TV. Type each TV's code. Done.

Collect the DUIDs before the visit (a TV's ID is readable the moment it is in Developer Mode) and
it becomes a single trip. Samsung's app store removes the whole handshake.

## Part 5 — Make it start on its own

Consumer Samsung TVs don't auto-launch apps on power-on, but most have **Autorun Last App**:
**Settings → General → System Manager → Autorun Last App: ON** (path varies slightly by year —
search Settings for "Autorun"). With MSIGN as the last app open, powering the TV on brings it
straight back. Also turn **Settings → General → Power and Energy Saving → Screen Saver / Auto
Power Off** off, or the TV will sleep on a static menu.

---

## Troubleshooting

- **`sdb connect` says unreachable** — TV and PC on the same Wi-Fi? Developer mode ON with *this
  PC's* IP as the host? Did the TV fully restart after enabling it? Windows Firewall prompt for
  `sdb.exe` answered *Allow*?
- **Install fails with a signature / DUID / "certificate" error** — the TV's DUID isn't in the
  distributor certificate: Part 3 step 5, then run the installer again (it re-signs every time).
- **Packaging fails: profile not found** — the Certificate Manager profile isn't named `MSIGN`;
  rename it, or run `tools\install-to-samsung.ps1 <ip> -Profile <your name>`.
- **MSIGN shows "Can't reach MSIGN yet"** — the TV has no internet; it retries on its own.
- **Blank or "Starting MSIGN…" stays** — the TV's browser engine is too old (2019 and earlier
  sets). 2020+ Samsungs run the player; the M70H (2026) is fine.

## Notes

- App id `MSIGNtvApp.MSIGN` (package id must be exactly 10 alphanumerics). Version in
  `config.xml` — bump `version` when the shell changes so the TV updates the install.
- The launcher page probes the site before navigating so a TV that boots before Wi-Fi never lands
  on a dead browser error page; it retries with backoff.
- Going to Samsung's public app store later (free): Samsung Seller Portal → new TV app → upload
  the same `.wgt`; review takes 1–2 weeks. Then merchants install MSIGN from the TV's Apps store
  with no developer mode or certificates at all.
