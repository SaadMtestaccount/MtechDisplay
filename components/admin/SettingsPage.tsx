'use client'

import { MapPinIcon } from 'lucide-react'
import { LogoUpload } from '@/components/admin/LogoUpload'
import { SettingsForm } from '@/components/admin/SettingsForm'
import { NoOrgState } from '@/components/shell/NoOrgState'
import { OrgSwitcher } from '@/components/shell/OrgSwitcher'
import { useApp } from '@/hooks/useApp'

/**
 * /admin/settings — one LOCATION's name, time zone and logo (spec §15, §23). These belong to a
 * store, not to MTech, so the page starts with a location picker (the OrgSwitcher, which sets
 * the active org and refreshes) and says which store is being edited.
 */
export function SettingsPage() {
  const { org } = useApp()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight">Location settings</h1>
        <p className="text-base text-muted-foreground">
          The name, time zone and logo a store&apos;s TVs use. Pick the location first — every location has its own.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MapPinIcon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold text-muted-foreground">Editing</span>
          <span className="truncate text-lg font-bold">{org?.name ?? 'No location selected'}</span>
        </div>
        <div className="ml-auto">
          <OrgSwitcher label="Change location" />
        </div>
      </div>

      {org ? (
        <div className="flex max-w-2xl flex-col gap-6">
          {/* Keyed by org so switching locations resets any in-progress edits. */}
          <SettingsForm key={`settings-${org.id}`} org={org} />
          <LogoUpload key={`logo-${org.id}`} org={org} />
        </div>
      ) : (
        <NoOrgState />
      )}
    </div>
  )
}
