'use client'

import { useEffect, useState } from 'react'

/** Ticking clock for "last seen" labels and online recomputation (use 5000 for grids). */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return now
}
