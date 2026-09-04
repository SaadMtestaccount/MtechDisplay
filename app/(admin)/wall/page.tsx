import { redirect } from 'next/navigation'

// The Wall is now the TVs page.
export default function WallPage() {
  redirect('/tvs')
}
