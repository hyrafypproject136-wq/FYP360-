import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Plus, Search, UsersRound } from 'lucide-react'
import { groupGaps, membersOf, profileName, useAdminData } from '../../admin/AdminData'
import { GroupDialog } from '../../admin/dialogs'
import type { GroupStatus } from '../../lib/adminApi'
import { Badge, Button, EmptyState, Panel, StatusBadge, cx, inputCls } from '../../components/ui'
import { PageHeader } from '../../layouts/WindowFrame'

const filters: { id: GroupStatus | 'all' | 'incomplete'; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'incomplete', label: 'Needs setup' },
  { id: 'disqualified', label: 'Disqualified' },
  { id: 'dissolved', label: 'Dissolved' },
  { id: 'all', label: 'All' },
]

export default function GroupsPage() {
  const { data } = useAdminData()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<(typeof filters)[number]['id']>('active')
  const [creating, setCreating] = useState(false)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.groups.filter((g) => {
      if (filter === 'incomplete' ? groupGaps(data, g).length === 0 : filter !== 'all' && g.status !== filter) return false
      if (!q) return true
      const text = membersOf(data, g.id).map((m) => `${m.full_name} ${m.student_id} ${m.email}`).join(' ')
      return `${g.code} ${g.name} ${g.section ?? ''} ${text}`.toLowerCase().includes(q)
    })
  }, [data, query, filter])

  const countFor = (id: (typeof filters)[number]['id']) =>
    id === 'all' ? data.groups.length : id === 'incomplete' ? data.groups.filter((g) => groupGaps(data, g).length > 0).length : data.groups.filter((g) => g.status === id).length

  return (
    <>
      <PageHeader
        title="Groups"
        subtitle="Create groups from the names students send, then add members, a lead, supervisor, jury and a login."
        actions={<Button icon={Plus} onClick={() => setCreating(true)}>New group</Button>}
      />

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search group, student name, ID or e-mail" aria-label="Search groups" className={cx(inputCls, 'pl-10 bg-white/70')} />
        </div>
        <div role="tablist" aria-label="Filter" className="flex gap-1 p-1 rounded-xl bg-black/[0.05] overflow-x-auto">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cx('h-8 px-3 rounded-lg text-[13px] whitespace-nowrap cursor-pointer transition', filter === f.id ? 'bg-white shadow-sm font-medium text-ink' : 'text-ink-2 hover:text-ink')}
            >
              {f.label} <span className="text-ink-3">{countFor(f.id)}</span>
            </button>
          ))}
        </div>
      </div>

      <Panel padded={false}>
        {rows.length === 0 ? (
          <EmptyState icon={UsersRound} title={data.groups.length ? 'No groups match' : 'No groups yet'}>
            {data.groups.length ? 'Try another search or filter.' : 'Create the first group, then add the students the department received by e-mail.'}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-black/5">
            {rows.map((g) => {
              const members = membersOf(data, g.id)
              const lead = members.find((m) => m.is_lead)
              const gaps = groupGaps(data, g)
              return (
                <li key={g.id}>
                  <Link to={`/admin/groups/${g.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-black/[0.025] transition">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold truncate">{g.name}</span>
                        <span className="font-mono text-[11px] text-ink-3">{g.code}</span>
                        {g.status !== 'active' && <StatusBadge status={g.status} />}
                      </div>
                      <div className="text-xs text-ink-3 mt-0.5 truncate">
                        {lead ? `Lead: ${lead.full_name}` : 'No lead'} · Supervisor: {profileName(data, g.supervisor_id) ?? '—'}
                        {g.section && ` · Section ${g.section}`}
                      </div>
                    </div>
                    <div className="hidden sm:flex gap-1 flex-wrap justify-end max-w-[40%]">
                      {gaps.slice(0, 3).map((x) => <Badge key={x} tone="amber">{x}</Badge>)}
                    </div>
                    <Badge tone={members.length >= g.max_members ? 'blue' : 'grey'}>{members.length}/{g.max_members}</Badge>
                    <ChevronRight size={16} className="text-ink-3 shrink-0" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      {creating && <GroupDialog onClose={() => setCreating(false)} onSaved={(g) => navigate(`/admin/groups/${g.id}`)} />}
    </>
  )
}
