import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Player',
}

/** Player shell: black full-screen container, no navbar (§10). Styled by app/player.css (§20). */
export default function PlayerLayout({ children }: { children: ReactNode }) {
  return <div className="pl-root">{children}</div>
}
