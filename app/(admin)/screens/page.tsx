import { redirect } from 'next/navigation'

// The screen list is now the TVs page (the wall). A single screen's settings live at /screens/[id].
export default function ScreensPage() {
  redirect('/tvs')
}
