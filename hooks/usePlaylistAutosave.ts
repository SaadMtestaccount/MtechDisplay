'use client'

/**
 * hooks/usePlaylistAutosave.ts — owns the editor's ordered item list and persists it per
 * docs/CONTRACTS.md §8: edits debounce 500 ms → PUT /api/playlists/{id}/items with the FULL
 * ordered list; saves are serialized (edits made during a save trigger another save after
 * it); the dirty/equality comparison uses `toPlaylistItemInput` output only (never
 * created_at/position); a beforeunload guard warns while dirty (browser navigation only);
 * `flush()` cancels the pending debounce and saves NOW with `keepalive: true` so the request
 * survives unmount (PlaylistEditor flushes on unmount — in-app <Link> navigation never fires
 * beforeunload). Server refetches (new `initialItems`) are adopted only while clean.
 * Toasts on error only; success is rendered by <SaveStatus>.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { toPlaylistItemInput } from '@/components/playlist/playlist-utils'
import { apiFetch } from '@/lib/api-client'
import type { PlaylistItemView, PlaylistView } from '@/types/api'

export type PlaylistAutosaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

const AUTOSAVE_DEBOUNCE_MS = 500

/** Canonical comparison form: the exact payload the server would receive. */
function serialize(items: PlaylistItemView[]): string {
  return JSON.stringify(toPlaylistItemInput(items))
}

export function usePlaylistAutosave({
  playlistId,
  initialItems,
  onSaved,
}: {
  playlistId: string
  initialItems: PlaylistItemView[]
  onSaved?: (view: PlaylistView) => void
}): {
  items: PlaylistItemView[]
  setItems(updater: (prev: PlaylistItemView[]) => PlaylistItemView[]): void
  status: PlaylistAutosaveStatus
  error: string | null
  flush(): Promise<void>
  lastSavedAt: Date | null
} {
  const [items, setItemsState] = useState<PlaylistItemView[]>(initialItems)
  const [status, setStatus] = useState<PlaylistAutosaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  const itemsRef = useRef<PlaylistItemView[]>(initialItems)
  const savedJsonRef = useRef<string>(serialize(initialItems))
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveRef = useRef<Promise<void> | null>(null)
  const keepaliveRef = useRef(false)
  const onSavedRef = useRef(onSaved)

  useEffect(() => {
    onSavedRef.current = onSaved
  }, [onSaved])

  /**
   * Serialized save loop: keeps PUTting the latest list until it matches what the server
   * has. At most one loop runs at a time; callers share its promise.
   */
  const runSave = useCallback((): Promise<void> => {
    if (saveRef.current) return saveRef.current
    const task = (async () => {
      try {
        while (serialize(itemsRef.current) !== savedJsonRef.current) {
          const inputs = toPlaylistItemInput(itemsRef.current)
          const json = JSON.stringify(inputs)
          setStatus('saving')
          try {
            const view = await apiFetch<PlaylistView>(`/api/playlists/${playlistId}/items`, {
              method: 'PUT',
              json: { items: inputs },
              keepalive: keepaliveRef.current,
            })
            savedJsonRef.current = json
            setError(null)
            setLastSavedAt(new Date())
            if (serialize(itemsRef.current) === json) {
              setStatus('saved')
              onSavedRef.current?.(view)
            }
            // else: the list changed mid-save — the loop saves again (serialized saves)
          } catch (e) {
            const message = e instanceof Error ? e.message : 'Save failed'
            setError(message)
            setStatus('error')
            toast.error(`Could not save playlist: ${message}`)
            return // the next edit (or flush) schedules a retry
          }
        }
      } finally {
        saveRef.current = null
      }
    })()
    saveRef.current = task
    return task
  }, [playlistId])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const setItems = useCallback(
    (updater: (prev: PlaylistItemView[]) => PlaylistItemView[]) => {
      const next = updater(itemsRef.current)
      itemsRef.current = next
      setItemsState(next)
      if (serialize(next) === savedJsonRef.current) {
        // the edit reverted to the saved list — nothing to persist
        clearTimer()
        if (!saveRef.current) setStatus((s) => (s === 'dirty' ? 'idle' : s))
        return
      }
      setStatus('dirty')
      clearTimer()
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        void runSave()
      }, AUTOSAVE_DEBOUNCE_MS)
    },
    [clearTimer, runSave],
  )

  /** Cancels the pending debounce and saves immediately (keepalive survives unmount). */
  const flush = useCallback((): Promise<void> => {
    clearTimer()
    keepaliveRef.current = true
    return runSave()
  }, [clearTimer, runSave])

  // Adopt server refetches (parent cache updates) only while clean; while dirty or saving
  // the local list wins and the next successful save reconciles.
  useEffect(() => {
    if (serialize(itemsRef.current) !== savedJsonRef.current) return
    itemsRef.current = initialItems
    setItemsState(initialItems)
    savedJsonRef.current = serialize(initialItems)
  }, [initialItems])

  // Browser navigation guard while unsaved changes exist (in-app navigation is covered by
  // the unmount flush instead — <Link> never fires beforeunload).
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (serialize(itemsRef.current) !== savedJsonRef.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  return { items, setItems, status, error, flush, lastSavedAt }
}
