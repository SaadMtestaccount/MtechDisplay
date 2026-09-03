import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Player',
}

/** Player shell: black full-screen container, no navbar, default viewport (§10). */
export default function PlayerLayout({ children }: { children: ReactNode }) {
  return <div className="fixed inset-0 overflow-hidden bg-black text-white">{children}</div>
}
