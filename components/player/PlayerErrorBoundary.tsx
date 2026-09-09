'use client'

/**
 * components/player/PlayerErrorBoundary.tsx — class error boundary for the player
 * (docs/CONTRACTS.md §9.7, §20): a plain black screen with the error and the browser's identity
 * (so support can read it off the TV), then an automatic reload after 10s.
 */
import { Component, type ReactNode } from 'react'

const RELOAD_AFTER_MS = 10_000

type Props = { children: ReactNode }
type State = { error: Error | null }

export class PlayerErrorBoundary extends Component<Props, State> {
  state: State = { error: null }
  private reloadTimer: ReturnType<typeof setTimeout> | null = null

  static getDerivedStateFromError(error: Error): State {
    return { error }
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
    if (this.state.error) {
      return (
        <div className="pl-fatal">
          <div className="pl-boot-title">MSIGN hit a problem — restarting…</div>
          <div className="pl-boot-text">{this.state.error.message}</div>
          <div className="pl-boot-fine">{typeof navigator === 'undefined' ? '' : navigator.userAgent}</div>
        </div>
      )
    }
    return this.props.children
  }
}
