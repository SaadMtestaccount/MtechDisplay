'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { TimezoneSelect } from '@/components/admin/TimezoneSelect'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { OrgUpdateInput } from '@/lib/validators/orgs'
import type { Organization } from '@/types/db'

/**
 * Name + timezone → PATCH /api/orgs/[id] → toast → router.refresh() so the navbar
 * and AppBootstrap.org pick up the change (docs/CONTRACTS.md §9.1).
 */
export function SettingsForm({ org }: { org: Organization }) {
  const [name, setName] = useState(org.name)
  const [timezone, setTimezone] = useState(org.timezone)
  const queryClient = useQueryClient()
  const router = useRouter()

  const mutation = useMutation({
    mutationFn: (input: OrgUpdateInput) =>
      apiFetch<Organization>(`/api/orgs/${org.id}`, { method: 'PATCH', json: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.orgs.all() })
      toast.success('Settings saved')
      router.refresh()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  const trimmed = name.trim()
  const dirty = trimmed !== org.name || timezone !== org.timezone

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!dirty || !trimmed || mutation.isPending) return
    mutation.mutate({
      ...(trimmed !== org.name ? { name: trimmed } : {}),
      ...(timezone !== org.timezone ? { timezone } : {}),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization</CardTitle>
        <CardDescription>
          The name appears in the admin and on players; the time zone drives every playlist schedule.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-settings-name">Name</Label>
            <Input
              id="org-settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
              disabled={mutation.isPending}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Time zone</Label>
            <TimezoneSelect value={timezone} onChange={setTimezone} />
          </div>
          <div>
            <Button type="submit" disabled={!dirty || !trimmed || mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
