import { GroupEditor } from '@/components/groups/GroupEditor'

export default async function GroupEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <GroupEditor id={id} />
}
