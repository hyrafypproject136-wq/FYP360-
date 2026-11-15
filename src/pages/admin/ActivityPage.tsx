import { useEffect, useMemo, useState } from 'react'
import { History, Search } from 'lucide-react'
import { useAdminData } from '../../admin/AdminData'
import { describeAudit } from '../../admin/describeAudit'
import { loadAuditLog, type AuditEntry } from '../../lib/adminApi'
import { errorMessage } from '../../lib/supabase'
import { Avatar, EmptyState, Panel, Spinner, cx, formatDate, inputCls } from '../../components/ui'
import { PageHeader } from '../../layouts/WindowFrame'

const kinds = [
  { id: 'all', label: 'All' },
  { id: 'groups', label: 'Groups' },
  { id: 'group_members', label: 'Students' },
  { id: 'group_jury', label: 'Jury' },
  { id: 'account', label: 'Logins' },
  { id: 'proposal', label: 'Proposals' },
  { id: 'marks', label: 'Marks' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'submission', label: 'Submissions' },
  { id: 'change', label: 'Changes' },
] as const

export default function ActivityPage() {
  const { data } = useAdminData()
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [kind, setKind] = useState<(typeof kinds)[number]['id']>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    loadAuditLog(500).then(setEntries, (e) => setError(errorMessage(e)))
  }, [data])

  const rows = useMemo(() => {
    if (!entries) return []
    const q = query.trim().toLowerCase()
    return entries
      .filter((e) => kind === 'all' || e.action.startsWith(`${kind}.`))
      .map((e) => ({ e, text: describeAudit(data, e), actor: data.profiles.find((p) => p.id === e.actor_id)?.display_name ?? 'System' }))
      .filter((r) => !q || `${r.text} ${r.actor}`.toLowerCase().includes(q))
  }, [entries, kind, query, data])

  // Group rows by day, newest first.
  const days = useMemo(() => {
    const map = new Map<string, typeof rows>()
    rows.forEach((r) => {
      const day = new Date(r.e.created_at).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      map.set(day, [...(map.get(day) ?? []), r])
    })
    return [...map.entries()]
  }, [rows])

  return (
    <>
      <PageHeader title="Activity log" subtitle="Every change to groups, students, jury and logins: who did it and when." />

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search activity" aria-label="Search activity" className={cx(inputCls, 'pl-10 bg-white/70')} />
        </div>
        <div role="tablist" aria-label="Type" className="flex gap-1 p-1 rounded-xl bg-black/[0.05] overflow-x-auto">
          {kinds.map((k) => (
            <button key={k.id} type="button" role="tab" aria-selected={kind === k.id} onClick={() => setKind(k.id)}
              className={cx('h-8 px-3 rounded-lg text-[13px] whitespace-nowrap cursor-pointer', kind === k.id ? 'bg-white shadow-sm font-medium' : 'text-ink-2')}>
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-bad">{error}</p>
      ) : !entries ? (
        <Spinner />
      ) : days.length === 0 ? (
        <Panel><EmptyState icon={History} title="No activity" /></Panel>
      ) : (
        <div className="space-y-5">
          {days.map(([day, list]) => (
            <Panel key={day} title={<span className="text-[13px] text-ink-2 font-semibold">{day}</span>}>
              <ul className="space-y-3.5">
                {list.map(({ e, text, actor }) => (
                  <li key={e.id} className="flex items-start gap-3">
                    <Avatar name={actor} size={28} />
                    <div className="flex-1 min-w-0 text-sm">
                      <div className="text-ink">{text}</div>
                      <div className="text-xs text-ink-3 mt-0.5">{actor} · {formatDate(e.created_at)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </>
  )
}
