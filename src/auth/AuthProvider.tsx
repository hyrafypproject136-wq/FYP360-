import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { errorMessage, setRememberMe, supabase, usernameToEmail } from '../lib/supabase'

export type Role = 'coordinator' | 'supervisor' | 'jury' | 'student'

export interface SignedInUser {
  role: Role
  profileId: string | null
  displayName: string
  groupId: string | null
  groupStatus: 'active' | 'disqualified' | 'dissolved' | null
  groupStatusReason: string | null
  viaGoogle: boolean
}

interface AuthValue {
  loading: boolean
  user: SignedInUser | null
  authError: string | null
  signInWithUsername: (username: string, password: string, remember: boolean) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthValue | undefined>(undefined)

interface WhoAmIRow {
  role: 'coordinator' | 'supervisor' | 'jury' | 'group'
  profile_id: string | null
  display_name: string | null
  group_id: string | null
  group_status: SignedInUser['groupStatus']
  group_status_reason: string | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<SignedInUser | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  // The role always comes from the database (whoami), never from the login form.
  const resolve = useCallback(async (session: Session | null) => {
    if (!session) {
      setUser(null)
      setLoading(false)
      return
    }
    const viaGoogle = session.user.app_metadata?.provider === 'google'
    const { data, error } = await supabase.rpc('whoami').maybeSingle<WhoAmIRow>()
    if (error || !data) {
      await supabase.auth.signOut()
      setUser(null)
      setAuthError(
        error
          ? errorMessage(error)
          : viaGoogle
            ? `No FYP360 account uses ${session.user.email}. Sign in with the username and password from your FYP coordinator.`
            : 'This login is not linked to an FYP360 account. Contact your FYP coordinator.',
      )
      setLoading(false)
      return
    }
    setUser({
      role: data.role === 'group' ? 'student' : data.role,
      profileId: data.profile_id,
      displayName: data.display_name ?? '',
      groupId: data.group_id,
      groupStatus: data.group_status,
      groupStatusReason: data.group_status_reason,
      viaGoogle,
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => resolve(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // Supabase calls made inside this callback can deadlock, so run them next tick.
        setTimeout(() => resolve(session), 0)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [resolve])

  const signInWithUsername = async (username: string, password: string, remember: boolean) => {
    setAuthError(null)
    setRememberMe(remember)
    const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password })
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Wrong username or password.' : error.message)
  }

  const signInWithGoogle = async () => {
    setAuthError(null)
    setRememberMe(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } },
    })
    if (error) throw new Error(error.message)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  const refresh = async () => {
    const { data } = await supabase.auth.getSession()
    await resolve(data.session)
  }

  return (
    <AuthContext.Provider value={{ loading, user, authError, signInWithUsername, signInWithGoogle, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** Where each role lands after signing in. */
// eslint-disable-next-line react-refresh/only-export-components
export const homeFor = (role: Role) => (role === 'coordinator' ? '/admin' : role === 'student' ? '/student' : '/staff')
