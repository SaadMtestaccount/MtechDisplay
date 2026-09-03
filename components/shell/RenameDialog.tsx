'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** The caller closes the dialog after `onSubmit` succeeds. */
export function RenameDialog({
  open,
  onOpenChange,
  title,
  label = 'Name',
  initialValue,
  onSubmit,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  title: string
  label?: string
  initialValue: string
  onSubmit(value: string): Promise<void>
}) {
  const [value, setValue] = useState(initialValue)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setValue(initialValue)
  }, [open, initialValue])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || saving) return
    setSaving(true)
    try {
      await onSubmit(trimmed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="rename-value">{label}</Label>
            <Input
              id="rename-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={120}
              autoFocus
              disabled={saving}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <Button type="submit" disabled={saving || !value.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
