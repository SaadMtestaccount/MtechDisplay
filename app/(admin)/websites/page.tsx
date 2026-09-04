import { ContentSubnav } from '@/components/content/ContentSubnav'
import { WebsiteLibrary } from '@/components/websites/WebsiteLibrary'

/** /websites — the "Web pages" tab of Content. */
export default function WebsitesPage() {
  return (
    <>
      <ContentSubnav />
      <WebsiteLibrary />
    </>
  )
}
