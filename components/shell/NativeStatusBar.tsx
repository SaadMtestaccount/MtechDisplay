'use client'

/**
 * components/shell/NativeStatusBar.tsx — inside the MSIGN iPhone/Android app (docs/CONTRACTS.md
 * §24) the status bar is drawn by the OS over our page, so its clock/Wi-Fi/battery must flip
 * to light text when the console is in dark mode. Capacitor injects `window.Capacitor` into
 * the hosted page; in a normal browser this component does nothing.
 */
import { useTheme } from 'next-themes'
import { useEffect } from 'react'

type StatusBarPlugin = { setStyle(options: { style: 'DARK' | 'LIGHT' | 'DEFAULT' }): Promise<void> }
type CapacitorGlobal = { isNativePlatform?: () => boolean; Plugins?: { StatusBar?: StatusBarPlugin } }

export function NativeStatusBar() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor
    if (!cap?.isNativePlatform?.()) return
    // Capacitor's Style.Dark = light text on a dark background (and vice versa).
    void cap.Plugins?.StatusBar?.setStyle({ style: resolvedTheme === 'dark' ? 'DARK' : 'LIGHT' }).catch(() => {})
  }, [resolvedTheme])

  return null
}
