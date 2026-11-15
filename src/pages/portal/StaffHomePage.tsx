import { Link } from 'react-router-dom'
import { Crown, Megaphone, UsersRound } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useStaffData } from '../../staff/StaffData'
import { Avatar, Badge, EmptyState, Panel, formatDate } from '../../components/ui'
import { PageHeader } from '../../layouts/WindowFrame'
import { ProposalStatusBadge } from '../../proposals/shared'

export default function StaffHomePage() {
  const { user } = useAuth()
  const { data } = useStaffData()
  const me = user?.profileId

  return (
    <>
      <PageHeader title="My groups" subtitle="Groups the FYP coordinator assigned to you." />
      {data.work.announcements.length > 0 && (
        <Panel className="mb-5" title={<span className="flex items-center gap-2"><Megaphone size={16} className="text-ink-3" />Announcements</span>}>
          <ul className="divide-y divide-black/5 -my-1">
            {data.work.announcements.slice(0, 3).map((a) => (
              <li key={a.id} className="py-3">
                <div className="flex items-baseline justify-between gap-3"><h3 className="text-sm font-semibold">{a.title}</h3><span className="text-xs text-ink-3 whitespace-nowrap">{formatDate(a.created_at)}</span></div>
                <p className="text-[13px] text-ink-2 mt-1 whitespace-pre-line">{a.body}</p>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {data.groups.length === 0 ? (
        <Panel><EmptyState icon={UsersRound} title="No groups assigned yet" /></Panel>
      ) : (
        <div className="grid lg:grid-cols-2 gap-5">
          {data.groups.map((g) => {
            const members = data.members.filter((m) => m.group_id === g.id)
            const asSupervisor = g.supervisor_id === me
            const asJury = data.jury.some((j) => j.group_id === g.id && j.jury_id === me)
            const official = data.proposals.find((p) => p.id === g.approved_proposal_id)
            return (
              <Panel
                key={g.id}
                title={<><span>{g.name}</span> <span className="font-mono text-xs text-ink-3 font-normal whitespace-nowrap">{g.code}</span></>}
                action={<div className="flex gap-1">{asSupervisor && <Badge tone="green">Supervisor</Badge>}{asJury && <Badge tone="amber">Jury</Badge>}</div>}
              >
                <div className="flex items-center justify-between gap-2 mb-3 text-[13px]">
                  <span className="text-ink-2 truncate">{official ? `Project: ${official.title}` : 'Proposals'}</span>
                  <ProposalStatusBadge status={g.proposal_status} />
                </div>
                <ul className="space-y-2.5">
                  {members.map((m) => (
                    <li key={m.id} className="flex items-center gap-3">
                      <Avatar name={m.full_name} size={30} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium flex items-center gap-1.5">{m.full_name}{m.is_lead && <Crown size={13} className="text-good" aria-label="Lead" />}</div>
                        <div className="text-xs text-ink-3 font-mono">{m.student_id}</div>
                      </div>
                    </li>
                  ))}
                  {members.length === 0 && <li className="text-[13px] text-ink-3">No members yet.</li>}
                </ul>
                {asSupervisor && g.proposal_status !== 'not_started' && (
                  <Link to={`/staff/reviews/${g.id}`} className="mt-4 inline-block text-[13px] font-medium text-accent">
                    {g.proposal_status === 'submitted' ? 'Review proposals →' : 'View proposals →'}
                  </Link>
                )}
              </Panel>
            )
          })}
        </div>
      )}
    </>
  )
}
