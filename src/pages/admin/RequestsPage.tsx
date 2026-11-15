import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Inbox, KeyRound, X } from 'lucide-react'
import { useAdminData, type AdminData } from '../../admin/AdminData'
import { ResetPasswordDialog } from '../../admin/dialogs'
import { setRequestStatus, type Profile, type ResetRequest } from '../../lib/adminApi'
import { Badge, Button, EmptyState, Panel, cx, formatDate, timeAgo } from '../../components/ui'
import { PageHeader } from '../../layouts/WindowFrame'

/** Find the login a request is about: a username, or a student ID / e-mail that leads to the group login. */
function matchAccount(d: AdminData, r: ResetRequest): { profile: Profile; label: string } | null {
  const id = r.identifier.trim().toLowerCase()
  const byUsername = d.profiles.find((p) => p.username === id || p.contact_email === id)
  if (byUsername) return { profile: byUsername, label: byUsername.role === 'group' ? 'Group login' : byUsername.display_name }
  const member = d.members.find((m) => m.student_id.toLowerCase() === id || m.email === id)
  if (member?.group_id) {
    const g = d.groups.find((x) => x.id === member.group_id)
    const p = d.profiles.find((x) => x.id === g?.account_id)
    if (p && g) return { profile: p, label: `${member.full_name} → ${g.code}` }
  }
  return null
}

export default function RequestsPage() {
  const { data, run } = useAdminData()
  const [tab, setTab] = useState<'open' | 'closed'>('open')
  const [resetting, setResetting] = useState<{ profile: Profile; requestId: string } | null>(null)

  const rows = data.requests.filter((r) => (tab === 'open' ? r.status === 'open' : r.status !== 'open'))
  const openCount = data.requests.filter((r) => r.status === 'open').length

  return (
    <>
      <PageHeader title="Password requests" subtitle="Students who forgot their password. Only you can set a new one; the old one is never shown." />

      <div role="tablist" aria-label="Status" className="flex gap-1 p-1 rounded-xl bg-black/[0.05] w-fit mb-4">
        {(['open', 'closed'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={cx('h-8 px-3 rounded-lg text-[13px] cursor-pointer', tab === t ? 'bg-white shadow-sm font-medium' : 'text-ink-2')}>
            {t === 'open' ? `Open ${openCount}` : 'Handled'}
          </button>
        ))}
      </div>

      <Panel padded={false}>
        {rows.length === 0 ? (
          <EmptyState icon={Inbox} title={tab === 'open' ? 'No open requests' : 'Nothing handled yet'} />
        ) : (
          <ul className="divide-y divide-black/5">
            {rows.map((r) => {
              const match = matchAccount(data, r)
              const group = match?.profile.role === 'group' ? data.groups.find((g) => g.account_id === match.profile.id) : undefined
              return (
                <li key={r.id} className="px-5 py-4 flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm">{r.identifier}</span>
                      {match ? <Badge tone="blue">{match.label}</Badge> : <Badge tone="grey">No matching account</Badge>}
                      {r.status !== 'open' && <Badge tone={r.status === 'done' ? 'green' : 'red'}>{r.status === 'done' ? 'Password reset' : 'Rejected'}</Badge>}
                    </div>
                    {r.note && <p className="text-[13px] text-ink-2 mt-1">“{r.note}”</p>}
                    <div className="text-xs text-ink-3 mt-1" title={formatDate(r.created_at)}>
                      Sent {timeAgo(r.created_at)}
                      {group && <> · <Link to={`/admin/groups/${group.id}`} className="text-accent">{group.code} · {group.name}</Link></>}
                    </div>
                  </div>
                  {r.status === 'open' && (
                    <div className="flex gap-1.5">
                      <Button size="sm" icon={KeyRound} disabled={!match} onClick={() => match && setResetting({ profile: match.profile, requestId: r.id })}>Reset password</Button>
                      <Button variant="secondary" size="sm" icon={Check} onClick={() => run(() => setRequestStatus(r.id, 'done'), 'Marked as handled.')}>Handled</Button>
                      <Button variant="ghost" size="sm" icon={X} aria-label="Reject request" onClick={() => run(() => setRequestStatus(r.id, 'rejected'), 'Request rejected.')} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      {resetting && <ResetPasswordDialog profile={resetting.profile} requestId={resetting.requestId} onClose={() => setResetting(null)} />}
    </>
  )
}
