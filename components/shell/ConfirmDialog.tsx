'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Every delete goes through this. `confirmText` (when set) is the string the user must type
 * (org delete). The caller closes the dialog after `onConfirm` succeeds.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  confirmText,
  loading = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  title: string
  description?: ReactNode
  confirmLabel?: string
  destructive?: boolean
  confirmText?: string
  loading?: boolean
  onConfirm(): void | Promise<void>
}) {
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (!open) setTyped('')
  }, [open])

  const blocked = confirmText !== undefined && typed !== confirmText

  return (
    <AlertDialog open={open} onOpenChange={(next) => onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {typeof description === 'string' ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : description ? (
            <div className="text-sm text-muted-foreground">{description}</div>
          ) : null}
        </AlertDialogHeader>
        {confirmText !== undefined ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-text">
              Type <span className="font-semibold text-foreground">{confirmText}</span> to confirm
            </Label>
            <Input
              id="confirm-text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              disabled={loading}
            />
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={loading || blocked}
            onClick={() => void onConfirm()}
          >
            {loading ? 'Working…' : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
