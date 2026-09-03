import { Suspense } from 'react'
import { ContentLibrary } from '@/components/content/ContentLibrary'

/**
 * /content — renders the one client page component (docs/CONTRACTS.md §2.2, §9.2).
 * ContentLibrary reads useSearchParams() (the `folder` param), so it sits in a Suspense
 * boundary (§2.2).
 */
export default function ContentPage() {
  return (
    <Suspense fallback={null}>
      <ContentLibrary />
    </Suspense>
  )
}
