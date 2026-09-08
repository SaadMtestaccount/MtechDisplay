'use client'

/**
 * components/wall/ScreenCodeDialog.tsx — shows a TV's login code (copy) and lets you regenerate it
 * (docs/CONTRACTS.md §15). Regenerating logs out the TV currently using the code. The `screen`
 * prop is the snapshot the dialog was opened with; a regenerate renders from the ScreenView the
 * API returns, so the new code shows immediately without closing and reopening.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckIcon, CopyIcon, RefreshCwIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shell/ConfirmDialog'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { formatLoginCode } from '@/lib/utils'
import type { ScreenView } from '@/types/api'

export function ScreenCodeDialog({
  screen,
  onOpenChange,
}: {
  screen: ScreenView | null
  onOpenChange(open: boolean): void
}) {
  const { org } = useApp()
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)
  // Freshest view of the screen after a regenerate; cleared whenever the dialog targets a new screen.
  const [latest, setLatest] = useState<ScreenView | null>(null)
  useEffect(() => setLatest(null), [screen?.id])
  const view = latest && latest.id === screen?.id ? latest : screen

  const regen = useMutation({
    mutationFn: () => apiFetch<ScreenView>(`/api/screens/${screen?.id}/regenerate-code`, { method: 'POST' }),
    onSuccess: (updated) => {
      setLatest(updated)
      if (org) void queryClient.invalidateQueries({ queryKey: queryKeys.screens.all(org.id) })
      toast.success('New code generated — that TV was logged out')
      setConfirmRegen(false)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  const code = formatLoginCode(view?.login_code)
  const copy = () => {
    void navigator.clipboard?.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <>
      <Dialog open={screen !== null} onOpenChange={onOpenChange}>
        <DialogContent>
          {view ? (
            <>
              <DialogHeader>
                <DialogTitle>Log “{view.name}” in</DialogTitle>
                <DialogDescription>
                  On the TV, open MSIGN and type this code. It stays the same until you regenerate it.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-3 py-4">
                <div
                  key={view.login_code ?? ''}
                  className="rounded-xl border border-border bg-muted px-6 py-4 font-mono text-4xl font-bold tracking-[0.15em]"
                >
                  {code}
                </div>
                <Button variant="outline" size="sm" onClick={copy}>
                  {copied ? (
                    <>
                      <CheckIcon /> Copied
                    </>
                  ) : (
                    <>
                      <CopyIcon /> Copy code
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {view.paired ? 'A TV is logged in with this code.' : 'Waiting for a TV to sign in…'}
                </p>
              </div>
              <DialogFooter className="sm:justify-between">
                <Button variant="outline" onClick={() => setConfirmRegen(true)} disabled={regen.isPending}>
                  <RefreshCwIcon /> Regenerate
                </Button>
                <DialogClose render={<Button type="button" />}>Done</DialogClose>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmRegen}
        onOpenChange={setConfirmRegen}
        title="Regenerate the code?"
        description="This makes a new code and immediately logs out the TV currently using this one — it will show the sign-in screen until the new code is entered."
        confirmLabel="Regenerate"
        destructive
        loading={regen.isPending}
        onConfirm={() => {
          if (!regen.isPending) regen.mutate()
        }}
      />
    </>
  )
}
