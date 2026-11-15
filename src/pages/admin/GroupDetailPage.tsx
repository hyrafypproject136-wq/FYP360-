import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, KeyRound, Pencil, RotateCcw, Star, Trash2, UserPlus, UsersRound, Unlink } from 'lucide-react'
import { groupGaps, membersOf, useAdminData } from '../../admin/AdminData'
import { GroupDialog, GroupLoginDialog, GroupStatusDialog, ResetPasswordDialog, StudentDialog } from '../../admin/dialogs'
import { deleteLogin, moveStudent, setGroupStatus, setJury, setLead, updateGroup } from '../../lib/adminApi'
import { Avatar, Badge, Button, EmptyState, Panel, StatusBadge, cx, formatDate, inputCls } from '../../components/ui'

type Dialog = null | 'edit' | 'new-student' | 'login' | 'reset' | 'disqualify' | 'dissolve'

export default function GroupDetailPage() {
  const { id } = useParams()
  const { data, run } = useAdminData()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [pick, setPick] = useState('')
  const [jurySel, setJurySel] = useState<string[] | null>(null)

  const group = data.groups.find((g) => g.id === id)
  if (!group) {
    return (
      <EmptyState icon={UsersRound} title="Group not found">
        <Link to="/admin/groups" className="text-accent font-medium">Back to groups</Link>
      </EmptyState>
    )
  }

  const members = membersOf(data, group.id)
  const unassigned = data.members.filter((m) => !m.group_id)
  const supervisors = data.profiles.filter((p) => p.role === 'supervisor')
  const juryOptions = data.profiles.filter((p) => (p.role === 'jury' || p.role === 'supervisor') && p.id !== group.supervisor_id)
  const currentJury = data.jury.filter((j) => j.group_id === group.id).map((j) => j.jury_id)
  const jury = jurySel ?? currentJury
  const juryDirty = jurySel !== null && (jurySel.length !== currentJury.length || jurySel.some((j) => !currentJury.includes(j)))
  const account = data.profiles.find((p) => p.id === group.account_id)
  const moveTargets = data.groups.filter((g) => g.id !== group.id && g.status === 'active')
  const active = group.status === 'active'
  const full = members.length >= group.max_members
  const gaps = groupGaps(data, group)

  return (
    <>
      <Link to="/admin/groups" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink mb-4">
        <ArrowLeft size={15} /> Groups
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs text-ink-3">{group.code}</span>
            <StatusBadge status={group.status} />
          </div>
          <h1 className="text-[26px] font-bold tracking-tight leading-tight">{group.name}</h1>
          <p className="text-sm text-ink-2 mt-1">
            {[group.section && `Section ${group.section}`, group.batch, group.semester].filter(Boolean).join(' · ') || 'No section set'}
          </p>
          {!active && group.status_reason && (
            <p className="mt-3 text-[13px] rounded-xl bg-bad-soft text-bad px-3.5 py-2.5">
              {group.status === 'disqualified' ? 'Disqualified' : 'Dissolved'}
              {group.status_changed_at && ` on ${formatDate(group.status_changed_at)}`}: {group.status_reason}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" icon={Pencil} onClick={() => setDialog('edit')}>Edit</Button>
          {active && <Button variant="danger" icon={Ban} onClick={() => setDialog('disqualify')}>Disqualify</Button>}
          {active && <Button variant="danger" icon={Unlink} onClick={() => setDialog('dissolve')}>Dissolve</Button>}
          {group.status === 'disqualified' && (
            <Button
              variant="secondary"
              icon={RotateCcw}
              onClick={() => window.confirm(`Reinstate ${group.code}? Its members get portal access back.`) && run(() => setGroupStatus(group.id, 'active', null), `${group.code} reinstated.`)}
            >
              Reinstate
            </Button>
          )}
        </div>
      </div>

      {active && gaps.length > 0 && (
        <div className="mb-5 flex items-center gap-2 flex-wrap text-[13px] text-ink-2">
          Still to do: {gaps.map((x) => <Badge key={x} tone="amber">{x}</Badge>)}
        </div>
      )}

      <div className="grid xl:grid-cols-[1.4fr_1fr] gap-5">
        {/* Members */}
        <Panel
          title={<>Members <span className={cx('font-normal', full ? 'text-warn' : 'text-ink-3')}>{members.length} of {group.max_members}</span></>}
          action={active && <Button variant="secondary" size="sm" icon={UserPlus} disabled={full} onClick={() => setDialog('new-student')}>New student</Button>}
        >
          {members.length === 0 ? (
            <p className="text-[13px] text-ink-3 py-4">No members yet. Add a student who has no group, or create a new one.</p>
          ) : (
            <ul className="divide-y divide-black/5 -mx-1">
              {members.map((m) => (
                <li key={m.id} className="px-1 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar name={m.full_name} size={34} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{m.full_name}</span>
                        {m.is_lead && <Badge tone="green">Lead</Badge>}
                      </div>
                      <div className="text-xs text-ink-3 truncate"><span className="font-mono">{m.student_id}</span> · {m.email}</div>
                    </div>
                  </div>
                  {active && (
                    <div className="flex items-center gap-1.5 sm:justify-end">
                      {!m.is_lead && (
                        <Button variant="ghost" size="sm" icon={Star} onClick={() => run(() => setLead(m.id), `${m.full_name} is now the lead.`)}>Make lead</Button>
                      )}
                      <select
                        aria-label={`Move ${m.full_name}`}
                        value=""
                        onChange={(e) => {
                          const to = e.target.value === '__none' ? null : e.target.value
                          const target = data.groups.find((g) => g.id === to)
                          run(() => moveStudent(m.id, to), to ? `${m.full_name} moved to ${target?.code}.` : `${m.full_name} removed from ${group.code}.`)
                        }}
                        className="h-8 text-xs rounded-lg bg-black/[0.05] px-2 cursor-pointer font-medium text-ink-2"
                      >
                        <option value="" disabled>Move…</option>
                        <option value="__none">Remove from group</option>
                        {moveTargets.map((g) => {
                          const n = membersOf(data, g.id).length
                          return (
                            <option key={g.id} value={g.id} disabled={n >= g.max_members}>
                              {g.code} · {g.name} ({n}/{g.max_members}){n >= g.max_members ? ' full' : ''}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {active && !full && unassigned.length > 0 && (
            <div className="mt-3 flex gap-2">
              <select value={pick} onChange={(e) => setPick(e.target.value)} className={inputCls} aria-label="Student without a group">
                <option value="">Add a student who has no group…</option>
                {unassigned.map((m) => <option key={m.id} value={m.id}>{m.full_name} · {m.student_id}</option>)}
              </select>
              <Button
                disabled={!pick}
                onClick={async () => {
                  const s = unassigned.find((m) => m.id === pick)
                  if (await run(() => moveStudent(pick, group.id), `${s?.full_name} added to ${group.code}.`)) setPick('')
                }}
              >
                Add
              </Button>
            </div>
          )}
          {active && full && <p className="mt-3 text-xs text-warn">The group is full. Use Edit to raise the member limit if it must take a student from a dissolved group.</p>}
        </Panel>

        <div className="flex flex-col gap-5">
          {/* Login */}
          <Panel title="Group login">
            <p className="text-[13px] text-ink-2 mb-3">One username and password for the whole group. Members can also use “Sign in with Google” with their listed e-mail.</p>
            {account ? (
              <div className="flex flex-col gap-3">
                <div className="rounded-xl bg-black/[0.04] px-3.5 py-2.5 font-mono text-sm"><span className="text-ink-3">Username </span>{account.username}</div>
                <div className="flex gap-2">
                  <Button variant="secondary" icon={KeyRound} onClick={() => setDialog('reset')}>Reset password</Button>
                  <Button
                    variant="danger"
                    icon={Trash2}
                    onClick={() => window.confirm(`Delete the login "${account.username}"? The group can no longer sign in with it.`) && run(() => deleteLogin(account.id), 'Group login deleted.')}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ) : active ? (
              <Button icon={KeyRound} onClick={() => setDialog('login')}>Create group login</Button>
            ) : (
              <p className="text-[13px] text-ink-3">No login.</p>
            )}
          </Panel>

          {/* Supervisor */}
          <Panel title="Supervisor">
            {supervisors.length === 0 ? (
              <p className="text-[13px] text-ink-3">Create a supervisor login in <Link to="/admin/staff" className="text-accent">Staff accounts</Link> first.</p>
            ) : (
              <select
                value={group.supervisor_id ?? ''}
                disabled={!active}
                aria-label="Supervisor"
                onChange={(e) => {
                  const sid = e.target.value || null
                  run(() => updateGroup(group.id, { supervisor_id: sid }), sid ? 'Supervisor assigned.' : 'Supervisor removed.')
                }}
                className={inputCls}
              >
                <option value="">Not assigned</option>
                {supervisors.map((s) => {
                  const load = data.groups.filter((g) => g.supervisor_id === s.id && g.status === 'active').length
                  const onJury = currentJury.includes(s.id)
                  return (
                    <option key={s.id} value={s.id} disabled={onJury}>
                      {s.display_name} · {load} group{load === 1 ? '' : 's'}{onJury ? ' · on this jury' : ''}
                    </option>
                  )
                })}
              </select>
            )}
          </Panel>

          {/* Jury */}
          <Panel title="Jury" action={juryDirty && <span className="text-xs text-warn">Not saved</span>}>
            {juryOptions.length === 0 ? (
              <p className="text-[13px] text-ink-3">Create jury logins in <Link to="/admin/staff" className="text-accent">Staff accounts</Link> first.</p>
            ) : (
              <>
                <div className="max-h-52 overflow-y-auto rounded-xl bg-black/[0.03] divide-y divide-black/5">
                  {juryOptions.map((p) => (
                    <label key={p.id} className="flex items-center gap-3 px-3.5 py-2.5 text-sm cursor-pointer hover:bg-black/[0.03]">
                      <input type="checkbox" disabled={!active} checked={jury.includes(p.id)} onChange={(e) => setJurySel(e.target.checked ? [...jury, p.id] : jury.filter((j) => j !== p.id))} className="w-4 h-4 accent-[#0a72e8]" />
                      <span className="flex-1">{p.display_name}</span>
                      <span className="text-[11px] text-ink-3 capitalize">{p.role}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-ink-3 mt-2">A group’s supervisor cannot sit on its jury.</p>
                {juryDirty && (
                  <div className="flex justify-end gap-2 mt-3">
                    <Button variant="secondary" size="sm" onClick={() => setJurySel(null)}>Undo</Button>
                    <Button size="sm" onClick={async () => { if (await run(() => setJury(group.id, jury, currentJury), 'Jury saved.')) setJurySel(null) }}>Save jury</Button>
                  </div>
                )}
              </>
            )}
          </Panel>
        </div>
      </div>

      {dialog === 'edit' && <GroupDialog group={group} onClose={() => setDialog(null)} />}
      {dialog === 'new-student' && <StudentDialog groupId={group.id} onClose={() => setDialog(null)} />}
      {dialog === 'login' && <GroupLoginDialog group={group} onClose={() => setDialog(null)} />}
      {dialog === 'reset' && account && <ResetPasswordDialog profile={account} onClose={() => setDialog(null)} />}
      {(dialog === 'disqualify' || dialog === 'dissolve') && <GroupStatusDialog group={group} kind={dialog} onClose={() => setDialog(null)} />}
    </>
  )
}
