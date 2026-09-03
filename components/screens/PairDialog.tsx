'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useApp } from '@/hooks/useApp'
import { apiFetch, ApiClientError } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { PAIRING_CODE_ALPHABET, PAIRING_CODE_LENGTH, type ScreenView } from '@/types/api'
import type { ClaimScreenInput } from '@/lib/validators/screens'

/** Keep only alphabet characters, upper-cased, capped at the code length. */
function sanitizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .split('')
    .filter((ch) => PAIRING_CODE_ALPHABET.includes(ch))
    .join('')
    .slice(0, PAIRING_CODE_LENGTH)
}

/** Pairs into the ACTIVE org — no org select (docs/CONTRACTS.md §0.4). */
export function PairDialog({
  open,
  onOpenChange,
  onPaired,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  onPaired?(screen: ScreenView): void
}) {
  const { org } = useApp()
  const queryClient = useQueryClient()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')

  useEffect(() => {
    if (open) {
      setCode('')
      setName('')
    }
  }, [open])

  const mutation = useMutation({
    mutationFn: (input: ClaimScreenInput) =>
      apiFetch<ScreenView>('/api/screens/claim', { method: 'POST', json: input }),
    onSuccess: (screen) => {
      if (org) void queryClient.invalidateQueries({ queryKey: queryKeys.screens.all(org.id) })
      toast.success(`"${screen.name}" paired`)
      onOpenChange(false)
      onPaired?.(screen)
    },
    onError: (e) => {
      if (e instanceof ApiClientError && e.status === 404) toast.error('Code not found or expired')
      else if (e instanceof ApiClientError && e.status === 409) toast.error('Code already claimed')
      else toast.error(e instanceof Error ? e.message : 'Something went wrong')
    },
  })

  const canSubmit = code.length === PAIRING_CODE_LENGTH && name.trim().length > 0 && !mutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    mutation.mutate({ code, name: name.trim() })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Screen</DialogTitle>
          <DialogDescription>
            Enter the code shown on the TV. Pairing into {org?.name ?? 'your organization'}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pair-code">Pairing code</Label>
            <Input
              id="pair-code"
              value={code}
              onChange={(e) => setCode(sanitizeCode(e.target.value))}
              maxLength={PAIRING_CODE_LENGTH}
              placeholder="ABCD23"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              disabled={mutation.isPending}
              className="h-12 text-center font-mono text-2xl tracking-widest uppercase"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pair-name">Screen name</Label>
            <Input
              id="pair-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lobby TV"
              maxLength={120}
              disabled={mutation.isPending}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <Button type="submit" disabled={!canSubmit}>
              {mutation.isPending ? 'Pairing…' : 'Pair screen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
