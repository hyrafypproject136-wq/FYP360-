import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Send, Star, Undo2, UsersRound } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useStaffData } from '../../staff/StaffData'
import { loadProposals, supervisorReview, type ProposalEvent } from '../../lib/proposalsApi'
import { errorMessage } from '../../lib/supabase'
import { Button, EmptyState, ErrorBox, Field, Modal, ModalActions, Panel, cx, textareaCls, useAsync } from '../../components/ui'
import { IdeaTabs, ProposalDetail, ProposalHistory, ProposalStatusBadge, ProposalSteps } from '../../proposals/shared'

export default function ReviewPage() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data, reload, toast } = useStaffData()
  const group = data.groups.find((g) => g.id === groupId && g.supervisor_id === user?.profileId)
  const proposals = data.proposals.filter((p) => p.group_id === groupId)

  const [slot, setSlot] = useState(1)
  const [notes, setNotes] = useState<Record<number, string>>(() => Object.fromEntries(proposals.map((p) => [p.slot, p.supervisor_note ?? ''])))
  const [recommended, setRecommended] = useState<number | null>(proposals.find((p) => p.recommended)?.slot ?? null)
  const [events, setEvents] = useState<ProposalEvent[]>([])
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<null | 'endorse' | 'revision'>(null)
  const [comment, setComment] = useState('')
  const { error, busy, attempt } = useAsync()

  useEffect(() => {
    if (groupId) loadProposals(groupId).then((r) => setEvents(r.events), (e) => setEventsError(errorMessage(e)))
  }, [groupId, data])

  if (!group) {
    return <EmptyState icon={UsersRound} title="Group not found"><Link to="/staff/reviews" className="text-accent">Back to reviews</Link></EmptyState>
  }

  const canReview = group.proposal_status === 'submitted'
  const members = data.members.filter((m) => m.group_id === group.id)
  const current = proposals.find((p) => p.slot === slot)

  const send = async () => {
    const ok = await attempt(async () => (await supervisorReview(group.id, dialog!, dialog === 'endorse' ? recommended : null, comment, notes), true))
    if (ok) {
      toast(dialog === 'endorse' ? `Idea ${recommended} recommended and sent to the coordinator.` : 'Changes requested. The group has been notified.')
      setDialog(null)
      await reload()
      navigate('/staff/reviews')
    }
  }

  return (
    <>
      <Link to="/staff/reviews" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink mb-4"><ArrowLeft size={15} /> Proposal reviews</Link>
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1"><span className="font-mono text-xs text-ink-3">{group.code}</span><ProposalStatusBadge status={group.proposal_status} /></div>
          <h1 className="text-[26px] font-bold tracking-tight leading-tight">{group.name}</h1>
          <p className="text-[13px] text-ink-2 mt-1">{members.map((m) => `${m.full_name}${m.is_lead ? ' (lead)' : ''}`).join(' · ') || 'No members'}</p>
        </div>
        {canReview && (
          <div className="flex gap-2">
            <Button variant="danger" icon={Undo2} onClick={() => { setComment(''); setDialog('revision') }}>Ask for changes</Button>
            <Button icon={Send} disabled={!recommended} onClick={() => { setComment(''); setDialog('endorse') }}>Recommend idea {recommended ?? ''}</Button>
          </div>
        )}
      </div>

      <Panel className="mb-5"><ProposalSteps status={group.proposal_status} /></Panel>

      <div className="grid xl:grid-cols-[1.6fr_1fr] gap-5 items-start">
        <Panel
          title={<IdeaTabs value={slot} onChange={setSlot} proposals={proposals} mark={(p) => (p && p.slot === recommended ? <Star size={12} className="text-accent fill-accent" /> : null)} />}
        >
          <ProposalDetail proposal={canReview && current ? { ...current, supervisor_note: null, recommended: false } : current} slot={slot} approved={current?.id === group.approved_proposal_id} />
          {canReview && current && (
            <div className="mt-5 pt-5 border-t border-black/5 flex flex-col gap-4">
              <Field label={`Your note on idea ${slot} (the group will see it)`}>
                <textarea rows={3} value={notes[slot] ?? ''} onChange={(e) => setNotes({ ...notes, [slot]: e.target.value })} className={textareaCls} placeholder="Strengths, weaknesses, what to improve…" />
              </Field>
              <label className={cx('flex items-center gap-3 rounded-xl px-3.5 py-3 cursor-pointer border transition', recommended === slot ? 'border-accent/50 bg-accent-soft' : 'border-line hover:bg-black/[0.02]')}>
                <input type="radio" name="recommended" checked={recommended === slot} onChange={() => setRecommended(slot)} className="w-4 h-4 accent-[#0a72e8]" />
                <span className="text-sm"><span className="font-semibold">Recommend this idea</span> as the group’s final year project</span>
              </label>
            </div>
          )}
        </Panel>

        <Panel title="History">
          {eventsError ? <p className="text-[13px] text-bad">{eventsError}</p> : <ProposalHistory events={events} names={{ ...Object.fromEntries(data.staff.map((p) => [p.id, p.display_name])), ...(user?.profileId ? { [user.profileId]: 'You' } : {}) }} />}
        </Panel>
      </div>

      {dialog && (
        <Modal title={dialog === 'endorse' ? `Recommend idea ${recommended}?` : 'Ask the group for changes'} onClose={() => setDialog(null)}>
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-ink-2">
              {dialog === 'endorse'
                ? `“${proposals.find((p) => p.slot === recommended)?.title}” will go to the FYP coordinator for final approval. Your notes on each idea are shared with the group.`
                : 'The ideas unlock so the group can edit and send them again. Your notes on each idea are shared with them.'}
            </p>
            <Field label={dialog === 'endorse' ? 'Comment for the coordinator (optional)' : 'What should they change?'}>
              <textarea rows={4} required={dialog === 'revision'} value={comment} onChange={(e) => setComment(e.target.value)} className={textareaCls} />
            </Field>
            <ErrorBox message={error} />
            <ModalActions>
              <Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
              <Button disabled={busy || (dialog === 'revision' && !comment.trim())} onClick={send} className={dialog === 'revision' ? '!bg-bad hover:!bg-bad/90' : ''}>
                {busy ? 'Sending…' : dialog === 'endorse' ? 'Recommend & send' : 'Send back to group'}
              </Button>
            </ModalActions>
          </div>
        </Modal>
      )}
    </>
  )
}
