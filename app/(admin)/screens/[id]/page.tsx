import { ScreenDetail } from '@/components/screens/ScreenDetail'

export default async function ScreenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ScreenDetail id={id} />
}
