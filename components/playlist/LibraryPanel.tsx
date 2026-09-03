'use client'

import { useQuery } from '@tanstack/react-query'
import { SearchIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { LibraryCard } from '@/components/playlist/LibraryCard'
import type { LibraryPick } from '@/components/playlist/playlist-utils'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDebounce } from '@/hooks/useDebounce'
import { apiFetch, buildQuery } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { ContentListQuery, ContentView, WebsiteListQuery, WebsiteView } from '@/types/api'

const panelSkeleton = (
  <div className="grid grid-cols-2 gap-2">
    {Array.from({ length: 4 }, (_, i) => (
      <div key={i} className="flex flex-col gap-1.5 rounded-lg p-1.5 ring-1 ring-foreground/10">
        <Skeleton className="aspect-video rounded-md" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    ))}
  </div>
)

/**
 * Left pane of the editor (docs/CONTRACTS.md §9.5): tabs Content | Websites over the org
 * library (search debounced 300 ms; content sorted newest, whole org). Cards drag into the
 * playlist or append via their + button.
 */
export function LibraryPanel({ orgId, onAdd }: { orgId: string; onAdd(pick: LibraryPick): void }) {
  const [tab, setTab] = useState<'content' | 'websites'>('content')
  const [search, setSearch] = useState('')
  const q = useDebounce(search.trim(), 300)

  const contentParams = useMemo<ContentListQuery>(
    () => (q ? { sort: 'newest', expired: false, q } : { sort: 'newest', expired: false }),
    [q],
  )
  const websiteParams = useMemo<WebsiteListQuery>(() => (q ? { sort: 'name', q } : { sort: 'name' }), [q])

  const contentQuery = useQuery({
    queryKey: queryKeys.content.list(orgId, contentParams),
    queryFn: () => apiFetch<ContentView[]>(`/api/content${buildQuery({ sort: 'newest', q })}`),
  })
  const websitesQuery = useQuery({
    queryKey: queryKeys.websites.list(orgId, websiteParams),
    queryFn: () => apiFetch<WebsiteView[]>(`/api/websites${buildQuery({ sort: 'name', q })}`),
  })

  const content = contentQuery.data ?? []
  const websites = websitesQuery.data ?? []

  return (
    <div className="w-full shrink-0 rounded-xl bg-card p-3 ring-1 ring-foreground/10 md:w-80">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v === 'websites' ? 'websites' : 'content')}
        className="gap-3"
      >
        <TabsList className="w-full">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="websites">Websites</TabsTrigger>
        </TabsList>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'content' ? 'Search content…' : 'Search websites…'}
            aria-label="Search library"
            className="pl-8"
          />
        </div>
        <TabsContent value="content">
          <div className="max-h-[440px] overflow-y-auto pr-0.5">
            {contentQuery.isPending ? (
              panelSkeleton
            ) : content.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                {q ? 'No content matches your search.' : 'No content yet — upload files on the Content page.'}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {content.map((c) => (
                  <LibraryCard
                    key={c.id}
                    pick={{ kind: 'content', content: c }}
                    onAdd={() => onAdd({ kind: 'content', content: c })}
                    disabled={c.expired}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="websites">
          <div className="max-h-[440px] overflow-y-auto pr-0.5">
            {websitesQuery.isPending ? (
              panelSkeleton
            ) : websites.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                {q ? 'No websites match your search.' : 'No websites yet — add one on the Websites page.'}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {websites.map((w) => (
                  <LibraryCard
                    key={w.id}
                    pick={{ kind: 'website', website: w }}
                    onAdd={() => onAdd({ kind: 'website', website: w })}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
