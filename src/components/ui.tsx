/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Check, Copy, Eye, EyeOff, RefreshCw, X, type LucideIcon } from 'lucide-react'
import { generatePassword, type GroupStatus } from '../lib/adminApi'
import { errorMessage } from '../lib/supabase'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export const inputCls =
  'w-full h-10 px-3.5 rounded-xl bg-field text-sm text-ink placeholder:text-ink-3 border border-transparent outline-none transition focus:bg-white focus:border-accent/40 focus:ring-4 focus:ring-accent/15 disabled:opacity-60'

export const textareaCls = inputCls.replace('h-10', 'min-h-[84px] py-2.5')

// ------------------------------------------------------------------ Button

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-black/85 shadow-sm',
  secondary: 'bg-white/80 text-ink border border-line hover:bg-white shadow-sm',
  danger: 'bg-bad-soft text-bad hover:bg-bad/20',
  ghost: 'text-ink-2 hover:bg-black/5 hover:text-ink',
}

export function Button({
  variant = 'primary',
  icon: Icon,
  size = 'md',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: LucideIcon; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 font-medium rounded-xl transition cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm' && 'h-8 px-2.5 text-xs',
        size === 'md' && 'h-9 px-3.5 text-sm',
        size === 'lg' && 'h-12 px-5 text-[15px] font-semibold',
        variants[variant],
        className,
      )}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 16} strokeWidth={2} aria-hidden />}
      {children}
    </button>
  )
}

// ------------------------------------------------------------------ Form bits

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </label>
  )
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div role="alert" className="px-3.5 py-2.5 rounded-xl bg-bad-soft text-bad text-[13px]">
      {message}
    </div>
  )
}

export function PasswordInput({ value, onChange, generate = true }: { value: string; onChange: (v: string) => void; generate?: boolean }) {
  const [show, setShow] = useState(true)
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          minLength={8}
          required
          autoComplete="new-password"
          onChange={(e) => onChange(e.target.value)}
          className={cx(inputCls, 'font-mono pr-10')}
        />
        <button
          type="button"
          aria-label={show ? 'Hide password' : 'Show password'}
          onClick={() => setShow(!show)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink cursor-pointer"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {generate && (
        <Button variant="secondary" icon={RefreshCw} onClick={() => onChange(generatePassword())}>
          New
        </Button>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ Badges

const tones = {
  green: 'bg-good-soft text-good',
  red: 'bg-bad-soft text-bad',
  amber: 'bg-warn-soft text-warn',
  blue: 'bg-accent-soft text-accent',
  grey: 'bg-black/[0.06] text-ink-2',
}
export function Badge({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  return <span className={cx('inline-flex items-center h-5 px-2 rounded-full text-[11px] font-semibold whitespace-nowrap', tones[tone])}>{children}</span>
}

export function StatusBadge({ status }: { status: GroupStatus }) {
  if (status === 'active') return <Badge tone="green">Active</Badge>
  if (status === 'disqualified') return <Badge tone="red">Disqualified</Badge>
  return <Badge tone="grey">Dissolved</Badge>
}

// ------------------------------------------------------------------ Panels

export function Panel({ title, action, children, className, padded = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cx('rounded-2xl bg-white/75 border border-white/70 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(0_0_0/0.12)]', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
          {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
          {action}
        </div>
      )}
      <div className={cx(padded && 'px-5 pb-5', !title && !action && padded && 'pt-5')}>{children}</div>
    </section>
  )
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="py-12 flex flex-col items-center text-center gap-2">
      <div className="w-12 h-12 rounded-2xl bg-black/[0.04] grid place-items-center text-ink-3">
        <Icon size={22} />
      </div>
      <div className="text-sm font-semibold text-ink">{title}</div>
      {children && <div className="text-[13px] text-ink-3 max-w-sm">{children}</div>}
    </div>
  )
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-ink-3 text-sm" role="status">
      <span className="w-5 h-5 rounded-full border-2 border-black/10 border-t-ink-2 animate-spin" />
      {label}
    </div>
  )
}

// ------------------------------------------------------------------ Modal (macOS sheet style)

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px] flex items-center justify-center p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={cx('glass-strong window-shadow rounded-2xl w-full max-h-[90vh] overflow-y-auto toast-in', wide ? 'max-w-2xl' : 'max-w-md')}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="w-7 h-7 grid place-items-center rounded-full hover:bg-black/5 text-ink-3 cursor-pointer">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 pb-5 pt-2">{children}</div>
      </div>
    </div>
  )
}

export function ModalActions({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-2 pt-2">{children}</div>
}

// ------------------------------------------------------------------ One-time password display

export function PasswordResult({
  username,
  password,
  forGroup,
  emailed,
  emailConfigured,
  emailError,
  onDone,
}: {
  username: string
  password: string
  forGroup: boolean
  emailed?: number
  emailConfigured?: boolean
  emailError?: string
  onDone: () => void
}) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Username: ${username}\nPassword: ${password}`)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-black/[0.04] p-4 font-mono text-sm space-y-1.5">
        <div><span className="text-ink-3">Username  </span>{username}</div>
        <div><span className="text-ink-3">Password  </span>{password}</div>
      </div>
      <div className="rounded-xl bg-warn-soft text-warn text-[13px] px-3.5 py-2.5">
        {forGroup ? 'Give this to the group lead now.' : 'Give this to the account holder now.'} It will not be shown again. If it is lost, reset the password.
      </div>
      {forGroup && (
        <p className="text-[13px] text-ink-2">
          {emailConfigured === false
            ? 'E-mail sending is not set up yet, so members were notified inside the portal only.'
            : emailError
              ? `Members were notified in the portal, but the e-mail failed: ${emailError}`
              : `Members were notified in the portal and ${emailed ?? 0} e-mail${emailed === 1 ? '' : 's'} were sent.`}
        </p>
      )}
      <ModalActions>
        <Button variant="secondary" icon={copied ? Check : Copy} onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
        <Button onClick={onDone}>Done</Button>
      </ModalActions>
    </div>
  )
}

// ------------------------------------------------------------------ helpers

export function useAsync() {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const attempt = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true)
    setError(null)
    try {
      return await fn()
    } catch (e) {
      setError(errorMessage(e))
      return undefined
    } finally {
      setBusy(false)
    }
  }
  return { error, setError, busy, attempt }
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export const timeAgo = (iso: string) => {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export const initials = (name: string) =>
  name
    .replace(/^(dr|prof|mr|ms|mrs)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className="shrink-0 rounded-full grid place-items-center font-semibold text-white bg-gradient-to-br from-[#5e5ce6] to-[#bf5af2]"
    >
      {initials(name) || '?'}
    </span>
  )
}
