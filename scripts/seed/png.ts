/**
 * scripts/seed/png.ts — dependency-free PNG encoder for the seed placeholders.
 * RGBA scanlines (filter byte 0) → zlib deflate → IHDR / IDAT / IEND chunks with CRC32.
 */
import * as zlib from 'node:zlib'

export type Rgb = { r: number; g: number; b: number }

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

// --- CRC32 ------------------------------------------------------------------
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32Table(buf: Buffer): number {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** zlib.crc32 exists on Node >= 22.2 (not typed in @types/node 20); fall back to the table. */
function crc32(buf: Buffer): number {
  const maybe: unknown = (zlib as Record<string, unknown>)['crc32']
  if (typeof maybe === 'function') {
    const result: unknown = (maybe as (data: Buffer) => unknown)(buf)
    if (typeof result === 'number') return result >>> 0
  }
  return crc32Table(buf)
}

// --- Chunks -------------------------------------------------------------------
function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData), 0)
  return Buffer.concat([length, typeAndData, crc])
}

/** Encode an RGBA image from a per-pixel color callback. */
export function encodePng(width: number, height: number, pixel: (x: number, y: number) => Rgb): Buffer {
  const stride = width * 4 + 1
  const raw = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const rowStart = y * stride
    raw[rowStart] = 0 // filter: none
    for (let x = 0; x < width; x++) {
      const { r, g, b } = pixel(x, y)
      const o = rowStart + 1 + x * 4
      raw[o] = r
      raw[o + 1] = g
      raw[o + 2] = b
      raw[o + 3] = 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([PNG_SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)))
}

function lighten(c: Rgb, amount: number): Rgb {
  return { r: clamp(c.r + (255 - c.r) * amount), g: clamp(c.g + (255 - c.g) * amount), b: clamp(c.b + (255 - c.b) * amount) }
}

/**
 * Solid fill with a lighter diagonal band and a subtle vertical gradient so each
 * placeholder is visibly different. Works at any size (band scales with the image).
 */
export function makePlaceholder(width: number, height: number, base: Rgb): Buffer {
  const bandCenter = 0.55
  const bandHalfWidth = 0.09
  return encodePng(width, height, (x, y) => {
    const t = (x / width + y / height) / 2
    const inBand = Math.abs(t - bandCenter) < bandHalfWidth
    const gradient = 0.12 * (y / height)
    const color = lighten(base, gradient)
    return inBand ? lighten(color, 0.22) : color
  })
}
