'use client'

/**
 * components/admin/MerchantsSection.tsx — merchant TV accounts under /admin/users
 * (addendum §13): list + add + remove. Removal deletes the auth user (memberships cascade)
 * via the existing DELETE /api/users/[id].
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TvIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { MerchantDialog } from '@/components/admin/MerchantDialog'
import { ConfirmDialog } from '@/components/shell/ConfirmDialog'
import { KebabMenu } from '@/components/shell/KebabMenu'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { relativeTime } from '@/lib/utils'
import type { MerchantView, OkResponse } from '@/types/api'

export function MerchantsSection() {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<MerchantView | null>(null)

  const merchantsQuery = useQuery({
    queryKey: queryKeys.merchants.list(),
    queryFn: () => apiFetch<MerchantView[]>('/api/merchants'),
  })

  const removeMutation = useMutation({
    mutationFn: (target: MerchantView) => apiFetch<OkResponse>(`/api/users/${target.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.merchants.all() })
      toast.success('Merchant account removed')
      setRemoveTarget(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Something went wrong'),
  })

  return (
    <section className="mt-10 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Merchant accounts</h2>
          <p className="text-sm text-muted-foreground">
            TV sign-ins for merchants — each account plays its organization&apos;s content and cannot
            access this console.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
          <TvIcon /> Add merchant
        </Button>
      </div>

      {merchantsQuery.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : merchantsQuery.isError ? (
        <p className="text-sm text-destructive">
          {merchantsQuery.error instanceof Error ? merchantsQuery.error.message : 'Could not load merchants.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Email</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-12 pr-4 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {merchantsQuery.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No merchant accounts yet. Add one and hand the credentials to the merchant.
                  </TableCell>
                </TableRow>
              ) : (
                merchantsQuery.data.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="pl-4 font-medium">{m.email}</TableCell>
                    <TableCell className="text-muted-foreground">{m.org_name}</TableCell>
                    <TableCell className="text-muted-foreground">{relativeTime(m.last_sign_in_at)}</TableCell>
                    <TableCell className="text-muted-foreground">{relativeTime(m.created_at)}</TableCell>
                    <TableCell className="pr-4 text-right">
                      <KebabMenu
                        label={`Actions for ${m.email}`}
                        items={[{ label: 'Remove', destructive: true, onSelect: () => setRemoveTarget(m) }]}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <MerchantDialog open={addOpen} onOpenChange={setAddOpen} />

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null)
        }}
        title={removeTarget ? `Remove ${removeTarget.email}?` : 'Remove merchant'}
        description="Their TV sign-in stops working. Screens already set up keep playing until deleted."
        confirmLabel="Remove"
        destructive
        loading={removeMutation.isPending}
        onConfirm={() => {
          if (removeTarget && !removeMutation.isPending) removeMutation.mutate(removeTarget)
        }}
      />
    </section>
  )
}
