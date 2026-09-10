import type {
  ContentListQuery, FolderListQuery, GroupListQuery, ScreenListQuery, WebsiteListQuery,
} from '@/types/api'

/**
 * React Query keys. Root segment == ChangedTable name, so a `changed` broadcast can
 * `invalidateQueries({ queryKey: [table, orgId] })`.
 */
export const queryKeys = {
  content: {
    all: (orgId: string) => ['content', orgId] as const,
    list: (orgId: string, q: ContentListQuery) => ['content', orgId, 'list', q] as const,
    detail: (orgId: string, id: string) => ['content', orgId, 'detail', id] as const,
    usage: (orgId: string, id: string) => ['content', orgId, 'usage', id] as const,
    expiredCount: (orgId: string) => ['content', orgId, 'expired-count'] as const,
  },
  folders: {
    all: (orgId: string) => ['folders', orgId] as const,
    list: (orgId: string, q: FolderListQuery) => ['folders', orgId, 'list', q] as const,
  },
  websites: {
    all: (orgId: string) => ['websites', orgId] as const,
    list: (orgId: string, q: WebsiteListQuery) => ['websites', orgId, 'list', q] as const,
    detail: (orgId: string, id: string) => ['websites', orgId, 'detail', id] as const,
    usage: (orgId: string, id: string) => ['websites', orgId, 'usage', id] as const,
  },
  screens: {
    all: (orgId: string) => ['screens', orgId] as const,
    list: (orgId: string, q: ScreenListQuery) => ['screens', orgId, 'list', q] as const,
    detail: (orgId: string, id: string) => ['screens', orgId, 'detail', id] as const,
  },
  groups: {
    all: (orgId: string) => ['groups', orgId] as const,
    list: (orgId: string, q: GroupListQuery) => ['groups', orgId, 'list', q] as const,
    detail: (orgId: string, id: string) => ['groups', orgId, 'detail', id] as const,
  },
  playlists: {
    all: (orgId: string) => ['playlists', orgId] as const,
    detail: (orgId: string, id: string) => ['playlists', orgId, 'detail', id] as const,
  },
  menus: {
    all: (orgId: string) => ['menus', orgId] as const,
    list: (orgId: string) => ['menus', orgId, 'list'] as const,
    detail: (orgId: string, id: string) => ['menus', orgId, 'detail', id] as const,
  },
  orgs: {
    all: () => ['orgs'] as const,
    list: () => ['orgs', 'list'] as const,
    detail: (id: string) => ['orgs', 'detail', id] as const,
  },
  users: {
    all: () => ['users'] as const,
    list: () => ['users', 'list'] as const,
  },
  merchants: {
    all: () => ['merchants'] as const,
    list: () => ['merchants', 'list'] as const,
    detail: (id: string) => ['merchants', 'detail', id] as const,
  },
  /** Super-admin fleet (every location); not org-scoped, so realtime never invalidates it — it polls. */
  fleet: {
    all: () => ['fleet'] as const,
    list: () => ['fleet', 'list'] as const,
  },
}
