import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, FileCheck2 } from 'lucide-react'
import { profileName, useAdminData } from '../../admin/AdminData'
import type { ProposalStatus } from '../../lib/adminApi'
import { EmptyState, Panel, cx } from '../../components/ui'
import { PageHeader } from '../../layouts/WindowFrame'
import { ProposalStatusBadge, statusLabel } from '../../proposals/shared'

const tabs: { id: ProposalStatus | 'all'; label: string }[] = [
  { id: 'supervisor_endorsed', label: 'To approve' },
  { id: 'submitted', label: 'With supervisor' },
  { id: 'revision_requested', label: statusLabel.revision_requested },
  { id: 'draft', label: 'Writing' },
  { id: 'approved', label: 'Approved' },
  { id: 'all', label: 'All' },
]

export default function ProposalsPage() {
  const { data } = useAdminData()
  const [tab, setTab] = useState<(typeof tabs)[number]['id']>('supervisor_endorsed')
  const active = data.groups.filter((g) => g.status === 'active')
  const rows = active.filter((g) => (tab === 'all' ? true : tab === 'draft' ? g.proposal_status === 'draft' || g.proposal_status === 'not_started' : g.proposal_status === tab))
  const count = (id: (typeof tabs)[number]['id']) => active.filter((g) => (id === 'all' ? true : id === 'draft' ? g.proposal_status === 'draft' || g.proposal_status === 'not_started' : g.proposal_status === id)).length

  return (
    <>
      <PageHeader title="Proposals" subtitle="Each group sends three ideas to its supervisor. After the supervisor recommends one, you approve the official project." />
      <div role="tablist" aria-label="Status" className="flex gap-1 p-1 rounded-xl bg-black/[0.05] w-fit max-w-full overflow-x-auto mb-4">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={cx('h-8 px-3 rounded-lg text-[13px] whitespace-nowrap cursor-pointer', tab === t.id ? 'bg-white shadow-sm font-medium' : 'text-ink-2')}>
            {t.label} <span className="text-ink-3">{count(t.id)}</span>
          </button>
        ))}
      </div>
      <Panel padded={false}>
        {rows.length === 0 ? (
          <EmptyState icon={FileCheck2} title="No groups here" />
        ) : (
          <ul className="divide-y divide-black/5">
            {rows.map((g) => {
              const recommended = data.proposals.find((p) => p.group_id === g.id && p.recommended)
              const official = data.proposals.find((p) => p.id === g.approved_proposal_id)
              const written = data.proposals.filter((p) => p.group_id === g.id).length
              return (
                <li key={g.id}>
                  <Link to={`/admin/proposals/${g.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-black/[0.025]">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{g.name} <span className="font-mono text-[11px] text-ink-3 font-normal">{g.code}</span></div>
                      <div className="text-xs text-ink-3 truncate">
                        {official ? `Official: ${official.title}` : recommended ? `Supervisor recommends idea ${recommended.slot}: ${recommended.title}` : `${written} of 3 ideas written`}
                        {' · '}Supervisor: {profileName(data, g.supervisor_id) ?? '—'}
                      </div>
                    </div>
                    <ProposalStatusBadge status={g.proposal_status} />
                    <ChevronRight size={16} className="text-ink-3" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </>
  )
}
