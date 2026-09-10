import { MenuDetail } from '@/components/menus/MenuDetail'

/** /menus/[id] — simple editor by default; `?advanced=1` opens the full PlaylistEditor for MTech staff. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ advanced?: string }>
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  return <MenuDetail id={id} advanced={query.advanced === '1'} />
}
