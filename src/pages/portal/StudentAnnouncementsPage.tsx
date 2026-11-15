import { useEffect } from 'react'
import { Bell, Megaphone } from 'lucide-react'
import { useStudentData } from '../../student/StudentData'
import { EmptyState, Panel, cx, formatDate, timeAgo } from '../../components/ui'
import { PageHeader } from '../../layouts/WindowFrame'
import { markNoticesRead } from './portalApi'

export default function StudentAnnouncementsPage() {
  const { data, reload } = useStudentData()
  const { notices } = data
  const announcements = data.work.announcements

  useEffect(() => {
    const unread = notices.filter((n) => !n.read_at).map((n) => n.id)
    if (unread.length) markNoticesRead(unread).then(reload, () => {})
  }, [notices, reload])

  return (
    <>
      <PageHeader title="Announcements" subtitle="News from the FYP coordinator, and updates about your group." />
      <div className="grid xl:grid-cols-[1.4fr_1fr] gap-5 items-start">
        <Panel title={<span className="flex items-center gap-2"><Megaphone size={16} className="text-ink-3" />From the FYP coordinator</span>}>
          {announcements.length === 0 ? (
            <EmptyState icon={Megaphone} title="No announcements yet" />
          ) : (
            <ul className="divide-y divide-black/5 -my-1">
              {announcements.map((a) => (
                <li key={a.id} className="py-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-semibold">{a.title}</h3>
                    <span className="text-xs text-ink-3 whitespace-nowrap">{formatDate(a.created_at)}</span>
                  </div>
                  <p className="text-[13px] text-ink-2 mt-1 whitespace-pre-line leading-relaxed">{a.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={<span className="flex items-center gap-2"><Bell size={16} className="text-ink-3" />Group updates</span>}>
          {notices.length === 0 ? (
            <EmptyState icon={Bell} title="Nothing yet" />
          ) : (
            <ul className="space-y-3">
              {notices.map((n) => (
                <li key={n.id} className="flex gap-3 text-[13px]">
                  <span className={cx('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', n.read_at ? 'bg-black/15' : 'bg-accent')} />
                  <span className="flex-1 min-w-0 text-ink">{n.message}</span>
                  <span className="text-ink-3 whitespace-nowrap">{timeAgo(n.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}
