'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ContentListQuery, FolderView } from '@/types/api'

const ALL = 'all'
const UNFILED = 'root'

/**
 * Filters popover body: type, folder (All folders / Unfiled / each folder), expired only
 * (docs/CONTRACTS.md §9.2). `value.folder_id` uses the ContentListQuery encoding — undefined =
 * whole org, 'root' = unfiled, uuid = that folder; a folder change NAVIGATES (ContentLibrary
 * sets the `folder` URL param), it is not separate filter state.
 */
export function ContentFilters({
  value,
  folders,
  onChange,
}: {
  value: ContentListQuery
  folders: FolderView[]
  onChange(next: ContentListQuery): void
}) {
  return (
    <div className="flex w-56 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="content-filter-type">Type</Label>
        <Select
          value={value.type ?? ALL}
          onValueChange={(v) => {
            const next = String(v)
            onChange({ ...value, type: next === 'image' || next === 'video' ? next : undefined })
          }}
        >
          <SelectTrigger id="content-filter-type" size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            <SelectItem value="image">Images</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="content-filter-folder">Folder</Label>
        <Select
          value={value.folder_id ?? ALL}
          onValueChange={(v) => {
            const next = String(v)
            onChange({ ...value, folder_id: next === ALL ? undefined : next })
          }}
        >
          <SelectTrigger id="content-filter-folder" size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All folders</SelectItem>
            <SelectItem value={UNFILED}>Unfiled</SelectItem>
            {folders.map((folder) => (
              <SelectItem key={folder.id} value={folder.id}>
                {folder.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Label className="flex items-center gap-2 font-normal">
        <Checkbox checked={value.expired} onCheckedChange={(checked) => onChange({ ...value, expired: checked })} />
        Expired only
      </Label>
    </div>
  )
}
