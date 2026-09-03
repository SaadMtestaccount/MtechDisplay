'use client'

import { CpuIcon, MonitorIcon, NetworkIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ScreenView } from '@/types/api'

/** Resolution, last IP and (truncated, tooltipped) user agent reported by the device. */
export function DeviceInfo({ screen }: { screen: ScreenView }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <MonitorIcon className="size-3.5 shrink-0" />
        {screen.resolution ?? 'Unknown resolution'}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <NetworkIcon className="size-3.5 shrink-0" />
        {screen.last_ip ?? 'No IP yet'}
      </span>
      {screen.user_agent ? (
        <Tooltip>
          <TooltipTrigger render={<span className="inline-flex max-w-64 items-center gap-1.5" />}>
            <CpuIcon className="size-3.5 shrink-0" />
            <span className="truncate">{screen.user_agent}</span>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm break-all">{screen.user_agent}</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  )
}
