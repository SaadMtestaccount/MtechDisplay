'use client'

/**
 * components/wall/WallTray.tsx — the draggable palette beside the wall: reusable Menus, single
 * boards (content) and web pages. Drag a card onto a TV tile to show it there.
 */
import { useDraggable } from '@dnd-kit/core'
import { useQuery } from '@tanstack/react-query'
import { ImageIcon, LayoutGridIcon } from 'lucide-react'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { contentPick, menuPick, wallDragId, websitePick, type WallPick } from '@/components/wall/wall-dnd'
import { useDebounce } from '@/hooks/useDebounce'
import { apiFetch, buildQuery } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { cn, faviconUrl } from '@/lib/utils'
import type { ContentView, MenuView, WebsiteView } from '@/types/api'

type TrayTab = 'menus' | 'boards' | 'web'
const TABS: { id: TrayTab; label: string }[] = [
  { id: 'menus', label: 'Menus' },
  { id: 'boards', label: 'Boards' },
  { id: 'web', label: 'Web' },
]

export function WallTray({ orgId }: { orgId: string }) {
  const [tab, setTab] = useState<TrayTab>('menus')
  const [search, setSearch] = useState('')
  const q = useDebounce(search.trim(), 300)

  const menus = useQuery({
    queryKey: queryKeys.menus.list(orgId),
    queryFn: () => apiFetch<MenuView[]>('/api/menus'),
    enabled: tab === 'menus',
  })
  const content = useQuery({
    queryKey: [...queryKeys.content.all(orgId), 'wall', q],
    queryFn: () => apiFetch<ContentView[]>(`/api/content${buildQuery({ sort: 'newest', q })}`),
    enabled: tab === 'boards',
  })
  const websites = useQuery({
    queryKey: [...queryKeys.websites.all(orgId), 'wall', q],
    queryFn: () => apiFetch<WebsiteView[]>(`/api/websites${buildQuery({ sort: 'name', q })}`),
    enabled: tab === 'web',
  })

  const lc = q.toLowerCase()
  let picks: WallPick[] = []
  if (tab === 'menus') picks = (menus.data ?? []).filter((m) => m.name.toLowerCase().includes(lc)).map(menuPick)
  else if (tab === 'boards') picks = (content.data ?? []).map(contentPick)
  else picks = (websites.data ?? []).map(websitePick)

  const selectTab = (t: TrayTab) => {
    setSearch('')
    setTab(t)
  }

  return (
    <aside className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)]">
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => selectTab(t.id)}
            className={cn(
              'rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${tab}…`} className="h-9" />

      <div className="flex min-h-24 flex-col gap-2 overflow-y-auto">
        {picks.map((pick) => (
          <TrayCard key={`${pick.kind}:${pick.id}`} pick={pick} />
        ))}
        {picks.length === 0 ? (
          <p className="px-1 py-8 text-center text-xs text-muted-foreground">
            {tab === 'menus' ? 'No menus yet — build one on the Menus tab.' : 'Nothing here yet.'}
          </p>
        ) : null}
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Drag onto a TV to show it. It locks on — unlock the TV to change it.
      </p>
    </aside>
  )
}

function TrayCard({ pick }: { pick: WallPick }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: wallDragId(pick), data: { pick } })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        'flex cursor-grab touch-none select-none items-center gap-3 rounded-lg border border-border bg-background p-2 hover:border-primary/50',
        isDragging && 'opacity-40',
      )}
    >
      <TrayThumb pick={pick} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{pick.name}</div>
        <div className="truncate text-xs text-muted-foreground">{pick.detail}</div>
      </div>
    </div>
  )
}

function TrayThumb({ pick }: { pick: WallPick }) {
  if (pick.kind === 'website') {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
        <img src={faviconUrl(pick.url)} alt="" className="size-5" />
      </div>
    )
  }
  if (pick.thumbUrl) {
    return <img src={pick.thumbUrl} alt="" className="size-10 shrink-0 rounded-md object-cover" />
  }
  const Icon = pick.kind === 'menu' ? LayoutGridIcon : ImageIcon
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
      <Icon className="size-5" />
    </div>
  )
}
