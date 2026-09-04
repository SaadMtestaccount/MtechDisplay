'use client'

/** components/account/AccountPage.tsx — your name, password and email. Works for any signed-in user. */
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shell/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useApp } from '@/hooks/useApp'
import { createBrowserClient } from '@/lib/supabase/client'

export function AccountPage() {
  const { user, profile } = useApp()
  const router = useRouter()
  const [name, setName] = useState(profile.full_name ?? '')
  const [savingName, setSavingName] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const saveName = async (e: FormEvent) => {
    e.preventDefault()
    if (savingName) return
    setSavingName(true)
    const { error } = await createBrowserClient()
      .from('profiles')
      .update({ full_name: name.trim() || null })
      .eq('id', user.id)
    setSavingName(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Name updated')
    router.refresh()
  }

  const savePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (savingPassword) return
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      toast.error('The two passwords do not match')
      return
    }
    setSavingPassword(true)
    const { error } = await createBrowserClient().auth.updateUser({ password })
    setSavingPassword(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setPassword('')
    setConfirm('')
    toast.success('Password changed')
  }

  return (
    <>
      <PageHeader title="Your account" description="Change your name and password." />
      <div className="flex max-w-lg flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Name</CardTitle>
            <CardDescription>Shown next to your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveName} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="account-name">Full name</Label>
                <Input
                  id="account-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  maxLength={120}
                  disabled={savingName}
                />
              </div>
              <div>
                <Button type="submit" disabled={savingName || name.trim() === (profile.full_name ?? '')}>
                  {savingName ? 'Saving…' : 'Save name'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>Signed in as {user.email}.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={savePassword} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="account-password">New password</Label>
                <Input
                  id="account-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  disabled={savingPassword}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="account-confirm">Confirm new password</Label>
                <Input
                  id="account-confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  disabled={savingPassword}
                />
              </div>
              <div>
                <Button type="submit" disabled={savingPassword || !password || !confirm}>
                  {savingPassword ? 'Changing…' : 'Change password'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
