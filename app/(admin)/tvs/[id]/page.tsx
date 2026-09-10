import { TvPage } from '@/components/tvs/TvPage'

/** /tvs/[id] — one TV in the merchant console (docs/CONTRACTS.md §23). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <TvPage id={id} />
}
