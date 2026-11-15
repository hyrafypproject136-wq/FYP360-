import { Link } from 'react-router-dom'
import { ChevronRight, ClipboardCheck } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useStaffData } from '../../staff/StaffData'
import { EmptyState, Panel, timeAgo } from '../../components/ui'
import { PageHeader } from '../../layouts/WindowFrame'
import { ProposalStatusBadge } from '../../proposals/shared'

export default function ReviewsPage() {
  const { user } = useAuth()
  const { data } = useStaffData()
  const mine = data.groups.filter((g) => g.supervisor_id === user?.profileId && g.proposal_status !== 'not_started')
  const waiting = mine.filter((g) => g.proposal_status === 'submitted')
  const others = mine.filter((g) => g.proposal_status !== 'submitted')

  const row = (g: (typeof mine)[number]) => {
    const latest = data.proposals.filter((p) => p.group_id === g.id).sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]
    return (
      <li key={g.id}>
        <Link to={`/staff/reviews/${g.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-black/[0.025]">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{g.name} <span className="font-mono text-[11px] text-ink-3 font-normal">{g.code}</span></div>
            {latest && <div className="text-xs text-ink-3">Last edited {timeAgo(latest.updated_at)}</div>}
          </div>
          <ProposalStatusBadge status={g.proposal_status} />
          <ChevronRight size={16} className="text-ink-3" />
        </Link>
      </li>
    )
  }

  return (
    <>
      <PageHeader title="Proposal reviews" subtitle="Read each group’s three ideas, then recommend one or ask for changes." />
      <Panel title={`Waiting for you · ${waiting.length}`} padded={false} className="mb-5">
        {waiting.length === 0 ? <EmptyState icon={ClipboardCheck} title="Nothing to review" /> : <ul className="divide-y divide-black/5">{waiting.map(row)}</ul>}
      </Panel>
      {others.length > 0 && (
        <Panel title="Other groups" padded={false}>
          <ul className="divide-y divide-black/5">{others.map(row)}</ul>
        </Panel>
      )}
    </>
  )
}
