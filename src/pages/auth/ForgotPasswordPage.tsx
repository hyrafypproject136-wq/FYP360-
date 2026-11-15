import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { requestPasswordReset } from '../../lib/adminApi'
import { Button, ErrorBox, inputCls, textareaCls, cx, useAsync } from '../../components/ui'
import { AuthShell } from './AuthShell'

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('')
  const [note, setNote] = useState('')
  const [sent, setSent] = useState(false)
  const { error, busy, attempt } = useAsync()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const ok = await attempt(async () => (await requestPasswordReset(identifier, note), true))
    if (ok) setSent(true)
  }

  return (
    <AuthShell>
      {sent ? (
        <div className="text-center flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-good-soft text-good grid place-items-center">
            <MailCheck size={26} />
          </div>
          <h1 className="text-[28px] font-bold tracking-tight">Request sent</h1>
          <p className="text-[15px] text-ink-2">
            Your FYP coordinator will set a new password and give it to your group lead. Every group member gets an e-mail when the password changes.
          </p>
          <Link to="/login" className="mt-2 text-sm font-semibold text-accent hover:underline">Back to login</Link>
        </div>
      ) : (
        <>
          <div className="text-center mb-8">
            <h1 className="text-[34px] font-bold tracking-tight leading-tight">Forgot password?</h1>
            <p className="mt-3 text-[15px] text-ink-2">Only your FYP coordinator can set a new password. Send them a request.</p>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-5">
            <ErrorBox message={error} />
            <label className="flex flex-col gap-2">
              <span className="text-[14px] font-medium text-ink-2">Username, student ID or e-mail</span>
              <input required minLength={3} autoFocus value={identifier} onChange={(e) => setIdentifier(e.target.value)} className={cx(inputCls, 'h-12 px-4 text-[15px] bg-black/[0.06]')} />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-[14px] font-medium text-ink-2">Message (optional)</span>
              <textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. I am the lead of group FYP-2026-004" className={cx(textareaCls, 'px-4 text-[15px] bg-black/[0.06]')} />
            </label>
            <Button type="submit" size="lg" disabled={busy} className="w-full">{busy ? 'Sending…' : 'Send request'}</Button>
            <Link to="/login" className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink">
              <ArrowLeft size={16} /> Back to login
            </Link>
          </form>
        </>
      )}
    </AuthShell>
  )
}
