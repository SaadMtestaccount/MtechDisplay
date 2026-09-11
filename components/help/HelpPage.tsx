'use client'

/** components/help/HelpPage.tsx — /help (docs/CONTRACTS.md §23): the four things people ask, in plain words. */
import { ImageIcon, ListIcon, MailIcon, PhoneIcon, TvIcon, WifiOffIcon } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SUPPORT_EMAIL, SUPPORT_PHONE, supportPhoneHref } from '@/lib/support'

const TOPICS = [
  {
    icon: TvIcon,
    title: 'Change what a TV shows',
    steps: ['Go to TVs and tap the TV.', 'Tap "Show a menu", "Show a photo or video" or "Show a web page".', 'Pick one and press the button. The TV changes in a few seconds.'],
    link: { href: '/tvs', label: 'Go to TVs' },
  },
  {
    icon: ImageIcon,
    title: 'Add new photos or videos',
    steps: ['Go to Photos and tap the big box at the top.', 'Choose the files on your phone or computer.', 'When they are uploaded, tap "Use on a TV" or add them to a menu.'],
    link: { href: '/photos', label: 'Go to Photos' },
  },
  {
    icon: ListIcon,
    title: 'Make a menu (a slideshow)',
    steps: ['Go to Menus and tap "New menu".', 'Tap "Add photos or videos" and tick the ones you want.', 'Use the arrows to set the order, and tick the TVs that should show it.'],
    link: { href: '/menus', label: 'Go to Menus' },
  },
  {
    icon: WifiOffIcon,
    title: 'A TV says "Off"',
    steps: ['Check the TV is on and the MSIGN app is open.', 'Check the store Wi-Fi works on your phone.', 'Unplug the TV (or its box) for 30 seconds and plug it back in.'],
    link: { href: '/tvs', label: 'See your TVs' },
  },
]

export function HelpPage() {
  const tel = supportPhoneHref()
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-[30px] font-extrabold tracking-[-0.03em]">Help</h1>
        <p className="text-[15px] text-muted-foreground">Short answers to the things people ask most. Anything else, call or email MTech.</p>
      </div>

      <div className="flex flex-col gap-3 rounded-[22px] bg-gradient-to-br from-primary to-primary-deep p-5 text-white shadow-primary ring-1 ring-white/15 ring-inset sm:flex-row sm:items-center">
        <div className="flex-1">
          <div className="text-xl font-extrabold">Talk to a person at MTech</div>
          <div className="text-[15px] text-white/85">We set up your TVs and can fix most things over the phone.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {tel ? (
            <Button size="xl" variant="secondary" render={<a href={tel} />}>
              <PhoneIcon /> {SUPPORT_PHONE}
            </Button>
          ) : null}
          <Button size="xl" variant="secondary" render={<a href={`mailto:${SUPPORT_EMAIL}`} />}>
            <MailIcon /> Email
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {TOPICS.map((topic) => {
          const Icon = topic.icon
          return (
            <div key={topic.title} className="surface flex flex-col gap-3 p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                  <Icon className="size-6" />
                </span>
                <h2 className="text-[17px] font-extrabold tracking-[-0.01em]">{topic.title}</h2>
              </div>
              <ol className="flex flex-col gap-2 pl-1">
                {topic.steps.map((step, i) => (
                  <li key={step} className="flex gap-3 text-[15px]">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[13px] font-bold text-primary">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <Link href={topic.link.href} className="mt-auto text-[15px] font-semibold text-primary hover:underline">
                {topic.link.label} →
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
