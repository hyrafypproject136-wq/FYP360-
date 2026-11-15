import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LogOut, Menu, X, type LucideIcon } from 'lucide-react'
import { Avatar, cx } from '../components/ui'
import { LogoMark, Wallpaper } from '../components/Brand'
import { brand } from '../config/brand'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  badge?: number
  end?: boolean
}

export interface NavSection {
  title: string
  items: NavItem[]
}

/** macOS-style window: translucent sidebar on the left, content on the right, wallpaper behind. */
export function WindowFrame({
  sections,
  subtitle,
  userName,
  userRole,
  onSignOut,
  children,
}: {
  sections: NavSection[]
  subtitle?: string
  userName: string
  userRole: string
  onSignOut: () => void
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  useEffect(() => setOpen(false), [location.pathname])

  const sidebar = (
    <nav aria-label="Main" className="h-full flex flex-col">
      <div className="px-4 pt-5 pb-5 flex items-center gap-3 shrink-0">
        <LogoMark size={34} />
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold tracking-tight leading-tight">{brand.appName}</div>
          {subtitle && <div className="text-xs text-ink-3 truncate">{subtitle}</div>}
        </div>
        <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="lg:hidden text-ink-3 hover:text-ink cursor-pointer">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2.5 pb-4 space-y-5">
        {sections.map((s) => (
          <div key={s.title}>
            <div className="px-2.5 mb-1 text-[11px] font-semibold text-ink-3">{s.title}</div>
            <ul className="space-y-0.5">
              {s.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cx(
                        'flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-[13px] transition',
                        isActive ? 'bg-black/[0.08] text-ink font-medium' : 'text-ink-2 hover:bg-black/[0.04]',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon size={16} strokeWidth={2} className={isActive ? 'text-accent' : 'text-ink-3'} aria-hidden />
                        <span className="flex-1 truncate">{item.label}</span>
                        {!!item.badge && (
                          <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#ff3b30] text-white text-[11px] font-semibold grid place-items-center">{item.badge}</span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-black/5 flex items-center gap-2.5">
        <Avatar name={userName} size={30} />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium truncate">{userName}</div>
          <div className="text-[11px] text-ink-3 truncate">{userRole}</div>
        </div>
        <button type="button" onClick={onSignOut} aria-label="Sign out" title="Sign out" className="w-8 h-8 grid place-items-center rounded-lg text-ink-3 hover:bg-black/5 hover:text-ink cursor-pointer">
          <LogOut size={16} />
        </button>
      </div>
    </nav>
  )

  return (
    <div className="h-full p-0 sm:p-3 lg:p-5">
      <Wallpaper />
      <div className="glass window-shadow h-full sm:rounded-[var(--radius-window)] overflow-hidden flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-[236px] shrink-0 glass-sidebar border-r border-black/[0.06]">{sidebar}</aside>

        {/* Mobile drawer */}
        {open && (
          <div className="lg:hidden fixed inset-0 z-40 bg-black/25" onClick={() => setOpen(false)}>
            <aside className="glass-strong h-full w-[260px] window-shadow" onClick={(e) => e.stopPropagation()}>
              {sidebar}
            </aside>
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col bg-white/45">
          <div className="lg:hidden h-[52px] shrink-0 px-3 flex items-center gap-2 border-b border-black/5">
            <button type="button" aria-label="Open menu" onClick={() => setOpen(true)} className="w-9 h-9 grid place-items-center rounded-lg hover:bg-black/5 cursor-pointer">
              <Menu size={18} />
            </button>
            <span className="text-[15px] font-semibold">{brand.appName}</span>
          </div>
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">{children}</div>
          </main>
        </div>
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold tracking-tight leading-tight">{title}</h1>
        {subtitle && <div className="text-sm text-ink-2 mt-1">{subtitle}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}
