// mobile/scripts/fanout-assets.cjs — writes every icon/splash size the native projects use from
// assets/icon.png, assets/icon-foreground.png and assets/splash.png (docs/CONTRACTS.md §24).
// Replaces `@capacitor/assets generate` (its pinned image library does not run on current Node).
// Run after `cap add ios|android`:  pnpm assets:fanout
const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const INDIGO = '#5b57e8'
const root = path.join(__dirname, '..')
const src = (f) => path.join(root, 'assets', f)
const iosAssets = path.join(root, 'ios', 'App', 'App', 'Assets.xcassets')
const res = path.join(root, 'android', 'app', 'src', 'main', 'res')

async function png(input, out, width, height, opts = {}) {
  fs.mkdirSync(path.dirname(out), { recursive: true })
  let img = sharp(input).resize(width, height, { fit: opts.fit ?? 'cover', background: INDIGO })
  if (opts.round) {
    const mask = Buffer.from(`<svg width="${width}" height="${height}"><circle cx="${width / 2}" cy="${height / 2}" r="${width / 2}"/></svg>`)
    img = img.composite([{ input: mask, blend: 'dest-in' }])
  }
  await img.png().toFile(out)
}

;(async () => {
  let n = 0
  // --- iOS ---
  if (fs.existsSync(iosAssets)) {
    await png(src('icon.png'), path.join(iosAssets, 'AppIcon.appiconset', 'AppIcon-512@2x.png'), 1024, 1024); n++
    for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
      await png(src('splash.png'), path.join(iosAssets, 'Splash.imageset', f), 2732, 2732); n++
    }
  } else console.log('ios project not found — skipped (run `npx cap add ios` first)')

  // --- Android ---
  if (fs.existsSync(res)) {
    const launcher = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
    const foreground = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 }
    for (const [d, size] of Object.entries(launcher)) {
      await png(src('icon.png'), path.join(res, `mipmap-${d}`, 'ic_launcher.png'), size, size); n++
      await png(src('icon.png'), path.join(res, `mipmap-${d}`, 'ic_launcher_round.png'), size, size, { round: true }); n++
      await png(src('icon-foreground.png'), path.join(res, `mipmap-${d}`, 'ic_launcher_foreground.png'), foreground[d], foreground[d]); n++
    }
    fs.writeFileSync(
      path.join(res, 'values', 'ic_launcher_background.xml'),
      `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${INDIGO.toUpperCase()}</color>\n</resources>\n`,
    )
    const port = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] }
    for (const [d, [w, h]] of Object.entries(port)) {
      await png(src('splash.png'), path.join(res, `drawable-port-${d}`, 'splash.png'), w, h); n++
      await png(src('splash.png'), path.join(res, `drawable-land-${d}`, 'splash.png'), h, w); n++
    }
    await png(src('splash.png'), path.join(res, 'drawable', 'splash.png'), 480, 320); n++
  } else console.log('android project not found — skipped (run `npx cap add android` first)')
  console.log(`wrote ${n} images`)
})()
