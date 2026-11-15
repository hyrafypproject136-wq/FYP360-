import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Bell, Crown, GraduationCap, Mail, Scale } from 'lucide-react'
import { useStudentData } from '../../student/StudentData'
import { Avatar, Badge, EmptyState, Panel, timeAgo } from '../../components/ui'
import { PageHeader } from '../../layouts/WindowFrame'
import { ProposalStatusBadge, ProposalSteps } from '../../proposals/shared'
import { markNoticesRead } from './portalApi'
import { Journey } from '../../student/Journey'

export default function StudentHomePage() {
  const { data, reload } = useStudentData()
  const { group, members, staff, jury: juryRows, notices, proposals } = data

  useEffect(() => {
    const unread = notices.filter((n) => !n.read_at).map((n) => n.id)
    if (unread.length) markNoticesRead(unread).then(reload, () => {})
  }, [notices, reload])

  const supervisor = staff.find((p) => p.id === group.supervisor_id)
  const jury = staff.filter((p) => juryRows.some((j) => j.jury_id === p.id))
  const official = proposals.find((p) => p.id === group.approved_proposal_id)

  return (
    <>
      <PageHeader
        title={group.name}
        subtitle={<><span className="font-mono">{group.code}</span>{[group.section && ` · Section ${group.section}`, group.semester && ` · ${group.semester}`].filter(Boolean).join('')}</>}
      />

      <Journey data={data} />

      <Link to="/student/proposals" className="block mb-5">
        <Panel className="hover:bg-white transition">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="min-w-0">
              <div className="text-xs text-ink-3 mb-0.5">{official ? 'Official project' : 'Proposals'}</div>
              <div className="text-[15px] font-semibold truncate">{official ? official.title : 'Submit three project ideas'}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ProposalStatusBadge status={group.proposal_status} />
              <ArrowRight size={16} className="text-ink-3" />
            </div>
          </div>
          <ProposalSteps status={group.proposal_status} />
        </Panel>
      </Link>

      <div className="grid xl:grid-cols-[1.4fr_1fr] gap-5 items-start">
        <Panel title={<>Your group members <span className="text-ink-3 font-normal">{members.length}</span></>}>
          {members.length === 0 ? (
            <EmptyState icon={GraduationCap} title="No members yet">The FYP coordinator is still setting up your group.</EmptyState>
          ) : (
            <ul className="grid sm:grid-cols-2 gap-3">
              {members.map((m) => (
                <li key={m.id} className="rounded-2xl bg-black/[0.03] p-4 flex items-center gap-3">
                  <Avatar name={m.full_name} size={44} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate">{m.full_name}</span>
                      {m.is_lead && <Badge tone="green"><Crown size={11} className="mr-1" />Lead</Badge>}
                    </div>
                    <div className="text-xs font-mono text-ink-2 mt-0.5">{m.student_id}</div>
                    <div className="text-xs text-ink-3 truncate">{m.email}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel title="Supervisor">
            {supervisor ? (
              <div className="flex items-center gap-3">
                <Avatar name={supervisor.display_name} size={40} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{supervisor.display_name}</div>
                  {supervisor.contact_email && (
                    <a href={`mailto:${supervisor.contact_email}`} className="text-xs text-accent inline-flex items-center gap-1"><Mail size={12} />{supervisor.contact_email}</a>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-ink-3">Not assigned yet. The FYP coordinator assigns your supervisor.</p>
            )}
          </Panel>

          <Panel title="Jury">
            {jury.length ? (
              <ul className="space-y-2.5">
                {jury.map((p) => <li key={p.id} className="flex items-center gap-3 text-sm"><Scale size={16} className="text-ink-3" />{p.display_name}</li>)}
              </ul>
            ) : (
              <p className="text-[13px] text-ink-3">Not assigned yet.</p>
            )}
          </Panel>

          <Panel title="Notifications">
            {notices.length === 0 ? (
              <p className="text-[13px] text-ink-3">Nothing yet.</p>
            ) : (
              <ul className="space-y-3">
                {notices.map((n) => (
                  <li key={n.id} className="flex gap-3 text-[13px]">
                    <Bell size={15} className={n.read_at ? 'text-ink-3 mt-0.5' : 'text-accent mt-0.5'} />
                    <div className="flex-1 min-w-0">
                      <div className={n.read_at ? 'text-ink-2' : 'text-ink font-medium'}>{n.message}</div>
                      <div className="text-xs text-ink-3 mt-0.5">{timeAgo(n.created_at)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}
