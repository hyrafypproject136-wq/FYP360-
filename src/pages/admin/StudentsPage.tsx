import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { GraduationCap, Pencil, Search, Trash2, UserPlus } from 'lucide-react'
import { useAdminData } from '../../admin/AdminData'
import { StudentDialog } from '../../admin/dialogs'
import { deleteStudent, moveStudent, type Member } from '../../lib/adminApi'
import { Avatar, Badge, Button, EmptyState, Panel, cx, inputCls } from '../../components/ui'
import { PageHeader } from '../../layouts/WindowFrame'

export default function StudentsPage() {
  const { data, run } = useAdminData()
  const [params, setParams] = useSearchParams()
  const filter = params.get('filter') === 'none' ? 'none' : 'all'
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Member | 'new' | null>(null)

  const groupById = useMemo(() => new Map(data.groups.map((g) => [g.id, g])), [data.groups])
  const counts = useMemo(() => {
    const c = new Map<string, number>()
    data.members.forEach((m) => m.group_id && c.set(m.group_id, (c.get(m.group_id) ?? 0) + 1))
    return c
  }, [data.members])
  const activeGroups = data.groups.filter((g) => g.status === 'active')
  const noGroup = data.members.filter((m) => !m.group_id).length

  const rows = data.members.filter((m) => {
    if (filter === 'none' && m.group_id) return false
    const q = query.trim().toLowerCase()
    return !q || `${m.full_name} ${m.student_id} ${m.email}`.toLowerCase().includes(q)
  })

  return (
    <>
      <PageHeader
        title="Students"
        subtitle="Everyone in the FYP phase. A student can be in only one group."
        actions={<Button icon={UserPlus} onClick={() => setEditing('new')}>Add student</Button>}
      />

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, student ID or e-mail" aria-label="Search students" className={cx(inputCls, 'pl-10 bg-white/70')} />
        </div>
        <div role="tablist" aria-label="Filter" className="flex gap-1 p-1 rounded-xl bg-black/[0.05]">
          {(['all', 'none'] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setParams(f === 'none' ? { filter: 'none' } : {})}
              className={cx('h-8 px-3 rounded-lg text-[13px] whitespace-nowrap cursor-pointer', filter === f ? 'bg-white shadow-sm font-medium' : 'text-ink-2')}
            >
              {f === 'all' ? `All ${data.members.length}` : `Not in a group ${noGroup}`}
            </button>
          ))}
        </div>
      </div>

      {filter === 'none' && noGroup > 0 && (
        <p className="text-[13px] text-ink-2 mb-4">Choose a group for each student below. Full groups are greyed out; raise a group’s member limit on its page if needed.</p>
      )}

      <Panel padded={false}>
        {rows.length === 0 ? (
          <EmptyState icon={GraduationCap} title={filter === 'none' && data.members.length ? 'Everyone has a group' : data.members.length ? 'No students match' : 'No students yet'}>
            {!data.members.length && 'Add students here or straight into a group from its page.'}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-3 border-b border-black/5">
                  <th className="font-medium px-5 py-3">Student</th>
                  <th className="font-medium px-3 py-3">Student ID</th>
                  <th className="font-medium px-3 py-3">Group</th>
                  <th className="px-5 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {rows.map((m) => {
                  const g = m.group_id ? groupById.get(m.group_id) : undefined
                  return (
                    <tr key={m.id} className="hover:bg-black/[0.02]">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={m.full_name} size={32} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 font-medium">{m.full_name} {m.is_lead && <Badge tone="green">Lead</Badge>}{!m.eligible && <Badge tone="red">Not eligible</Badge>}</div>
                            <div className="text-xs text-ink-3 truncate">{m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">{m.student_id}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <select
                            aria-label={`Group of ${m.full_name}`}
                            value={m.group_id ?? ''}
                            onChange={(e) => {
                              const to = e.target.value || null
                              run(() => moveStudent(m.id, to), to ? `${m.full_name} placed in ${groupById.get(to)?.code}.` : `${m.full_name} removed from the group.`)
                            }}
                            className={cx('h-8 text-xs rounded-lg px-2 max-w-[230px] cursor-pointer', m.group_id ? 'bg-black/[0.05]' : 'bg-warn-soft text-warn font-medium')}
                          >
                            <option value="">Not in a group</option>
                            {g && g.status !== 'active' && <option value={g.id}>{g.code} ({g.status})</option>}
                            {activeGroups.map((x) => {
                              const n = counts.get(x.id) ?? 0
                              const isFull = n >= x.max_members && x.id !== m.group_id
                              return <option key={x.id} value={x.id} disabled={isFull}>{x.code} · {x.name} ({n}/{x.max_members}){isFull ? ' full' : ''}</option>
                            })}
                          </select>
                          {g && <Link to={`/admin/groups/${g.id}`} className="text-xs text-accent font-medium whitespace-nowrap">Open</Link>}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <Button variant="ghost" size="sm" icon={Pencil} aria-label={`Edit ${m.full_name}`} onClick={() => setEditing(m)} />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          aria-label={`Delete ${m.full_name}`}
                          onClick={() => window.confirm(`Delete ${m.full_name} (${m.student_id})? Use this only if the student left the university.`) && run(() => deleteStudent(m.id), 'Student deleted.')}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {editing && <StudentDialog student={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  )
}
