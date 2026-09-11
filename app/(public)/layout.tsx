import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'

/** Public pages (privacy policy): theme only — no navbar, no session, no app providers. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {children}
    </ThemeProvider>
  )
}
