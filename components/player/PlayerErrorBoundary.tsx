'use client'

/**
 * components/player/PlayerErrorBoundary.tsx — class error boundary for the player
 * (docs/CONTRACTS.md §9.7): no error UI on the TV, just a black screen and an automatic
 * reload after 10s.
 */
import { Component, type ReactNode } from 'react'

const RELOAD_AFTER_MS = 10_000

type Props = { children: ReactNode }
type State = { hasError: boolean }

export class PlayerErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }
  private reloadTimer: ReturnType<typeof setTimeout> | null = null

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error): void {
    console.error('[player] fatal error — reloading in 10s', error)
    if (this.reloadTimer === null) {
      this.reloadTimer = setTimeout(() => window.location.reload(), RELOAD_AFTER_MS)
    }
  }

  componentWillUnmount(): void {
    if (this.reloadTimer) clearTimeout(this.reloadTimer)
  }

  render(): ReactNode {
    if (this.state.hasError) return <div className="absolute inset-0 bg-black" />
    return this.props.children
  }
}
