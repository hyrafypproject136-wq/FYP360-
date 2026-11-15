import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CircleAlert, FilePen, Lock, Send, Trophy } from 'lucide-react'
import { useStudentData } from '../../student/StudentData'
import { editableStatuses, missingFields, submitProposals } from '../../lib/proposalsApi'
import { Badge, Button, ErrorBox, Modal, ModalActions, Panel, cx, useAsync } from '../../components/ui'
import { PageHeader } from '../../layouts/WindowFrame'
import { ProposalDetail, ProposalHistory, ProposalStatusBadge, ProposalSteps } from '../../proposals/shared'

const nextStep: Record<string, string> = {
  not_started: 'Write three different project ideas, then send them to your supervisor.',
  draft: 'Finish all three ideas, then send them to your supervisor.',
  submitted: 'Your supervisor is reviewing your ideas. You cannot edit them now.',
  revision_requested: 'Changes were requested. Read the comments below, edit your ideas and send them again.',
  supervisor_endorsed: 'Your supervisor recommended an idea. The FYP coordinator will approve your official project.',
  approved: 'Your official project is approved.',
}

export default function StudentProposalsPage() {
  const { data, reload, toast } = useStudentData()
  const navigate = useNavigate()
  const { group, proposals, events, staff, members } = data
  const [confirm, setConfirm] = useState(false)
  const { error, busy, attempt } = useAsync()

  const editable = editableStatuses.includes(group.proposal_status) && group.status === 'active'
  const complete = [1, 2, 3].filter((s) => missingFields(proposals.find((p) => p.slot === s)).length === 0).length
  const lastRevision = group.proposal_status === 'revision_requested' ? events.find((e) => e.action === 'revision_requested') : undefined
  const official = proposals.find((p) => p.id === group.approved_proposal_id)
  const names = Object.fromEntries(staff.map((p) => [p.id, p.display_name]))
  const lead = members.find((m) => m.is_lead)

  const submit = async () => {
    const ok = await attempt(async () => (await submitProposals(), true))
    if (ok) {
      setConfirm(false)
      toast('Proposals sent to your supervisor.')
      await reload()
    }
  }

  return (
    <>
      <PageHeader title="Proposals" subtitle={nextStep[group.proposal_status]} actions={<ProposalStatusBadge status={group.proposal_status} />} />

      <Panel className="mb-5"><ProposalSteps status={group.proposal_status} /></Panel>

      {lastRevision?.comment && (
        <div className="mb-5 rounded-2xl bg-bad-soft px-4 py-3 text-[13px] flex gap-2.5">
          <CircleAlert size={17} className="text-bad shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-bad">{lastRevision.actor_role === 'supervisor' ? 'Your supervisor' : 'The FYP coordinator'} asked for changes</div>
            <div className="text-ink mt-0.5 whitespace-pre-line">{lastRevision.comment}</div>
          </div>
        </div>
      )}

      {official && (
        <Panel className="mb-5 ring-2 ring-good/40" title={<span className="flex items-center gap-2"><Trophy size={17} className="text-good" />Your official project</span>}>
          <ProposalDetail proposal={official} slot={official.slot} approved />
        </Panel>
      )}

      <div className="grid lg:grid-cols-3 gap-4 mb-5">
        {[1, 2, 3].map((slot) => {
          const p = proposals.find((x) => x.slot === slot)
          const missing = missingFields(p)
          const isOfficial = p && p.id === group.approved_proposal_id
          return (
            <Panel key={slot} className={cx('flex flex-col', isOfficial && 'ring-2 ring-good/40')}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-ink-3 uppercase tracking-wider">Idea {slot}</span>
                {isOfficial ? <Badge tone="green">Official</Badge> : p?.recommended ? <Badge tone="blue">Recommended</Badge> : missing.length === 0 ? <Badge tone="green">Complete</Badge> : p ? <Badge tone="amber">Incomplete</Badge> : <Badge tone="grey">Empty</Badge>}
              </div>
              <h3 className="text-[15px] font-semibold leading-snug min-h-[42px]">{p?.title || <span className="text-ink-3 font-normal">No title yet</span>}</h3>
              <p className="text-[13px] text-ink-2 mt-1.5 line-clamp-3 flex-1">{p?.summary || 'Describe the problem, who it helps and what you will build.'}</p>
              {p?.supervisor_note && <p className="text-xs text-accent mt-2 line-clamp-2">Supervisor: {p.supervisor_note}</p>}
              {missing.length > 0 && p && <p className="text-xs text-warn mt-2">Missing: {missing.join(', ')}</p>}
              <Button variant={editable ? 'primary' : 'secondary'} icon={editable ? FilePen : undefined} className="w-full mt-4" onClick={() => navigate(`/student/proposals/${slot}`)}>
                {editable ? (p ? 'Edit idea' : 'Start idea') : 'View idea'}
                {!editable && <ArrowRight size={15} />}
              </Button>
            </Panel>
          )
        })}
      </div>

      {editable && (
        <Panel className="mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{complete} of 3 ideas complete</div>
              <div className="text-[13px] text-ink-3">
                {!group.supervisor_id ? 'You can send them once the coordinator assigns your supervisor.' : 'All three must be complete before you can send them.'}
              </div>
            </div>
            <Button icon={Send} disabled={complete < 3 || !group.supervisor_id} onClick={() => setConfirm(true)}>Send to supervisor</Button>
          </div>
        </Panel>
      )}
      {!editable && group.proposal_status !== 'approved' && (
        <p className="mb-5 text-[13px] text-ink-3 flex items-center gap-1.5"><Lock size={14} />Ideas are locked while they are being reviewed.</p>
      )}

      <Panel title="History">
        <ProposalHistory events={events} names={names} />
      </Panel>

      {confirm && (
        <Modal title="Send proposals to your supervisor?" onClose={() => setConfirm(false)}>
          <p className="text-[13px] text-ink-2">
            Your three ideas will be locked while your supervisor reviews them.{lead && ` Make sure ${lead.full_name} (group lead) has checked them.`}
          </p>
          <div className="mt-3"><ErrorBox message={error} /></div>
          <ModalActions>
            <Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button icon={Send} disabled={busy} onClick={submit}>{busy ? 'Sending…' : 'Send'}</Button>
          </ModalActions>
        </Modal>
      )}
    </>
  )
}
