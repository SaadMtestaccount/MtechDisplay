import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'
import { NativeStatusBar } from '@/components/shell/NativeStatusBar'
import { Toaster } from '@/components/ui/sonner'

/** Auth pages: theme + toasts only — no navbar, no app providers (docs/CONTRACTS.md Appendix B). */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <NativeStatusBar />
      {children}
      <Toaster />
    </ThemeProvider>
  )
}
