'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { DeleteContentDialog } from '@/components/content/DeleteContentDialog'
import { DeleteExpiredDialog } from '@/components/content/DeleteExpiredDialog'
import { ExpirationDialog } from '@/components/content/ExpirationDialog'
import { MoveDialog } from '@/components/content/MoveDialog'
import { NewFolderDialog } from '@/components/content/NewFolderDialog'
import { PreviewModal } from '@/components/content/PreviewModal'
import { ConfirmDialog } from '@/components/shell/ConfirmDialog'
import { RenameDialog } from '@/components/shell/RenameDialog'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { ContentView, FolderView, OkResponse } from '@/types/api'

/** Which per-item dialog is open (ContentLibrary state). */
export type ContentItemDialog = {
  kind: 'rename' | 'move' | 'expiration' | 'preview' | 'delete'
  item: ContentView
}
export type ContentFolderDialog = { kind: 'rename' | 'delete'; folder: FolderView }

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong'
}

/**
 * The /content dialog cluster (docs/CONTRACTS.md §9.2): per-item Rename (shell RenameDialog),
 * Move, Set expiration, Preview, Delete; folder Rename/Delete; New folder; Delete expired.
 */
export function ContentDialogs({
  folders,
  itemDialog,
  onItemClose,
  folderDialog,
  onFolderClose,
  newFolderOpen,
  onNewFolderOpenChange,
  deleteExpiredOpen,
  onDeleteExpiredOpenChange,
}: {
  folders: FolderView[]
  itemDialog: ContentItemDialog | null
  onItemClose(): void
  folderDialog: ContentFolderDialog | null
  onFolderClose(): void
  newFolderOpen: boolean
  onNewFolderOpenChange(open: boolean): void
  deleteExpiredOpen: boolean
  onDeleteExpiredOpenChange(open: boolean): void
}) {
  const { org } = useApp()
  const orgId = org?.id ?? null
  const queryClient = useQueryClient()

  const invalidateContent = () => {
    if (!orgId) return
    void queryClient.invalidateQueries({ queryKey: queryKeys.content.all(orgId) })
  }
  const invalidateFolders = () => {
    if (!orgId) return
    void queryClient.invalidateQueries({ queryKey: queryKeys.folders.all(orgId) })
  }

  const renameContent = async (value: string) => {
    if (!itemDialog) return
    try {
      await apiFetch<ContentView>(`/api/content/${itemDialog.item.id}`, { method: 'PATCH', json: { name: value } })
      invalidateContent()
      toast.success('Content renamed')
      onItemClose()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const renameFolder = async (value: string) => {
    if (!folderDialog) return
    try {
      await apiFetch<FolderView>(`/api/folders/${folderDialog.folder.id}`, { method: 'PATCH', json: { name: value } })
      invalidateFolders()
      invalidateContent()
      toast.success('Folder renamed')
      onFolderClose()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const deleteFolder = useMutation({
    mutationFn: (id: string) => apiFetch<OkResponse>(`/api/folders/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidateFolders()
      invalidateContent()
      toast.success('Folder deleted')
      onFolderClose()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const closeItemOn = (open: boolean) => {
    if (!open) onItemClose()
  }
  const closeFolderOn = (open: boolean) => {
    if (!open) onFolderClose()
  }

  return (
    <>
      <RenameDialog
        open={itemDialog?.kind === 'rename'}
        onOpenChange={closeItemOn}
        title="Rename content"
        initialValue={itemDialog?.kind === 'rename' ? itemDialog.item.name : ''}
        onSubmit={renameContent}
      />
      <MoveDialog
        item={itemDialog?.kind === 'move' ? itemDialog.item : null}
        folders={folders}
        onOpenChange={closeItemOn}
      />
      <ExpirationDialog item={itemDialog?.kind === 'expiration' ? itemDialog.item : null} onOpenChange={closeItemOn} />
      <PreviewModal item={itemDialog?.kind === 'preview' ? itemDialog.item : null} onClose={onItemClose} />
      <DeleteContentDialog item={itemDialog?.kind === 'delete' ? itemDialog.item : null} onOpenChange={closeItemOn} />

      <RenameDialog
        open={folderDialog?.kind === 'rename'}
        onOpenChange={closeFolderOn}
        title="Rename folder"
        initialValue={folderDialog?.kind === 'rename' ? folderDialog.folder.name : ''}
        onSubmit={renameFolder}
      />
      <ConfirmDialog
        open={folderDialog?.kind === 'delete'}
        onOpenChange={closeFolderOn}
        title="Delete folder?"
        destructive
        confirmLabel="Delete"
        loading={deleteFolder.isPending}
        onConfirm={() => {
          if (folderDialog) deleteFolder.mutate(folderDialog.folder.id)
        }}
        description={
          folderDialog ? (
            <p>
              This deletes <span className="font-semibold text-foreground">{folderDialog.folder.name}</span>.{' '}
              {folderDialog.folder.item_count === 0
                ? 'It has no files in it.'
                : folderDialog.folder.item_count === 1
                  ? 'The file inside stays in your library as Unfiled.'
                  : `The ${folderDialog.folder.item_count} files inside stay in your library as Unfiled.`}
            </p>
          ) : undefined
        }
      />

      <NewFolderDialog open={newFolderOpen} onOpenChange={onNewFolderOpenChange} />
      <DeleteExpiredDialog open={deleteExpiredOpen} onOpenChange={onDeleteExpiredOpenChange} />
    </>
  )
}
