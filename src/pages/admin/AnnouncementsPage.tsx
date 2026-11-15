import { useState, type FormEvent } from 'react'
import { Megaphone, Send, Trash2 } from 'lucide-react'
import { useAdminData } from '../../admin/AdminData'
import { deleteAnnouncement, postAnnouncement } from '../../lib/workflowApi'
import { Button, EmptyState, ErrorBox, Field, Panel, formatDate, inputCls, textareaCls, useAsync } from '../../components/ui'
import { PageHeader } from '../../layouts/WindowFrame'

export default function AnnouncementsPage() {
  const { data, reload, toast, run } = useAdminData()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const { error, busy, attempt } = useAsync()
  const active = data.groups.filter((g) => g.status === 'active').length

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const ok = await attempt(async () => (await postAnnouncement(title, body), true))
    if (ok) {
      setTitle('')
      setBody('')
      await reload()
      toast(`Announcement sent to ${active} group${active === 1 ? '' : 's'}.`)
    }
  }

  return (
    <>
      <PageHeader title="Announcements" subtitle="Dates, venues and deadlines for everyone. Every active group gets a notice; supervisors and jury see it on their home page." />
      <div className="grid xl:grid-cols-[1fr_1.3fr] gap-5 items-start">
        <Panel title="New announcement">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="Title"><input required minLength={3} maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="e.g. Proposal defence on 5 September" /></Field>
            <Field label="Message"><textarea required rows={6} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} className={textareaCls} placeholder="Venue: North Campus. Time: 9:00 AM – 3:00 PM." /></Field>
            <ErrorBox message={error} />
            <div><Button type="submit" icon={Send} disabled={busy}>{busy ? 'Sending…' : 'Send to everyone'}</Button></div>
          </form>
        </Panel>
        <Panel title="Sent" padded={data.work.announcements.length > 0}>
          {data.work.announcements.length === 0 ? (
            <EmptyState icon={Megaphone} title="No announcements yet" />
          ) : (
            <ul className="divide-y divide-black/5 -my-1">
              {data.work.announcements.map((a) => (
                <li key={a.id} className="py-3.5 flex gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-sm font-semibold">{a.title}</h3>
                      <span className="text-xs text-ink-3 whitespace-nowrap">{formatDate(a.created_at)}</span>
                    </div>
                    <p className="text-[13px] text-ink-2 mt-1 whitespace-pre-line">{a.body}</p>
                  </div>
                  <Button variant="ghost" size="sm" icon={Trash2} aria-label={`Delete ${a.title}`} onClick={() => window.confirm(`Delete "${a.title}"? Groups will no longer see it.`) && run(() => deleteAnnouncement(a.id), 'Announcement deleted.')} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}
