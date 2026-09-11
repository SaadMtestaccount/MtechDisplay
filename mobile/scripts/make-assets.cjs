// mobile/scripts/make-assets.cjs — draws the source art @capacitor/assets needs (docs/CONTRACTS.md §24):
//   assets/icon.png            1024×1024 app icon (indigo tile, signal mark, MSIGN)
//   assets/icon-foreground.png 1024×1024 Android adaptive foreground (mark only, transparent)
//   assets/icon-background.png 1024×1024 Android adaptive background (indigo)
//   assets/splash.png          2732×2732 launch screen (indigo, mark centered)
//   ../public/apple-touch-icon.png 180×180 for Safari "Add to Home Screen"
//   ../public/icon-512.png 512×512 for the web manifest
// Run: pnpm assets:make   (then pnpm assets:generate to fan out every platform size)
const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const INDIGO = '#5b57e8'
const out = (...p) => path.join(__dirname, '..', ...p)
fs.mkdirSync(out('assets'), { recursive: true })

// The MSIGN mark: two arcs + a dot (a signal), drawn in a unit box of 512.
const mark = (x, y, s, color = '#ffffff') => `
  <g transform="translate(${x} ${y}) scale(${s / 512})" stroke="${color}" stroke-width="34" stroke-linecap="round" fill="none">
    <path d="M150 232 A76 76 0 0 1 226 308"/>
    <path d="M150 158 A150 150 0 0 1 300 308"/>
    <circle cx="150" cy="308" r="28" fill="${color}" stroke="none"/>
  </g>`

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${INDIGO}"/>
  ${mark(230, 150, 560)}
  <text x="512" y="880" text-anchor="middle" fill="#ffffff" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="190" font-weight="800" letter-spacing="14">MSIGN</text>
</svg>`

const foreground = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${mark(300, 250, 440)}
  <text x="512" y="800" text-anchor="middle" fill="#ffffff" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="140" font-weight="800" letter-spacing="10">MSIGN</text>
</svg>`

const background = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${INDIGO}"/></svg>`

const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <rect width="2732" height="2732" fill="${INDIGO}"/>
  ${mark(1086, 1000, 560)}
  <text x="1366" y="1760" text-anchor="middle" fill="#ffffff" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="150" font-weight="800" letter-spacing="12">MSIGN</text>
</svg>`

;(async () => {
  await sharp(Buffer.from(icon)).png().toFile(out('assets', 'icon.png'))
  await sharp(Buffer.from(foreground)).png().toFile(out('assets', 'icon-foreground.png'))
  await sharp(Buffer.from(background)).png().toFile(out('assets', 'icon-background.png'))
  await sharp(Buffer.from(splash)).png().toFile(out('assets', 'splash.png'))
  await sharp(Buffer.from(icon)).resize(180, 180).png().toFile(out('..', 'public', 'apple-touch-icon.png'))
  await sharp(Buffer.from(icon)).resize(512, 512).png().toFile(out('..', 'public', 'icon-512.png'))
  await sharp(Buffer.from(icon)).resize(192, 192).png().toFile(out('..', 'public', 'icon-192.png'))
  for (const f of ['icon.png', 'icon-foreground.png', 'icon-background.png', 'splash.png']) {
    const m = await sharp(out('assets', f)).metadata()
    console.log(f, `${m.width}x${m.height}`)
  }
})()
