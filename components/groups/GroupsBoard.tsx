'use client'

import { useQuery } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { DeleteGroupDialog } from '@/components/groups/DeleteGroupDialog'
import { GroupCard } from '@/components/groups/GroupCard'
import { GroupDialog } from '@/components/groups/GroupDialog'
import { GroupsEmptyState } from '@/components/groups/GroupsEmptyState'
import { ManageScreensDialog } from '@/components/groups/ManageScreensDialog'
import { EmptyState } from '@/components/shell/EmptyState'
import { ListToolbar } from '@/components/shell/ListToolbar'
import { NoOrgState } from '@/components/shell/NoOrgState'
import { PageHeader } from '@/components/shell/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/hooks/useApp'
import { apiFetch, buildQuery } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { GROUP_SORTS, type GroupListQuery, type GroupSort, type GroupView } from '@/types/api'

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'newest', label: 'Newest' },
]

/** /groups page component: header + toolbar + card grid + all group dialogs. */
export function GroupsBoard() {
  const { org } = useApp()
  const router = useRouter()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<GroupSort>('name')
  const [createOpen, setCreateOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<GroupView | null>(null)
  const [manageTarget, setManageTarget] = useState<GroupView | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GroupView | null>(null)
  const orgId = org?.id ?? null

  const params: GroupListQuery = { q: q || undefined, sort }
  const groupsQuery = useQuery({
    queryKey: queryKeys.groups.list(orgId ?? 'none', params),
    queryFn: () => apiFetch<GroupView[]>(`/api/groups${buildQuery({ q: params.q, sort: params.sort })}`),
    enabled: orgId !== null,
  })

  if (!org) return <NoOrgState />

  const groups = groupsQuery.data
  const handleAction = (action: 'edit' | 'rename' | 'screens' | 'delete', group: GroupView) => {
    if (action === 'edit') router.push(`/groups/${group.id}`)
    else if (action === 'rename') setRenameTarget(group)
    else if (action === 'screens') setManageTarget(group)
    else setDeleteTarget(group)
  }

  return (
    <>
      <PageHeader
        title="Groups"
        primary={
          <Button variant="outline" onClick={() => setCreateOpen(true)}>
            <PlusIcon />
            Add Screen Group
          </Button>
        }
      >
        <ListToolbar
          search={q}
          onSearchChange={setQ}
          sort={{
            value: sort,
            options: SORT_OPTIONS,
            onChange: (v) => {
              const match = GROUP_SORTS.find((s) => s === v)
              if (match) setSort(match)
            },
          }}
        />
      </PageHeader>

      {groupsQuery.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : groupsQuery.isError ? (
        <EmptyState
          title="Couldn't load groups"
          description={groupsQuery.error instanceof Error ? groupsQuery.error.message : 'Something went wrong.'}
          action={<Button variant="outline" onClick={() => void groupsQuery.refetch()}>Try again</Button>}
        />
      ) : groups && groups.length === 0 ? (
        q ? (
          <EmptyState title="No groups found" description="Try a different search." />
        ) : (
          <GroupsEmptyState onCreate={() => setCreateOpen(true)} />
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(groups ?? []).map((group) => (
            <GroupCard key={group.id} group={group} onAction={(action) => handleAction(action, group)} />
          ))}
        </div>
      )}

      <GroupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(g) => router.push(`/groups/${g.id}`)}
      />
      <GroupDialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null)
        }}
        group={renameTarget ?? undefined}
      />
      <ManageScreensDialog
        group={manageTarget}
        onOpenChange={(open) => {
          if (!open) setManageTarget(null)
        }}
      />
      <DeleteGroupDialog
        group={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      />
    </>
  )
}
