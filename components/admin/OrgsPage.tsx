'use client'

import { useQuery } from '@tanstack/react-query'
import { Building2Icon, PlusIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { DeleteOrgDialog } from '@/components/admin/DeleteOrgDialog'
import { OrgDialog } from '@/components/admin/OrgDialog'
import { OrgsTable } from '@/components/admin/OrgsTable'
import { EmptyState } from '@/components/shell/EmptyState'
import { PageHeader } from '@/components/shell/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/hooks/useApp'
import { apiFetch } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import type { OrganizationView } from '@/types/api'

/** /admin/orgs — list with screen/content counts; create, rename, open-as, delete (spec §15). */
export function OrgsPage() {
  const { org: activeOrg, setActiveOrg } = useApp()
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<OrganizationView | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<OrganizationView | null>(null)

  const orgsQuery = useQuery({
    queryKey: queryKeys.orgs.list(),
    queryFn: () => apiFetch<OrganizationView[]>('/api/orgs'),
  })

  const handleOpen = async (org: OrganizationView) => {
    try {
      await setActiveOrg(org.id)
      toast.success(`Now viewing ${org.name}`)
      router.push('/content')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not switch organization')
    }
  }

  return (
    <>
      <PageHeader
        title="Organizations"
        description="One organization per merchant — each with its own content, screens and settings."
        primary={
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon /> New organization
          </Button>
        }
      />

      {orgsQuery.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : orgsQuery.isError ? (
        <p className="text-sm text-destructive">
          {orgsQuery.error instanceof Error ? orgsQuery.error.message : 'Could not load organizations.'}
        </p>
      ) : orgsQuery.data.length === 0 ? (
        <EmptyState
          icon={<Building2Icon />}
          title="No organizations yet"
          description="Create the first organization to start adding content and screens."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <PlusIcon /> New organization
            </Button>
          }
        />
      ) : (
        <OrgsTable
          orgs={orgsQuery.data}
          activeOrgId={activeOrg?.id ?? null}
          onOpen={(org) => void handleOpen(org)}
          onRename={setRenameTarget}
          onDelete={setDeleteTarget}
        />
      )}

      <OrgDialog open={createOpen} onOpenChange={setCreateOpen} />
      <OrgDialog
        open={renameTarget !== null}
        org={renameTarget ?? undefined}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null)
        }}
      />
      <DeleteOrgDialog
        org={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      />
    </>
  )
}
