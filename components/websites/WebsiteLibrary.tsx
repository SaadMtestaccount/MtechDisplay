'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState } from '@/components/shell/EmptyState'
import { ListToolbar } from '@/components/shell/ListToolbar'
import { NoOrgState } from '@/components/shell/NoOrgState'
import { PageHeader } from '@/components/shell/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DeleteWebsiteDialog } from '@/components/websites/DeleteWebsiteDialog'
import { IframeNotice } from '@/components/websites/IframeNotice'
import { WebsiteCard, type WebsiteCardAction } from '@/components/websites/WebsiteCard'
import { WebsiteDialog } from '@/components/websites/WebsiteDialog'
import { WebsitePreviewModal } from '@/components/websites/WebsitePreviewModal'
import { WebsitesEmptyState } from '@/components/websites/WebsitesEmptyState'
import { useApp } from '@/hooks/useApp'
import { apiFetch, buildQuery } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { WEBSITE_SORTS, type WebsiteListQuery, type WebsiteSort, type WebsiteView } from '@/types/api'

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
]

const GRID_CLASS = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

/** /websites page component (docs/CONTRACTS.md §9.3): toolbar state, query, cards, dialogs. */
export function WebsiteLibrary() {
  const { org } = useApp()
  const orgId = org?.id ?? null

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<WebsiteSort>('name')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<WebsiteView | undefined>(undefined)
  const [preview, setPreview] = useState<WebsiteView | null>(null)
  const [deleting, setDeleting] = useState<WebsiteView | null>(null)

  const params = useMemo<WebsiteListQuery>(() => ({ q: search.trim() || undefined, sort }), [search, sort])

  const websitesQuery = useQuery({
    queryKey: queryKeys.websites.list(orgId ?? '', params),
    queryFn: () => apiFetch<WebsiteView[]>(`/api/websites${buildQuery({ ...params })}`),
    enabled: orgId !== null,
    placeholderData: keepPreviousData,
  })

  if (!org) return <NoOrgState />

  const websites = websitesQuery.data ?? []
  const isEmpty = websitesQuery.isSuccess && websites.length === 0

  const openCreate = () => {
    setEditing(undefined)
    setDialogOpen(true)
  }

  const handleAction = (action: WebsiteCardAction, website: WebsiteView) => {
    if (action === 'edit') {
      setEditing(website)
      setDialogOpen(true)
    } else if (action === 'preview') {
      setPreview(website)
    } else if (action === 'open') {
      window.open(website.url, '_blank', 'noopener,noreferrer')
    } else {
      setDeleting(website)
    }
  }

  return (
    <>
      <PageHeader
        title="Websites"
        primary={
          <Button variant="outline" onClick={openCreate}>
            <PlusIcon />
            Add Website
          </Button>
        }
      >
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          sort={{
            value: sort,
            options: SORT_OPTIONS,
            onChange: (v) => {
              const next = WEBSITE_SORTS.find((s) => s === v)
              if (next) setSort(next)
            },
          }}
        />
      </PageHeader>
      <IframeNotice />
      {websitesQuery.isPending ? (
        <div className={GRID_CLASS}>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : websitesQuery.isError ? (
        <EmptyState
          title="Could not load websites"
          description={websitesQuery.error instanceof Error ? websitesQuery.error.message : 'Something went wrong.'}
          action={
            <Button variant="outline" onClick={() => void websitesQuery.refetch()}>
              Try again
            </Button>
          }
        />
      ) : isEmpty && !params.q ? (
        <WebsitesEmptyState onCreate={openCreate} />
      ) : isEmpty ? (
        <EmptyState title="No matches" description={`No websites match "${params.q}".`} />
      ) : (
        <div className={GRID_CLASS}>
          {websites.map((website) => (
            <WebsiteCard key={website.id} website={website} onAction={(action) => handleAction(action, website)} />
          ))}
        </div>
      )}
      <WebsiteDialog open={dialogOpen} onOpenChange={setDialogOpen} website={editing} />
      <WebsitePreviewModal website={preview} onClose={() => setPreview(null)} />
      <DeleteWebsiteDialog
        website={deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
      />
    </>
  )
}
