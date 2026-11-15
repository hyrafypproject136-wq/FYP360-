import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Undo2, UsersRound } from 'lucide-react'
import { membersOf, profileName, useAdminData } from '../../admin/AdminData'
import { coordinatorDecide, loadProposals, type ProposalEvent } from '../../lib/proposalsApi'
import { Button, EmptyState, ErrorBox, Field, Modal, ModalActions, Panel, cx, textareaCls, useAsync } from '../../components/ui'
import { IdeaTabs, ProposalDetail, ProposalHistory, ProposalStatusBadge, ProposalSteps } from '../../proposals/shared'

export default function ProposalDecisionPage() {
  const { groupId } = useParams()
  const { data, reload, toast } = useAdminData()
  const group = data.groups.find((g) => g.id === groupId)
  const proposals = data.proposals.filter((p) => p.group_id === groupId)
  const recommendedSlot = proposals.find((p) => p.recommended)?.slot

  const [slot, setSlot] = useState(recommendedSlot ?? 1)
  const [events, setEvents] = useState<ProposalEvent[]>([])
  const [dialog, setDialog] = useState<null | 'approve' | 'revision'>(null)
  const [comment, setComment] = useState('')
  const { error, busy, attempt } = useAsync()

  useEffect(() => {
    if (groupId) loadProposals(groupId).then((r) => setEvents(r.events), () => setEvents([]))
  }, [groupId, data])

  if (!group) return <EmptyState icon={UsersRound} title="Group not found"><Link to="/admin/proposals" className="text-accent">Back to proposals</Link></EmptyState>

  const canDecide = group.status === 'active' && (group.proposal_status === 'supervisor_endorsed' || group.proposal_status === 'submitted')
  const current = proposals.find((p) => p.slot === slot)
  const names = Object.fromEntries(data.profiles.map((p) => [p.id, p.display_name]))

  const decide = async () => {
    const ok = await attempt(async () => (await coordinatorDecide(group.id, dialog!, dialog === 'approve' ? current?.id ?? null : null, comment), true))
    if (ok) {
      toast(dialog === 'approve' ? `Idea ${slot} approved as ${group.code}’s official project.` : 'Sent back to the group for changes.')
      setDialog(null)
      await reload()
    }
  }

  return (
    <>
      <Link to="/admin/proposals" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink mb-4"><ArrowLeft size={15} /> Proposals</Link>
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1"><span className="font-mono text-xs text-ink-3">{group.code}</span><ProposalStatusBadge status={group.proposal_status} /></div>
          <h1 className="text-[26px] font-bold tracking-tight leading-tight">{group.name}</h1>
          <p className="text-[13px] text-ink-2 mt-1">
            Supervisor: {profileName(data, group.supervisor_id) ?? '—'} · {membersOf(data, group.id).map((m) => m.full_name).join(', ') || 'No members'}
          </p>
        </div>
        {canDecide && (
          <div className="flex gap-2">
            <Button variant="danger" icon={Undo2} onClick={() => { setComment(''); setDialog('revision') }}>Send back</Button>
            <Button icon={CheckCircle2} disabled={!current} onClick={() => { setComment(''); setDialog('approve') }}>Approve idea {slot}</Button>
          </div>
        )}
      </div>

      {group.proposal_status === 'submitted' && (
        <p className="mb-4 text-[13px] rounded-xl bg-warn-soft text-warn px-3.5 py-2.5">The supervisor has not reviewed these yet. You can still decide, but normally you wait for their recommendation.</p>
      )}

      <Panel className="mb-5"><ProposalSteps status={group.proposal_status} /></Panel>

      <div className="grid xl:grid-cols-[1.6fr_1fr] gap-5 items-start">
        <Panel title={<IdeaTabs value={slot} onChange={setSlot} proposals={proposals} mark={(p) => (p?.recommended ? <span className="text-[10px] font-semibold text-accent">★</span> : null)} />}>
          {canDecide && <p className={cx('text-xs mb-4', slot === recommendedSlot ? 'text-accent font-medium' : 'text-ink-3')}>{slot === recommendedSlot ? 'The supervisor recommends this idea.' : recommendedSlot ? `The supervisor recommends idea ${recommendedSlot}.` : 'No recommendation yet.'}</p>}
          <ProposalDetail proposal={current} slot={slot} approved={current?.id === group.approved_proposal_id} />
        </Panel>
        <Panel title="History"><ProposalHistory events={events} names={names} /></Panel>
      </div>

      {dialog && (
        <Modal title={dialog === 'approve' ? `Approve idea ${slot}?` : 'Send proposals back to the group?'} onClose={() => setDialog(null)}>
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-ink-2">
              {dialog === 'approve'
                ? `“${current?.title}” becomes ${group.code}’s official final year project. The group is notified.`
                : 'The ideas unlock so the group can change them and send them again through their supervisor.'}
            </p>
            <Field label={dialog === 'approve' ? 'Comment (optional)' : 'What should they change?'}>
              <textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} className={textareaCls} />
            </Field>
            <ErrorBox message={error} />
            <ModalActions>
              <Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
              <Button disabled={busy || (dialog === 'revision' && !comment.trim())} onClick={decide} className={dialog === 'revision' ? '!bg-bad hover:!bg-bad/90' : ''}>
                {busy ? 'Saving…' : dialog === 'approve' ? 'Approve' : 'Send back'}
              </Button>
            </ModalActions>
          </div>
        </Modal>
      )}
    </>
  )
}
