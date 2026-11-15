import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Wallpaper } from './Brand'
import { Button } from './ui'

/** Full-screen message on the wallpaper (disqualified, dissolved, not configured, loading). */
export function NoticeScreen({ icon: Icon, title, children, onSignOut, tone = 'bad' }: { icon?: LucideIcon; title: string; children?: ReactNode; onSignOut?: () => void; tone?: 'bad' | 'neutral' }) {
  return (
    <div className="min-h-full flex items-center justify-center p-4">
      <Wallpaper blur />
      <div className="glass window-shadow rounded-3xl max-w-md w-full p-8 text-center flex flex-col items-center gap-3">
        {Icon && (
          <span className={tone === 'bad' ? 'w-14 h-14 rounded-2xl bg-bad-soft text-bad grid place-items-center' : 'w-14 h-14 rounded-2xl bg-black/5 text-ink-2 grid place-items-center'}>
            <Icon size={26} />
          </span>
        )}
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {children && <div className="text-sm text-ink-2">{children}</div>}
        {onSignOut && <Button onClick={onSignOut} className="mt-2">Sign out</Button>}
      </div>
    </div>
  )
}
