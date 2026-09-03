'use client'

import { useEffect, useState } from 'react'

/** Returns `value` after it has been stable for `delayMs` (search inputs: 300ms). */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
