'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { FolderPlusIcon, ImageIcon, Trash2Icon, UploadIcon } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ContentBreadcrumb } from '@/components/content/ContentBreadcrumb'
import { type ContentCardAction } from '@/components/content/ContentCard'
import { ContentDialogs, type ContentFolderDialog, type ContentItemDialog } from '@/components/content/ContentDialogs'
import { ContentFilters } from '@/components/content/ContentFilters'
import { ContentGrid } from '@/components/content/ContentGrid'
import { UploadDropzone } from '@/components/content/UploadDropzone'
import { UploadProgress } from '@/components/content/UploadProgress'
import { EmptyState } from '@/components/shell/EmptyState'
import { KebabMenu } from '@/components/shell/KebabMenu'
import { ListToolbar } from '@/components/shell/ListToolbar'
import { NoOrgState } from '@/components/shell/NoOrgState'
import { PageHeader } from '@/components/shell/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/hooks/useApp'
import { useUpload } from '@/hooks/useUpload'
import { apiFetch, buildQuery } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import {
  ACCEPTED_MIMES, CONTENT_SORTS, type ContentListQuery, type ContentSort, type ContentView,
  type FolderView, type UrlResponse,
} from '@/types/api'
import type { ContentType } from '@/types/db'

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'size', label: 'Size' },
  { value: 'type', label: 'Type' },
]

const GRID_CLASS = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * /content page component (docs/CONTRACTS.md §9.2). Single source of truth for location is the
 * `folder` URL param: absent → root (unfiled files + folder cards), `folder=<uuid>` → that
 * folder (+ breadcrumb), `folder=all` → whole org. Searching from the root searches the whole
 * org (folder cards hide; cards show their folder caption); inside a folder search stays scoped.
 */
export function ContentLibrary() {
  const { org } = useApp()
  const orgId = org?.id ?? null
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const rawFolder = searchParams.get('folder')
  /** 'all' | folder uuid | undefined (= root view) */
  const folderParam = rawFolder === 'all' ? 'all' : rawFolder && UUID_RE.test(rawFolder) ? rawFolder : undefined
  const openFolderId = folderParam !== undefined && folderParam !== 'all' ? folderParam : null
  const isRoot = folderParam === undefined
  /** ContentListQuery encoding of the location: 'root' | uuid | undefined (= whole org). */
  const navFolderId = isRoot ? 'root' : folderParam === 'all' ? undefined : folderParam

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<ContentSort>('newest')
  const [type, setType] = useState<ContentType | undefined>(undefined)
  const [expiredOnly, setExpiredOnly] = useState(false)
  const [itemDialog, setItemDialog] = useState<ContentItemDialog | null>(null)
  const [folderDialog, setFolderDialog] = useState<ContentFolderDialog | null>(null)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [deleteExpiredOpen, setDeleteExpiredOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const q = search.trim() || undefined
  const rootSearch = isRoot && q !== undefined
  const showFolders = isRoot && q === undefined

  const params = useMemo<ContentListQuery>(
    () => ({ q, sort, type, folder_id: rootSearch ? undefined : navFolderId, expired: expiredOnly }),
    [q, sort, type, rootSearch, navFolderId, expiredOnly],
  )

  const foldersQuery = useQuery({
    queryKey: queryKeys.folders.list(orgId ?? '', {}),
    queryFn: () => apiFetch<FolderView[]>('/api/folders'),
    enabled: orgId !== null,
  })
  const contentQuery = useQuery({
    queryKey: queryKeys.content.list(orgId ?? '', params),
    queryFn: () => apiFetch<ContentView[]>(`/api/content${buildQuery({ ...params })}`),
    enabled: orgId !== null,
    placeholderData: keepPreviousData,
  })

  const { uploads, addFiles, cancel, clearFinished } = useUpload({ orgId: orgId ?? '', folderId: openFolderId })

  // An open folder that was deleted elsewhere → back to the root view.
  useEffect(() => {
    if (openFolderId !== null && foldersQuery.isSuccess && !foldersQuery.data.some((f) => f.id === openFolderId)) {
      router.replace(pathname)
    }
  }, [openFolderId, foldersQuery.isSuccess, foldersQuery.data, pathname, router])

  if (!org) return <NoOrgState />

  const folders = foldersQuery.data ?? []
  const items = contentQuery.data ?? []
  const visibleFolders = showFolders ? folders : []
  const openFolder = openFolderId !== null ? (folders.find((f) => f.id === openFolderId) ?? null) : null
  const loading = contentQuery.isPending || (showFolders && foldersQuery.isPending)
  const isEmpty =
    !loading && contentQuery.isSuccess && items.length === 0 && visibleFolders.length === 0
  const filtersActive = type !== undefined || expiredOnly

  const setFolderParam = (value: string | undefined) => {
    router.push(value === undefined ? pathname : `${pathname}?folder=${value}`)
  }

  const downloadItem = async (item: ContentView) => {
    try {
      const { url } = await apiFetch<UrlResponse>(`/api/content/${item.id}/url?download=1`)
      const a = document.createElement('a')
      a.href = url
      a.download = item.name
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start the download')
    }
  }

  const handleItemAction = (action: ContentCardAction, item: ContentView) => {
    if (action === 'download') void downloadItem(item)
    else setItemDialog({ kind: action, item })
  }

  const handleFiltersChange = (next: ContentListQuery) => {
    setType(next.type)
    setExpiredOnly(next.expired)
    if (next.folder_id !== navFolderId) {
      setFolderParam(next.folder_id === 'root' ? undefined : (next.folder_id ?? 'all'))
    }
  }

  const uploadButton = (
    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
      <UploadIcon />
      Upload Files
    </Button>
  )

  return (
    <UploadDropzone onFiles={addFiles}>
      <PageHeader
        title="Content"
        primary={uploadButton}
        menu={
          <KebabMenu
            label="Content actions"
            items={[
              { label: 'New folder', icon: <FolderPlusIcon />, onSelect: () => setNewFolderOpen(true) },
              {
                label: 'Delete expired content',
                icon: <Trash2Icon />,
                onSelect: () => setDeleteExpiredOpen(true),
                destructive: true,
                separatorBefore: true,
              },
            ]}
          />
        }
      >
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          sort={{
            value: sort,
            options: SORT_OPTIONS,
            onChange: (v) => {
              const next = CONTENT_SORTS.find((s) => s === v)
              if (next) setSort(next)
            },
          }}
          filters={
            <ContentFilters
              value={{ ...params, folder_id: navFolderId }}
              folders={folders}
              onChange={handleFiltersChange}
            />
          }
          activeFilterCount={(type !== undefined ? 1 : 0) + (expiredOnly ? 1 : 0) + (navFolderId !== 'root' ? 1 : 0)}
        />
      </PageHeader>
      {openFolderId !== null ? (
        <ContentBreadcrumb folder={openFolder} onRoot={() => setFolderParam(undefined)} />
      ) : null}
      {loading ? (
        <div className={GRID_CLASS}>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : contentQuery.isError ? (
        <EmptyState
          title="Could not load content"
          description={contentQuery.error instanceof Error ? contentQuery.error.message : 'Something went wrong.'}
          action={
            <Button variant="outline" onClick={() => void contentQuery.refetch()}>
              Try again
            </Button>
          }
        />
      ) : isEmpty && q !== undefined ? (
        <EmptyState title="No matches" description={`No content matches "${q}".`} />
      ) : isEmpty && filtersActive ? (
        <EmptyState title="No matches" description="No content matches the current filters." />
      ) : isEmpty && openFolderId !== null ? (
        <EmptyState
          icon={<ImageIcon />}
          title="This folder is empty"
          description="Upload files here, or move existing content into the folder."
          action={uploadButton}
        />
      ) : isEmpty ? (
        <EmptyState
          icon={<ImageIcon />}
          title="No content yet"
          description="Drag and drop images or videos anywhere on this page, or click Upload Files."
          action={uploadButton}
        />
      ) : (
        <ContentGrid
          folders={visibleFolders}
          items={items}
          onOpenFolder={(f) => setFolderParam(f.id)}
          onFolderAction={(action, f) => setFolderDialog({ kind: action, folder: f })}
          onItemAction={handleItemAction}
        />
      )}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_MIMES.join(',')}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length > 0) addFiles(files)
          e.target.value = ''
        }}
      />
      <UploadProgress uploads={uploads} onCancel={cancel} onClear={clearFinished} />
      <ContentDialogs
        folders={folders}
        itemDialog={itemDialog}
        onItemClose={() => setItemDialog(null)}
        folderDialog={folderDialog}
        onFolderClose={() => setFolderDialog(null)}
        newFolderOpen={newFolderOpen}
        onNewFolderOpenChange={setNewFolderOpen}
        deleteExpiredOpen={deleteExpiredOpen}
        onDeleteExpiredOpenChange={setDeleteExpiredOpen}
      />
    </UploadDropzone>
  )
}
