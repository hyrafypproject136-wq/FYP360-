import { useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { useAdminData } from '../../admin/AdminData'
import { changeOwnPassword, saveSettings } from '../../lib/adminApi'
import { Avatar, Button, ErrorBox, Field, Panel, PasswordInput, inputCls, useAsync } from '../../components/ui'
import { PageHeader } from '../../layouts/WindowFrame'

const fields = [
  { key: 'university_name', label: 'University' },
  { key: 'department_name', label: 'Department' },
  { key: 'academic_year', label: 'Academic year', placeholder: '2026–2027' },
  { key: 'current_semester', label: 'Current semester', placeholder: 'Fall 2026', hint: 'Used as the default for new groups.' },
  { key: 'default_group_size', label: 'Default group size', type: 'number', hint: 'Member limit for new groups (normally 4).' },
]

export default function SettingsPage() {
  const { user } = useAuth()
  const { data, reload, toast } = useAdminData()
  const me = data.profiles.find((p) => p.id === user?.profileId)

  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, data.settings[f.key] ?? ''])))
  const session = useAsync()
  const pw = useAsync()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const saveSession = async (e: FormEvent) => {
    e.preventDefault()
    const ok = await session.attempt(async () => (await saveSettings(values), true))
    if (ok) {
      toast('Settings saved.')
      await reload()
    }
  }

  const savePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (password !== confirm) return pw.setError('The two passwords do not match.')
    const ok = await pw.attempt(async () => (await changeOwnPassword(password), true))
    if (ok) {
      setPassword('')
      setConfirm('')
      toast('Your password has been changed.')
    }
  }

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid xl:grid-cols-2 gap-5 items-start">
        <div className="flex flex-col gap-5">
          <Panel title="Your account">
            <div className="flex items-center gap-4">
              <Avatar name={user?.displayName || '?'} size={52} />
              <div>
                <div className="text-base font-semibold">{user?.displayName}</div>
                <div className="text-[13px] text-ink-3">FYP Coordinator{me && <> · <span className="font-mono">{me.username}</span></>}</div>
                {me?.contact_email && <div className="text-[13px] text-ink-3">Google sign-in: {me.contact_email}</div>}
              </div>
            </div>
          </Panel>

          <Panel title="Change your password">
            {user?.viaGoogle ? (
              <p className="text-[13px] text-ink-2">You signed in with Google. Sign in with your username to change your FYP360 password.</p>
            ) : (
              <form onSubmit={savePassword} className="flex flex-col gap-4">
                <Field label="New password" hint="At least 8 characters."><PasswordInput value={password} onChange={setPassword} generate={false} /></Field>
                <Field label="Type it again"><input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className={inputCls} /></Field>
                <ErrorBox message={pw.error} />
                <div><Button type="submit" disabled={pw.busy}>{pw.busy ? 'Saving…' : 'Change password'}</Button></div>
              </form>
            )}
          </Panel>
        </div>

        <Panel title="Academic session">
          <form onSubmit={saveSession} className="flex flex-col gap-4">
            {fields.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint}>
                <input
                  type={f.type ?? 'text'}
                  min={f.type === 'number' ? 1 : undefined}
                  max={f.type === 'number' ? 8 : undefined}
                  value={values[f.key]}
                  placeholder={f.placeholder}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  className={inputCls}
                />
              </Field>
            ))}
            <ErrorBox message={session.error} />
            <div><Button type="submit" disabled={session.busy}>{session.busy ? 'Saving…' : 'Save settings'}</Button></div>
          </form>
        </Panel>

        <MarksSettings />
      </div>
    </>
  )
}

/** Marks rules for both phases, the pass mark and which phase is running now. */
function MarksSettings() {
  const { data, reload, toast } = useAdminData()
  const keys = ['fyp1_weight_advisor', 'fyp1_weight_proposal', 'fyp1_weight_internal', 'fyp1_total', 'fyp2_weight_advisor', 'fyp2_weight_internal', 'fyp2_weight_external', 'fyp2_total', 'fyp1_absence_limit', 'fyp1_absent_counts_zero', 'pass_mark', 'current_phase'] as const
  const defaults: Record<(typeof keys)[number], string> = {
    fyp1_weight_advisor: '30', fyp1_weight_proposal: '10', fyp1_weight_internal: '60', fyp1_total: '40',
    fyp2_weight_advisor: '10', fyp2_weight_internal: '30', fyp2_weight_external: '20', fyp2_total: '60',
    fyp1_absence_limit: '2', fyp1_absent_counts_zero: 'true', pass_mark: '60', current_phase: 'fyp1',
  }
  const [v, setV] = useState(() => Object.fromEntries(keys.map((k) => [k, data.settings[k] ?? defaults[k]])) as Record<(typeof keys)[number], string>)
  const { error, setError, busy, attempt } = useAsync()
  const anyLocked = data.settings.fyp1_published === 'true' || data.settings.fyp2_published === 'true'
  const num = (k: (typeof keys)[number]) => Number(v[k])
  const sum1 = num('fyp1_weight_advisor') + num('fyp1_weight_proposal') + num('fyp1_weight_internal')
  const sum2 = num('fyp2_weight_advisor') + num('fyp2_weight_internal') + num('fyp2_weight_external')

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const numeric = keys.filter((k) => k !== 'fyp1_absent_counts_zero' && k !== 'current_phase')
    if (numeric.some((k) => !Number.isFinite(num(k)) || num(k) < 0)) return setError('Every number must be 0 or more.')
    if (num('fyp1_total') + num('fyp2_total') !== 100) return setError(`FYP-1 + FYP-2 must add up to 100 (now ${num('fyp1_total') + num('fyp2_total')}).`)
    if (sum1 <= 0 || sum2 <= 0) return setError('Each phase needs some marks.')
    if (!Number.isInteger(num('fyp1_absence_limit')) || num('fyp1_absence_limit') > 20) return setError('Allowed absences must be a whole number from 0 to 20.')
    if (num('pass_mark') <= 0 || num('pass_mark') > 100) return setError('Pass mark must be between 1 and 100.')
    if (v.current_phase !== (data.settings.current_phase ?? 'fyp1') && v.current_phase === 'fyp2' && data.settings.fyp1_published !== 'true' &&
      !window.confirm('FYP-1 results are not published yet. Start FYP-2 anyway?')) return
    const ok = await attempt(async () => (await saveSettings(v), true))
    if (ok) {
      toast('Marks settings saved.')
      await reload()
    }
  }

  const numField = (k: (typeof keys)[number], label: string, hint?: string) => (
    <Field key={k} label={label} hint={hint}>
      <input type="number" min={0} max={100} step={0.5} disabled={anyLocked} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} className={inputCls} />
    </Field>
  )

  return (
    <Panel title="Marks and phases">
      {anyLocked && <p className="mb-4 text-[13px] text-ink-2 rounded-xl bg-black/[0.04] px-3.5 py-2.5">Results are published, so marking rules are locked. Unpublish them on the Results page to change the rules.</p>}
      <form onSubmit={save} className="flex flex-col gap-5">
        <Field label="Phase running now" hint="New meetings are recorded in this phase. Absence counts start again in each phase.">
          <select value={v.current_phase} onChange={(e) => setV({ ...v, current_phase: e.target.value })} className={inputCls}>
            <option value="fyp1">FYP-1</option>
            <option value="fyp2">FYP-2</option>
          </select>
        </Field>
        <div>
          <div className="text-[13px] font-semibold mb-2">FYP-1 · score out of {sum1}, scaled to {v.fyp1_total}</div>
          <div className="grid sm:grid-cols-2 gap-4">
            {numField('fyp1_weight_advisor', 'Advisor marks', 'Class average (each out of 100) is scaled to this.')}
            {numField('fyp1_weight_proposal', 'Proposal defence', 'Jury enters marks out of this.')}
            {numField('fyp1_weight_internal', 'Internal evaluation', 'Jury enters marks out of this.')}
            {numField('fyp1_total', 'FYP-1 share of 100')}
          </div>
        </div>
        <div>
          <div className="text-[13px] font-semibold mb-2">FYP-2 · score out of {sum2}, scaled to {v.fyp2_total}</div>
          <div className="grid sm:grid-cols-2 gap-4">
            {numField('fyp2_weight_advisor', 'Advisor marks')}
            {numField('fyp2_weight_internal', 'Internal evaluation', 'Jury enters marks out of this.')}
            {numField('fyp2_weight_external', 'External evaluation', 'You enter the industry experts\' marks.')}
            {numField('fyp2_total', 'FYP-2 share of 100')}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {numField('pass_mark', 'Pass mark (out of 100)', 'FYP-2 must also reach this percentage.')}
          <Field label="Allowed absences per student" hint="Per phase. The next absence flags the student for you.">
            <input type="number" min={0} max={20} step={1} disabled={anyLocked} value={v.fyp1_absence_limit} onChange={(e) => setV({ ...v, fyp1_absence_limit: e.target.value })} className={inputCls} />
          </Field>
          <Field label="An absent class counts as" hint="For the advisor average.">
            <select disabled={anyLocked} value={v.fyp1_absent_counts_zero} onChange={(e) => setV({ ...v, fyp1_absent_counts_zero: e.target.value })} className={inputCls}>
              <option value="true">0 marks</option>
              <option value="false">Left out of the average</option>
            </select>
          </Field>
        </div>
        <ErrorBox message={error} />
        <div><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save marks settings'}</Button></div>
      </form>
    </Panel>
  )
}
