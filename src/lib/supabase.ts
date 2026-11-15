import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Hidden e-mail domain behind every username login (must match the admin-accounts function). */
export const LOGIN_EMAIL_DOMAIN = 'login.fyp360.app'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

// "Remember me": keep the session in localStorage (survives closing the browser)
// or in sessionStorage (ends when the tab closes).
const REMEMBER_KEY = 'fyp360.remember'
export function setRememberMe(remember: boolean) {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0')
  } catch {
    /* storage blocked: Supabase falls back to memory */
  }
}
const activeStore = (): Storage | null => {
  try {
    return localStorage.getItem(REMEMBER_KEY) === '0' ? sessionStorage : localStorage
  } catch {
    return null
  }
}
const sessionStore = {
  getItem: (k: string) => activeStore()?.getItem(k) ?? null,
  setItem: (k: string, v: string) => activeStore()?.setItem(k, v),
  removeItem: (k: string) => {
    try {
      localStorage.removeItem(k)
      sessionStorage.removeItem(k)
    } catch {
      /* ignore */
    }
  },
}

export const supabase: SupabaseClient = createClient(url || 'http://localhost:54321', anonKey || 'missing-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: sessionStore },
})

export const usernameToEmail = (username: string) => `${username.trim().toLowerCase()}@${LOGIN_EMAIL_DOMAIN}`

/** Turn a Supabase/Postgres error into a sentence for the UI. */
export function errorMessage(e: unknown): string {
  if (!e) return 'Something went wrong.'
  if (typeof e === 'string') return e
  if (e instanceof Error) return e.message
  return (e as { message?: string }).message || 'Something went wrong.'
}
