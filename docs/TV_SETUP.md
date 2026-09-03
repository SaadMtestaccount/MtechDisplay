# TV Setup Guide

The MSIGN player is just a web page. Any TV device with a modern browser can run it — no app
install from us, no port forwarding: the TV always dials out to MSIGN.

Wherever this guide says `{APP_URL}`, use your deployment's public URL (the
`NEXT_PUBLIC_APP_URL`, e.g. `https://signage.example.com`). The player lives at
`{APP_URL}/player`.

**Before you start:** the TV needs internet (Wi-Fi or Ethernet), and you need an MSIGN admin
login on a computer or phone.

## MSIGN TV app (APK) — the merchant path

The easiest route for merchants: sideload the MSIGN APK (built from `android/`, see
`android/README.md`) onto any Android TV, box, or stick — either send the file to the
merchant or preload it on a stick you ship them.

1. **Install the APK** (file manager → allow "Install unknown apps" → open the APK → Install).
2. **Create the merchant's login** in MSIGN: **Admin → Users → Merchant accounts → Add
   merchant** — type their email, keep or edit the generated password, pick their
   organization, and hand them both.
3. **The merchant opens MSIGN on the TV** and picks **"Merchant? Sign in with email
   instead"**, then enters those credentials. The TV registers itself as a screen in their
   organization (visible under **Screens** immediately) and starts playing.
4. If the organization has no content yet, the TV shows *"Please contact MTech with photos
   and videos of the digital menu."* — upload content and add it to the screen's playlist and
   the TV updates live.

The app keeps the screen awake, autoplays with sound, survives reboots (launch on boot where
the device allows it), and needs no browser setup. The pairing-code flow below still works in
the app too — the merchant login is just faster when MTech isn't on site.

## Amazon Fire TV Stick

1. **Install the Silk Browser.** From the Fire TV home screen, search for "Silk"
   (Amazon Silk Browser) in the Appstore, install it, and open it.
2. **Browse to `{APP_URL}/player`.** A big 6-character pairing code appears on the TV.
3. **Pair it.** In MSIGN, go to **Screens → Add Screen**, type the code and a name for the
   screen (e.g. "Front Window"), and confirm. The TV leaves the pairing screen and starts
   playing within a few seconds.
4. **Keep it running:**
   - **Disable device sleep** — Fire TV Settings → **Display & Sounds**: turn off the screen
     saver / display sleep so the stick never blanks the screen.
   - **Survive a power cycle** — set Silk to reopen the last page on launch, or set
     `{APP_URL}/player` as Silk's home page, so the player comes straight back after an
     outage.
   - **Tips:** leave HDMI-CEC on (the TV switches to the stick's input when it wakes), and
     power the stick from a mains USB adapter rather than the TV's USB port — TV ports are
     often underpowered and cut power when the TV turns off.

## Android TV box

1. **Install Fully Kiosk Browser** from the Play Store.
2. **Set the Start URL** to `{APP_URL}/player`.
3. In Fully Kiosk's settings, enable **Kiosk Mode**, **Keep Screen On**, **Launch on Boot**
   and fullscreen, and hide the status and navigation bars — the box now boots straight into
   the player and nothing else.
4. **Pair it** the same way: type the code from the TV under **Screens → Add Screen**.
5. Optional resilience: Fully Kiosk can auto-restart after a crash and reload the page on a
   schedule or after idle; its motion detection can wake the display when someone walks by if
   you prefer the screen to sleep off-hours.

## Pairing, in short (any device)

- The TV shows a **6-character code** (an unambiguous alphabet — there is no 0/O or 1/I).
- In MSIGN: **Screens → Add Screen** → type the code and a name → confirm.
- The TV starts playing within seconds. From the screen's card you can later **Identify**
  (shows the screen's name on the TV) or **Reload** the player remotely.

## Troubleshooting

- **The code stopped working** — pairing codes last 15 minutes and the player refreshes them
  automatically. Just type whatever code is currently showing on the TV.
- **The player isn't fullscreen** — click/tap the page once (press Select on the remote); the
  player asks the browser for fullscreen on the first tap. Kiosk-mode browsers are already
  fullscreen.
- **A website item shows a blank/black screen** — that site blocks being embedded in iframes
  (X-Frame-Options/CSP). Test any site with **Preview** on the Websites page: if it doesn't
  render there, it won't render on TVs.
- **The screen shows Offline in MSIGN** — check the TV's network. While offline the player
  keeps looping its cached images and videos (website items are skipped) and reconnects on
  its own; the screen flips back to Online with the next heartbeat, typically within a
  minute of the network returning.
