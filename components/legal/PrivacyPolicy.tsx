/** components/legal/PrivacyPolicy.tsx — the MSIGN privacy policy in plain words (docs/CONTRACTS.md §24). */
import { SUPPORT_EMAIL } from '@/lib/support'

export const PRIVACY_EFFECTIVE_DATE = 'September 11, 2026'

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'What MSIGN is',
    body: [
      'MSIGN is the digital signage service from MTech Distributors. It lets a business change what its TVs show — menus, photos, videos and web pages — from the MSIGN website or the MSIGN app for iPhone, iPad and Android.',
      'The app shows the same console as the website. It does not collect anything on its own beyond what the console needs to work.',
    ],
  },
  {
    title: 'What we collect',
    body: [
      'Account details: your name, email address, password (stored only in protected form by our sign-in provider), the business and locations you belong to, and your role.',
      'Content you add: the photos, videos, menus and web page links you choose to show on your TVs.',
      'TV details: each TV’s pairing code, name, online status, what it is showing, and the technical details needed to keep it connected.',
      'Technical logs: standard server logs such as IP address, app or browser type and the time of each request, kept for security and troubleshooting.',
    ],
  },
  {
    title: 'Phone permissions',
    body: [
      'Photos and camera: used only when you choose to upload a photo or video to show on a TV. We never scan or copy your photo library.',
      'MSIGN does not ask for your location, contacts or microphone.',
    ],
  },
  {
    title: 'How we use your information',
    body: [
      'To run the service: sign you in, keep your TVs connected and show the content you picked.',
      'To support you: MTech staff can see your account and TVs so they can help when you call or email.',
      'To keep the service safe: spotting misuse, fixing problems and meeting legal requirements.',
    ],
  },
  {
    title: 'What we do not do',
    body: [
      'We do not sell your information. We do not show ads. We do not track you across other apps or websites, and we do not share your information with data brokers.',
    ],
  },
  {
    title: 'Who we share it with',
    body: [
      'Service providers that host MSIGN for us: Supabase (database, sign-in and file storage) and our website hosting provider (currently Vercel). They process your information only to run the service.',
      'MTech Distributors staff who set up and support your account.',
      'Authorities, when the law requires it.',
    ],
  },
  {
    title: 'How long we keep it',
    body: [
      'We keep your account and content for as long as your account is active. Ask us to delete your account or any content and we will remove it promptly, normally within 30 days, except for records the law requires us to keep.',
    ],
  },
  {
    title: 'Security',
    body: [
      'Your information travels over encrypted connections (HTTPS). Access is limited to authorized MTech staff and the providers named above.',
    ],
  },
  {
    title: 'Children',
    body: [
      'MSIGN is a business tool and is not directed to children under 13. We do not knowingly collect information from children.',
    ],
  },
  {
    title: 'Changes to this policy',
    body: [
      'If we change this policy, we will post the new version on this page with a new effective date.',
    ],
  },
]

export function PrivacyPolicy() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-3">
        <img src="/msign.svg" alt="MSIGN" className="h-8 w-auto self-start" />
        <h1 className="text-3xl font-extrabold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">
          MSIGN by MTech Distributors · Effective {PRIVACY_EFFECTIVE_DATE}
        </p>
      </header>

      {SECTIONS.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h2 className="text-lg font-bold tracking-tight">{section.title}</h2>
          {section.body.map((paragraph) => (
            <p key={paragraph} className="text-[15px] leading-relaxed text-foreground/90">
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      <section className="flex flex-col gap-2 rounded-2xl bg-card p-5 shadow-sm">
        <h2 className="text-lg font-bold tracking-tight">Questions or requests</h2>
        <p className="text-[15px] leading-relaxed text-foreground/90">
          Email{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-primary underline-offset-4 hover:underline">
            {SUPPORT_EMAIL}
          </a>{' '}
          to ask what we hold about you, or to have your account or content deleted.
        </p>
        <p className="text-sm text-muted-foreground">MTech Distributors · Brooklyn, New York</p>
      </section>
    </main>
  )
}
