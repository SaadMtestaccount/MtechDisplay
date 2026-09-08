import type { Metadata } from 'next'
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

// Plus Jakarta Sans carries display + body (same family as the MTech console); IBM Plex Mono
// carries pairing codes and generated passwords.
const jakarta = Plus_Jakarta_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
})

const plexMono = IBM_Plex_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: { default: 'MSIGN', template: '%s · MSIGN' },
  description: 'MTech digital signage platform',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${jakarta.variable} ${plexMono.variable}`}>
      <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  )
}
