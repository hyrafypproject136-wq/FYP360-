import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { errorMessage } from '../../lib/supabase'
import { Button, ErrorBox, inputCls, cx } from '../../components/ui'
import { AuthShell } from './AuthShell'

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

export default function LoginPage() {
  const { signInWithUsername, signInWithGoogle, authError } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signInWithUsername(username, password, remember)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  const google = async () => {
    setError(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const fieldCls = cx(inputCls, 'h-12 px-4 text-[15px] rounded-xl bg-black/[0.06]')

  return (
    <AuthShell>
      <div className="text-center mb-9">
        <h1 className="text-[40px] font-bold tracking-tight leading-none">Login</h1>
        <p className="mt-3 text-[15px] text-ink-2">Enter your credentials to get in</p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-5">
        <ErrorBox message={error ?? authError} />

        <label className="flex flex-col gap-2">
          <span className="text-[14px] font-medium text-ink-2">Username</span>
          <input
            required
            autoFocus
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. fyp-2026-001"
            className={fieldCls}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="flex items-center justify-between text-[14px] font-medium text-ink-2">
            Password
            <Link to="/forgot-password" className="text-[13px] font-medium text-accent hover:underline">
              Forgot password?
            </Link>
          </span>
          <span className="relative">
            <input
              required
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={cx(fieldCls, 'pr-11')}
            />
            <button
              type="button"
              aria-label={show ? 'Hide password' : 'Show password'}
              onClick={() => setShow(!show)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink cursor-pointer"
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>

        <label className="flex items-center gap-2.5 text-[14px] text-ink-2 cursor-pointer -mt-1 w-fit">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-[18px] h-[18px] rounded accent-[#111]" />
          Remember me
        </label>

        <Button type="submit" size="lg" disabled={busy} className="w-full mt-1">
          {busy ? 'Signing in…' : 'Login'}
        </Button>

        <div className="flex items-center gap-3 text-xs text-ink-3">
          <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
        </div>

        <Button variant="secondary" size="lg" onClick={google} className="w-full !font-medium">
          <GoogleMark /> Sign in with Google
        </Button>

        <p className="text-center text-[13px] text-ink-3">
          No account? <span className="font-semibold text-ink">Your FYP coordinator creates it.</span>
        </p>
      </form>
    </AuthShell>
  )
}
