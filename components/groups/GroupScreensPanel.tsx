'use client'

import { StatusPill } from '@/components/shell/StatusPill'
import { Checkbox } from '@/components/ui/checkbox'
import { screenStatus } from '@/lib/status'
import type { GroupDetailView, ScreenView } from '@/types/api'

/**
 * Checklist of ALL org screens; checked = group members. A screen already in another group
 * shows that group as a caption — checking it moves it here (docs/CONTRACTS.md §5.20).
 * Every toggle calls `onChange` with the FULL new member id array.
 */
export function GroupScreensPanel({
  group,
  screens,
  onChange,
  saving = false,
}: {
  group: GroupDetailView
  screens: ScreenView[]
  onChange(screenIds: string[]): void
  saving?: boolean
}) {
  const memberIds = new Set(group.screens.map((s) => s.id))

  const toggle = (screenId: string, next: boolean) => {
    const ids = group.screens.map((s) => s.id).filter((sid) => sid !== screenId)
    if (next) ids.push(screenId)
    onChange(ids)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Screens</h2>
        <span className="text-xs text-muted-foreground">
          {saving ? 'Saving…' : `${memberIds.size} in group`}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">Checked screens play this group&apos;s playlist.</p>
      {screens.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          No screens in this organization yet. Pair one from the Screens page first.
        </p>
      ) : (
        <div className="-mx-2 flex max-h-96 flex-col gap-0.5 overflow-y-auto">
          {screens.map((screen) => {
            const otherGroup =
              screen.group_id !== null && screen.group_id !== group.id ? screen.group_name : null
            return (
              <div
                key={screen.id}
                className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/50"
              >
                <Checkbox
                  id={`group-screen-${screen.id}`}
                  checked={memberIds.has(screen.id)}
                  onCheckedChange={(next) => toggle(screen.id, next)}
                  disabled={saving}
                  className="mt-1"
                />
                <label
                  htmlFor={`group-screen-${screen.id}`}
                  className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5"
                >
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm">{screen.name}</span>
                    <StatusPill status={screenStatus(screen)} />
                  </span>
                  {otherGroup ? (
                    <span className="text-xs text-muted-foreground">
                      In {otherGroup} — checking moves it here
                    </span>
                  ) : null}
                </label>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
