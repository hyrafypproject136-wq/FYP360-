import { useState, type FormEvent } from 'react'
import { GitPullRequestArrow, Plus } from 'lucide-react'
import { useStudentData } from '../../student/StudentData'
import { createChangeRequest } from '../../lib/workflowApi'
import { Button, EmptyState, ErrorBox, Field, Modal, ModalActions, Panel, inputCls, textareaCls, useAsync } from '../../components/ui'
import { PageHeader } from '../../layouts/WindowFrame'
import { ChangeRequestCard } from '../../workflow/shared'

export default function StudentChangesPage() {
  const { data, reload, toast } = useStudentData()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const { error, busy, attempt } = useAsync()
  const changes = data.work.changes
  const waiting = changes.some((c) => c.status === 'pending_jury' || c.status === 'pending_coordinator')
  const names = Object.fromEntries(data.staff.map((p) => [p.id, p.display_name]))
  const noJury = data.jury.length === 0

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const ok = await attempt(async () => (await createChangeRequest(title, details), true))
    if (ok) {
      setOpen(false)
      setTitle('')
      setDetails('')
      await reload()
      toast('Change request sent to your jury.')
    }
  }

  return (
    <>
      <PageHeader
        title="Change requests"
        subtitle="Need to change your project (scope, features, technology, members)? Ask here. Your jury approves it in writing first, then the FYP coordinator."
        actions={<Button icon={Plus} disabled={waiting || noJury || data.group.status !== 'active'} onClick={() => setOpen(true)}>New request</Button>}
      />
      {waiting && <p className="mb-4 text-[13px] text-ink-3">You can send a new request after the current one is decided.</p>}
      {noJury && <p className="mb-4 text-[13px] text-ink-3">Your jury has not been assigned yet.</p>}
      {changes.length === 0 ? (
        <Panel><EmptyState icon={GitPullRequestArrow} title="No change requests" /></Panel>
      ) : (
        <div className="flex flex-col gap-4">
          {changes.map((c) => <ChangeRequestCard key={c.id} c={c} names={names} />)}
        </div>
      )}

      {open && (
        <Modal title="Ask for a change" onClose={() => setOpen(false)} wide>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="What do you want to change?"><input required minLength={5} maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="e.g. Replace Firebase with Supabase" /></Field>
            <Field label="Details and reason" hint="Explain what changes and why. At least 30 characters.">
              <textarea required minLength={30} rows={6} value={details} onChange={(e) => setDetails(e.target.value)} className={textareaCls} />
            </Field>
            <ErrorBox message={error} />
            <ModalActions>
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send to jury'}</Button>
            </ModalActions>
          </form>
        </Modal>
      )}
    </>
  )
}
