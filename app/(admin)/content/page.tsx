import { Suspense } from 'react'
import { ContentLibrary } from '@/components/content/ContentLibrary'
import { ContentSubnav } from '@/components/content/ContentSubnav'

/** /content — images & videos. ContentLibrary reads useSearchParams (folder), so it needs Suspense. */
export default function ContentPage() {
  return (
    <>
      <ContentSubnav />
      <Suspense fallback={null}>
        <ContentLibrary />
      </Suspense>
    </>
  )
}
