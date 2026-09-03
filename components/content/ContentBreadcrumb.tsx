'use client'

import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

import type { FolderView } from '@/types/api'

/**
 * Shown while a folder is open (`folder=<uuid>` — docs/CONTRACTS.md §9.2): Content → {folder}.
 * `folder` is null while the folders list is still loading.
 */
export function ContentBreadcrumb({ folder, onRoot }: { folder: FolderView | null; onRoot(): void }) {
  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<button type="button" onClick={onRoot} />}>Content</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{folder ? folder.name : '…'}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
