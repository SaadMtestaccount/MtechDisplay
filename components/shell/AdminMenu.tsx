'use client'

import { Building2Icon, ChevronDownIcon, LogOutIcon, SettingsIcon, UsersIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useApp } from '@/hooks/useApp'
import { createBrowserClient } from '@/lib/supabase/client'

export function AdminMenu() {
  const router = useRouter()
  const { profile } = useApp()

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
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
        {profile.is_super_admin ? 'Admin' : 'Account'}
        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {profile.is_super_admin ? (
          <>
            <DropdownMenuItem onClick={() => router.push('/admin/users')}>
              <UsersIcon />
              Users
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/admin/orgs')}>
              <Building2Icon />
              Organizations
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/admin/settings')}>
              <SettingsIcon />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem onClick={() => void handleLogout()}>
          <LogOutIcon />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
