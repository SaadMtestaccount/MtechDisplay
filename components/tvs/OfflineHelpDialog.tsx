'use client'

/** components/tvs/OfflineHelpDialog.tsx — the four things to check when a TV shows Off (§23). */
import { PhoneIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { SUPPORT_EMAIL, SUPPORT_PHONE, supportPhoneHref } from '@/lib/support'
import type { ScreenView } from '@/types/api'

const STEPS = [
  { title: 'Is the TV on?', body: 'Press the power button on the remote. Wait about a minute — it takes a moment to start.' },
  { title: 'Is the MSIGN app open?', body: 'On the TV home screen, open the MSIGN app. If the TV shows another input, switch to the one MSIGN runs on.' },
  { title: 'Is the Wi-Fi working?', body: 'If other devices in the store have no internet, restart your router: unplug it, wait 30 seconds, plug it back in.' },
  { title: 'Still off?', body: 'Unplug the TV (or the little box behind it), wait 30 seconds, and plug it back in. It comes back on by itself.' },
]

export function OfflineHelpDialog({
  screen,
  onOpenChange,
}: {
  screen: ScreenView | null
  onOpenChange(open: boolean): void
}) {
  const tel = supportPhoneHref()
  return (
    <Dialog open={screen !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">{screen ? `${screen.name} is off` : 'TV is off'}</DialogTitle>
          <DialogDescription className="text-[15px]">
            Off means the TV has not talked to MSIGN for a while. Try these in order.
          </DialogDescription>
        </DialogHeader>
        <ol className="flex flex-col gap-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3 rounded-xl border border-border p-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
                {i + 1}
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-base font-semibold">{step.title}</span>
                <span className="text-sm text-muted-foreground">{step.body}</span>
              </div>
            </li>
          ))}
        </ol>
        <DialogFooter className="sm:justify-between">
          {tel ? (
            <Button variant="outline" render={<a href={tel} />}>
              <PhoneIcon /> Call MTech {SUPPORT_PHONE}
            </Button>
          ) : (
            <Button variant="outline" render={<a href={`mailto:${SUPPORT_EMAIL}`} />}>
              Email MTech
            </Button>
          )}
          <DialogClose render={<Button type="button" />}>Got it</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
