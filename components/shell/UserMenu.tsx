'use client'

/**
 * components/shell/UserMenu.tsx — the profile menu: your account, theme, log out, and (staff)
 * Team / Organizations / Settings. Replaces the separate Admin menu, theme toggle and avatar.
 */
import { Building2Icon, LogOutIcon, MoonIcon, SettingsIcon, SunIcon, UsersIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useApp } from '@/hooks/useApp'
import { createBrowserClient } from '@/lib/supabase/client'
import { initials } from '@/lib/utils'

export function UserMenu() {
  const router = useRouter()
  const { user, profile } = useApp()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const dark = mounted && resolvedTheme === 'dark'

  const handleLogout = async () => {
    const { error } = await createBrowserClient().auth.signOut()
    if (error) {
      toast.error(error.message)
      return
    }
    router.replace('/login')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Your account"
            className="inline-flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        <Avatar>
          <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
            {initials(profile.full_name ?? user.email)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{profile.full_name ?? 'Your account'}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {profile.is_super_admin ? (
          <>
            <DropdownMenuItem onClick={() => router.push('/admin/users')}>
              <UsersIcon /> Team
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/admin/orgs')}>
              <Building2Icon /> Organizations
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/admin/settings')}>
              <SettingsIcon /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem onClick={() => setTheme(dark ? 'light' : 'dark')}>
          {dark ? <SunIcon /> : <MoonIcon />} {dark ? 'Light mode' : 'Dark mode'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void handleLogout()}>
          <LogOutIcon /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
