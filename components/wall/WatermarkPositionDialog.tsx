'use client'

/**
 * components/wall/WatermarkPositionDialog.tsx — full-screen preview of one TV where MTech staff
 * drag the "Powered by MTech" badge (or click anywhere on the preview to place it) and Save →
 * PATCH /api/screens/[id] { watermark } (docs/CONTRACTS.md §18). The stage matches the TV's
 * orientation and declares `container-type: size`, so the badge renders exactly as on the TV.
 * The position is the badge centre as fractions of the stage, clamped so it stays fully inside.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { toast } from 'sonner'
import { WatermarkBadge, watermarkStyle } from '@/components/player/Watermark'
import { Button } from '@/components/ui/button'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { ScreenView, WatermarkPosition } from '@/types/api'

function savedPosition(screen: ScreenView): WatermarkPosition | null {
  return screen.watermark_x !== null && screen.watermark_y !== null
    ? { x: screen.watermark_x, y: screen.watermark_y }
    : null
}

export function WatermarkPositionDialog({
  screen,
  onOpenChange,
}: {
  screen: ScreenView | null
  onOpenChange(open: boolean): void
}) {
  const { org } = useApp()
  const queryClient = useQueryClient()
  const stageRef = useRef<HTMLDivElement | null>(null)
  const badgeRef = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{ dx: number; dy: number } | null>(null)
  const [pos, setPos] = useState<WatermarkPosition | null>(null)

  useEffect(() => {
    if (screen) setPos(savedPosition(screen))
  }, [screen])

  useEffect(() => {
    if (!screen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [screen, onOpenChange])

  const save = useMutation({
    mutationFn: (watermark: WatermarkPosition | null) =>
      apiFetch<ScreenView>(`/api/screens/${screen?.id}`, { method: 'PATCH', json: { watermark } }),
    onSuccess: (_s, watermark) => {
      if (org) void queryClient.invalidateQueries({ queryKey: queryKeys.screens.all(org.id) })
      toast.success(watermark ? 'Watermark position saved — the TV updates in a moment' : 'Watermark back in the corner')
      onOpenChange(false)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  /** Move the badge centre to a viewport point (minus the grab offset), clamped inside the stage. */
  const moveTo = useCallback((clientX: number, clientY: number) => {
    const stage = stageRef.current
    const badge = badgeRef.current
    if (!stage || !badge) return
    const s = stage.getBoundingClientRect()
    const b = badge.getBoundingClientRect()
    const off = drag.current ?? { dx: 0, dy: 0 }
    const hx = b.width / 2 / s.width
    const hy = b.height / 2 / s.height
    const x = Math.min(1 - hx, Math.max(hx, (clientX - off.dx - s.left) / s.width))
    const y = Math.min(1 - hy, Math.max(hy, (clientY - off.dy - s.top) / s.height))
    setPos({ x, y })
  }, [])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    const badge = badgeRef.current
    const onBadge = badge !== null && badge.contains(e.target as Node)
    if (onBadge && badge) {
      // Grabbed the badge: keep the grab point under the pointer instead of jumping to centre.
      const b = badge.getBoundingClientRect()
      drag.current = { dx: e.clientX - (b.left + b.width / 2), dy: e.clientY - (b.top + b.height / 2) }
    } else {
      drag.current = { dx: 0, dy: 0 }
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    moveTo(e.clientX, e.clientY)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current) moveTo(e.clientX, e.clientY)
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  if (!screen) return null

  const portrait = screen.orientation === 'portrait'
  const thumb = screen.current_item?.thumb_url ?? screen.preview_thumb_url
  const stageStyle: CSSProperties = portrait
    ? { height: 'min(calc(100vh - 7.5rem), calc(92vw * 16 / 9))', aspectRatio: '9 / 16', containerType: 'size' }
    : { width: 'min(92vw, calc((100vh - 7.5rem) * 16 / 9))', aspectRatio: '16 / 9', containerType: 'size' }
  const dirty = JSON.stringify(pos) !== JSON.stringify(savedPosition(screen))

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Position the watermark on ${screen.name}`}
      className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div>
          <div className="text-base font-semibold">Position the watermark — {screen.name}</div>
          <div className="text-sm text-white/60">
            Drag the badge, or click anywhere on the preview to put it there. Save applies it to this TV.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="text-white hover:bg-white/10 hover:text-white"
            disabled={save.isPending || (pos === null && savedPosition(screen) === null)}
            onClick={() => (savedPosition(screen) === null ? setPos(null) : save.mutate(null))}
          >
            Reset to corner
          </Button>
          <Button
            variant="outline"
            className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
            disabled={save.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={save.isPending || !dirty}
            onClick={() => {
              if (dirty) save.mutate(pos)
            }}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-4">
        <div
          ref={stageRef}
          className="relative cursor-crosshair touch-none overflow-hidden bg-black ring-1 ring-white/20 select-none"
          style={stageStyle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {thumb ? (
            <img src={thumb} alt="" draggable={false} className="absolute inset-0 size-full object-contain" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-sm text-white/40">
              Nothing is assigned to this TV yet — the badge sits over the standby screen the same way.
            </div>
          )}
          <WatermarkBadge
            ref={badgeRef}
            style={watermarkStyle(pos)}
            className="pointer-events-auto cursor-grab ring-2 ring-primary active:cursor-grabbing"
          />
        </div>
      </div>
    </div>
  )
}
