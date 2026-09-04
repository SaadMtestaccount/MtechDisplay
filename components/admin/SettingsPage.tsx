'use client'

import { LogoUpload } from '@/components/admin/LogoUpload'
import { SettingsForm } from '@/components/admin/SettingsForm'
import { NoOrgState } from '@/components/shell/NoOrgState'
import { PageHeader } from '@/components/shell/PageHeader'
import { useApp } from '@/hooks/useApp'

/** /admin/settings — active-org name, timezone and logo (spec §15). */
export function SettingsPage() {
  const { org } = useApp()

  if (!org) {
    return (
      <>
        <PageHeader title="Settings" />
        <NoOrgState />
      </>
    )
  }

  return (
    <>
      <PageHeader title="Settings" description={`Settings for ${org.name}.`} />
      <div className="flex max-w-2xl flex-col gap-6">
        {/* Keyed by org so switching orgs resets any in-progress edits. */}
        <SettingsForm key={`settings-${org.id}`} org={org} />
        <LogoUpload key={`logo-${org.id}`} org={org} />
      </div>
    </>
  )
}
