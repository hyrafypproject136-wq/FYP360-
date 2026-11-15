import { useState, type FormEvent } from 'react'
import {
  addStudent,
  createGroup,
  createGroupLogin,
  createStaffLogin,
  dissolveGroup,
  generatePassword,
  resetPassword,
  setGroupStatus,
  updateGroup,
  updateStudent,
  type AccountResult,
  type Group,
  type Member,
  type Profile,
  type StaffRole,
} from '../lib/adminApi'
import { Button, ErrorBox, Field, Modal, ModalActions, PasswordInput, PasswordResult, inputCls, textareaCls, useAsync } from '../components/ui'
import { membersOf, useAdminData } from './AdminData'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_PATTERN = '[a-z0-9._\\-]{3,32}'
const USERNAME_TITLE = '3–32 lowercase letters, numbers, dot, dash or underscore'

// ------------------------------------------------------------------ Group: new / edit

export function GroupDialog({ group, onClose, onSaved }: { group?: Group; onClose: () => void; onSaved?: (g: Group) => void }) {
  const { data, reload, toast } = useAdminData()
  const [name, setName] = useState(group?.name ?? '')
  const [section, setSection] = useState(group?.section ?? '')
  const [batch, setBatch] = useState(group?.batch ?? '')
  const [semester, setSemester] = useState(group?.semester ?? data.settings.current_semester ?? '')
  const [maxMembers, setMaxMembers] = useState(group?.max_members ?? Number(data.settings.default_group_size || 4))
  const { error, busy, attempt } = useAsync()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const fields = { name: name.trim(), section: section.trim() || null, batch: batch.trim() || null, semester: semester.trim() || null, max_members: maxMembers }
    const saved = await attempt(async () => {
      if (group) {
        await updateGroup(group.id, fields)
        return group
      }
      return createGroup(fields)
    })
    if (saved) {
      toast(group ? 'Group updated.' : `Group ${saved.code} created.`)
      await reload()
      onSaved?.(saved)
      onClose()
    }
  }

  return (
    <Modal title={group ? `Edit ${group.code}` : 'New group'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Group name" hint="For example the lead’s name or the project idea.">
          <input required autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Section"><input value={section} onChange={(e) => setSection(e.target.value)} className={inputCls} placeholder="A" /></Field>
          <Field label="Batch"><input value={batch} onChange={(e) => setBatch(e.target.value)} className={inputCls} placeholder="2022–2026" /></Field>
          <Field label="Semester"><input value={semester} onChange={(e) => setSemester(e.target.value)} className={inputCls} placeholder="Fall 2026" /></Field>
        </div>
        <Field label="Member limit" hint="Normally 4. Raise it only to take in students from a dissolved group.">
          <input type="number" min={1} max={8} required value={maxMembers} onChange={(e) => setMaxMembers(Number(e.target.value))} className={inputCls} />
        </Field>
        <ErrorBox message={error} />
        <ModalActions>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : group ? 'Save' : 'Create group'}</Button>
        </ModalActions>
      </form>
    </Modal>
  )
}

// ------------------------------------------------------------------ Student: new / edit

export function StudentDialog({ student, groupId = null, onClose }: { student?: Member; groupId?: string | null; onClose: () => void }) {
  const { data, reload, toast } = useAdminData()
  const [fullName, setFullName] = useState(student?.full_name ?? '')
  const [studentId, setStudentId] = useState(student?.student_id ?? '')
  const [email, setEmail] = useState(student?.email ?? '')
  const [eligible, setEligible] = useState(student?.eligible ?? true)
  const { error, setError, busy, attempt } = useAsync()
  const group = data.groups.find((g) => g.id === groupId)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!EMAIL_RE.test(email.trim())) return setError('Enter a valid e-mail address.')
    const id = studentId.trim().toUpperCase()
    const mail = email.trim().toLowerCase()
    const dupId = data.members.find((m) => m.student_id === id && m.id !== student?.id)
    if (dupId) return setError(`Student ID ${id} already belongs to ${dupId.full_name}. A student can be in only one group.`)
    const dupEmail = data.members.find((m) => m.email === mail && m.id !== student?.id)
    if (dupEmail) return setError(`${mail} already belongs to ${dupEmail.full_name}.`)

    const ok = await attempt(async () => {
      if (student) await updateStudent(student.id, { full_name: fullName.trim(), student_id: id, email: mail, eligible })
      else await addStudent({ full_name: fullName, student_id: id, email: mail, group_id: groupId, eligible })
      return true
    })
    if (ok) {
      toast(student ? 'Student updated.' : group ? `${fullName.trim()} added to ${group.code}.` : `${fullName.trim()} added.`)
      await reload()
      onClose()
    }
  }

  return (
    <Modal title={student ? 'Edit student' : group ? `New student in ${group.code}` : 'Add student'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Full name"><input required autoFocus value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} /></Field>
        <Field label="Student ID"><input required value={studentId} onChange={(e) => setStudentId(e.target.value)} className={`${inputCls} font-mono uppercase`} /></Field>
        <Field label="E-mail" hint="Used for “Sign in with Google” and password-change e-mails.">
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </Field>
        <label className="flex items-start gap-3 rounded-xl border border-line px-3.5 py-3 cursor-pointer">
          <input type="checkbox" checked={eligible} onChange={(e) => setEligible(e.target.checked)} className="w-4 h-4 mt-0.5 accent-[#0a72e8]" />
          <span className="text-sm">
            <span className="font-medium">Eligible for FYP</span>
            <span className="block text-xs text-ink-3">Passed {data.settings.eligibility_credit_hours || '89'} credit hours (not counting Sports and Internship).</span>
          </span>
        </label>
        <ErrorBox message={error} />
        <ModalActions>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : student ? 'Save' : 'Add student'}</Button>
        </ModalActions>
      </form>
    </Modal>
  )
}

// ------------------------------------------------------------------ Group login: create

export function GroupLoginDialog({ group, onClose }: { group: Group; onClose: () => void }) {
  const { reload } = useAdminData()
  const [username, setUsername] = useState(group.code.toLowerCase())
  const [password, setPassword] = useState(generatePassword)
  const [result, setResult] = useState<AccountResult | null>(null)
  const { error, busy, attempt } = useAsync()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const res = await attempt(() => createGroupLogin(group.id, username.trim().toLowerCase(), password))
    if (res) {
      setResult(res)
      await reload()
    }
  }

  return (
    <Modal title={`Create login for ${group.code}`} onClose={onClose}>
      {result ? (
        <PasswordResult username={username.trim().toLowerCase()} password={password} forGroup emailed={result.emailed} emailConfigured={result.emailConfigured} emailError={result.emailError} onDone={onClose} />
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-[13px] text-ink-2">One login is shared by the whole group. Every member is notified when it is created.</p>
          <Field label="Username">
            <input required value={username} pattern={USERNAME_PATTERN} title={USERNAME_TITLE} onChange={(e) => setUsername(e.target.value.toLowerCase())} className={`${inputCls} font-mono`} />
          </Field>
          <Field label="Password" hint="At least 8 characters.">
            <PasswordInput value={password} onChange={setPassword} />
          </Field>
          <ErrorBox message={error} />
          <ModalActions>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create login'}</Button>
          </ModalActions>
        </form>
      )}
    </Modal>
  )
}

// ------------------------------------------------------------------ Any login: reset password

export function ResetPasswordDialog({ profile, requestId, onClose }: { profile: Profile; requestId?: string; onClose: () => void }) {
  const { data, reload } = useAdminData()
  const [password, setPassword] = useState(generatePassword)
  const [result, setResult] = useState<AccountResult | null>(null)
  const { error, busy, attempt } = useAsync()
  const group = profile.role === 'group' ? data.groups.find((g) => g.account_id === profile.id) : undefined

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const res = await attempt(() => resetPassword(profile.id, password, requestId))
    if (res) {
      setResult(res)
      await reload()
    }
  }

  return (
    <Modal title={`Reset password · ${group ? group.code : profile.display_name}`} onClose={onClose}>
      {result ? (
        <PasswordResult username={profile.username} password={password} forGroup={profile.role === 'group'} emailed={result.emailed} emailConfigured={result.emailConfigured} emailError={result.emailError} onDone={onClose} />
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-[13px] text-ink-2">
            Login <span className="font-mono text-ink">{profile.username}</span>. The old password stops working at once and is never shown.
            {profile.role === 'group' && ' Every group member is notified.'}
          </p>
          <Field label="New password" hint="At least 8 characters.">
            <PasswordInput value={password} onChange={setPassword} />
          </Field>
          <ErrorBox message={error} />
          <ModalActions>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Resetting…' : 'Reset password'}</Button>
          </ModalActions>
        </form>
      )}
    </Modal>
  )
}

// ------------------------------------------------------------------ Disqualify / dissolve

export function GroupStatusDialog({ group, kind, onClose }: { group: Group; kind: 'disqualify' | 'dissolve'; onClose: () => void }) {
  const { data, reload, toast } = useAdminData()
  const [reason, setReason] = useState('')
  const { error, busy, attempt } = useAsync()
  const count = membersOf(data, group.id).length

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const ok = await attempt(async () => {
      if (kind === 'disqualify') await setGroupStatus(group.id, 'disqualified', reason.trim())
      else await dissolveGroup(group.id, reason.trim())
      return true
    })
    if (ok) {
      toast(kind === 'disqualify' ? `${group.code} disqualified.` : `${group.code} dissolved. Its students are waiting in “Not in a group”.`)
      await reload()
      onClose()
    }
  }

  return (
    <Modal title={kind === 'disqualify' ? `Disqualify ${group.code}` : `Dissolve ${group.code}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-[13px] text-ink-2">
          {kind === 'disqualify'
            ? 'Members will only see a “disqualified” notice with your reason when they sign in. You can reinstate the group later.'
            : `The ${count} member${count === 1 ? '' : 's'} move to “Not in a group”, and you then place each one in another group yourself. The group login stops opening the portal.`}
        </p>
        <Field label="Reason">
          <textarea required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={textareaCls}
            placeholder={kind === 'disqualify' ? 'e.g. Plagiarism in proposal, reported by Dr. …' : 'e.g. One member left the university'} />
        </Field>
        <ErrorBox message={error} />
        <ModalActions>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || !reason.trim()} className="!bg-bad !text-white hover:!bg-bad/90">
            {busy ? 'Working…' : kind === 'disqualify' ? 'Disqualify group' : 'Dissolve group'}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  )
}

// ------------------------------------------------------------------ Staff login: create

export function StaffDialog({ onClose }: { onClose: () => void }) {
  const { reload } = useAdminData()
  const [role, setRole] = useState<StaffRole>('supervisor')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(generatePassword)
  const [done, setDone] = useState(false)
  const { error, busy, attempt } = useAsync()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const res = await attempt(() => createStaffLogin({ role, username: username.trim().toLowerCase(), password, display_name: name.trim(), contact_email: email.trim() || null }))
    if (res) {
      setDone(true)
      await reload()
    }
  }

  return (
    <Modal title="Create staff login" onClose={onClose}>
      {done ? (
        <PasswordResult username={username.trim().toLowerCase()} password={password} forGroup={false} onDone={onClose} />
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Role">
            <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)} className={inputCls}>
              <option value="supervisor">Supervisor</option>
              <option value="jury">Jury member</option>
              <option value="coordinator">Coordinator (full admin access)</option>
            </select>
          </Field>
          <Field label="Full name"><input required autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Dr. …" /></Field>
          <Field label="Username">
            <input required value={username} pattern={USERNAME_PATTERN} title={USERNAME_TITLE} onChange={(e) => setUsername(e.target.value.toLowerCase())} className={`${inputCls} font-mono`} />
          </Field>
          <Field label="University e-mail (optional)" hint="Lets this person use “Sign in with Google”.">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Password" hint="At least 8 characters.">
            <PasswordInput value={password} onChange={setPassword} />
          </Field>
          <ErrorBox message={error} />
          <ModalActions>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create login'}</Button>
          </ModalActions>
        </form>
      )}
    </Modal>
  )
}
