/**
 * lib/thumbs.ts — BROWSER ONLY. Uses File, Image, HTMLVideoElement and canvas.
 * Never import this module from server code (route handlers, lib/* that take a DbClient,
 * scripts). Consumed by lib/upload-client.ts / hooks/useUpload.ts.
 */

export type ImageMeta = { width: number; height: number }
export type VideoMeta = { width: number; height: number; duration_seconds: number }

const THUMB_QUALITY = 0.82
const DEFAULT_MAX_WIDTH = 640

function withObjectUrl<T>(file: File, fn: (url: string) => Promise<T>): Promise<T> {
  const url = URL.createObjectURL(file)
  return fn(url).finally(() => URL.revokeObjectURL(url))
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode image'))
    img.src = url
  })
}

function loadVideoMetadata(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.onloadedmetadata = () => resolve(video)
    video.onerror = () => reject(new Error('Could not read video metadata'))
    video.src = url
  })
}

function seekVideo(video: HTMLVideoElement, seconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('Could not seek video'))
    }
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
    }
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('error', onError)
    video.currentTime = seconds
  })
}

function drawToJpeg(source: CanvasImageSource, width: number, height: number, maxWidth: number): Promise<Blob> {
  const scale = width > maxWidth ? maxWidth / width : 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Canvas 2D context unavailable'))
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode thumbnail'))),
      'image/jpeg',
      THUMB_QUALITY,
    )
  })
}

export async function extractImageMeta(file: File): Promise<ImageMeta> {
  return withObjectUrl(file, async (url) => {
    const img = await loadImage(url)
    return { width: img.naturalWidth, height: img.naturalHeight }
  })
}

/** `<video preload="metadata">` → loadedmetadata */
export async function extractVideoMeta(file: File): Promise<VideoMeta> {
  return withObjectUrl(file, async (url) => {
    const video = await loadVideoMetadata(url)
    const meta = { width: video.videoWidth, height: video.videoHeight, duration_seconds: video.duration }
    video.removeAttribute('src')
    video.load()
    return meta
  })
}

/** canvas → image/jpeg q0.82; default maxWidth 640 (gif: first frame). */
export async function makeImageThumb(file: File, maxWidth: number = DEFAULT_MAX_WIDTH): Promise<Blob> {
  return withObjectUrl(file, async (url) => {
    const img = await loadImage(url)
    return drawToJpeg(img, img.naturalWidth, img.naturalHeight, maxWidth)
  })
}

/** Seeks to min(atSeconds, duration / 2) (default 1s) and captures the frame as jpeg. */
export async function captureVideoFrame(file: File, atSeconds: number = 1): Promise<Blob> {
  return withObjectUrl(file, async (url) => {
    const video = await loadVideoMetadata(url)
    const duration = Number.isFinite(video.duration) ? video.duration : atSeconds
    const target = Math.max(0, Math.min(atSeconds, duration / 2))
    await seekVideo(video, target)
    const blob = await drawToJpeg(video, video.videoWidth, video.videoHeight, DEFAULT_MAX_WIDTH)
    video.removeAttribute('src')
    video.load()
    return blob
  })
}
