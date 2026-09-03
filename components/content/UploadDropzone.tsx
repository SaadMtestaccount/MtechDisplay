'use client'

import { UploadIcon } from 'lucide-react'
import { useRef, useState, type DragEvent, type ReactNode } from 'react'

function hasFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes('Files')
}

/**
 * Wraps the /content page; renders a full-page overlay while a file drag is over it and hands
 * dropped files to the upload queue (docs/CONTRACTS.md §9.2). Validation (mime/size) happens
 * in useUpload.addFiles.
 */
export function UploadDropzone({
  onFiles,
  disabled = false,
  children,
}: {
  onFiles(files: File[]): void
  disabled?: boolean
  children: ReactNode
}) {
  const [dragging, setDragging] = useState(false)
  const depth = useRef(0)

  const onDragEnter = (e: DragEvent<HTMLDivElement>) => {
    if (disabled || !hasFiles(e)) return
    e.preventDefault()
    depth.current += 1
    setDragging(true)
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (disabled || !hasFiles(e)) return
    e.preventDefault()
  }

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (disabled || !hasFiles(e)) return
    depth.current = Math.max(0, depth.current - 1)
    if (depth.current === 0) setDragging(false)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    if (disabled) return
    e.preventDefault()
    depth.current = 0
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) onFiles(files)
  }

  return (
    <div
      className="relative min-h-full"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}
      {dragging ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-8 backdrop-blur-sm">
          <div className="flex w-full max-w-lg flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary bg-card px-8 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UploadIcon className="size-6" />
            </div>
            <p className="text-lg leading-[1.05] font-semibold tracking-[-0.02em]">Drop files to upload</p>
            <p className="text-sm text-muted-foreground">JPG, PNG, WebP, GIF, MP4, WebM or MOV — up to 500 MB each.</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
