import { useState } from 'react'
import { BriefcaseBusiness, KeyRound, Trash2, UserPlus } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { useAdminData } from '../../admin/AdminData'
import { ResetPasswordDialog, StaffDialog } from '../../admin/dialogs'
import { deleteLogin, type Profile, type StaffRole } from '../../lib/adminApi'
import { Avatar, Badge, Button, EmptyState, Panel, cx } from '../../components/ui'
import { PageHeader } from '../../layouts/WindowFrame'

const roleLabel: Record<StaffRole, string> = { coordinator: 'Coordinator', supervisor: 'Supervisor', jury: 'Jury' }
const roleTone: Record<StaffRole, 'blue' | 'green' | 'amber'> = { coordinator: 'blue', supervisor: 'green', jury: 'amber' }

export default function StaffPage() {
  const { user } = useAuth()
  const { data, run } = useAdminData()
  const [creating, setCreating] = useState(false)
  const [resetting, setResetting] = useState<Profile | null>(null)
  const [role, setRole] = useState<StaffRole | 'all'>('all')

  const staff = data.profiles.filter((p) => p.role !== 'group' && (role === 'all' || p.role === role))
  const workload = (p: Profile) => {
    const sup = data.groups.filter((g) => g.supervisor_id === p.id && g.status === 'active').length
    const jur = data.jury.filter((j) => j.jury_id === p.id).length
    return [sup && `Supervises ${sup}`, jur && `Jury on ${jur}`].filter(Boolean).join(' · ') || 'No groups'
  }

  return (
    <>
      <PageHeader
        title="Staff accounts"
        subtitle="Supervisor, jury and coordinator logins. You assign them to groups; students never choose."
        actions={<Button icon={UserPlus} onClick={() => setCreating(true)}>Create staff login</Button>}
      />

      <div role="tablist" aria-label="Role" className="flex gap-1 p-1 rounded-xl bg-black/[0.05] w-fit mb-4">
        {(['all', 'supervisor', 'jury', 'coordinator'] as const).map((r) => (
          <button key={r} type="button" role="tab" aria-selected={role === r} onClick={() => setRole(r)}
            className={cx('h-8 px-3 rounded-lg text-[13px] cursor-pointer', role === r ? 'bg-white shadow-sm font-medium' : 'text-ink-2')}>
            {r === 'all' ? 'All' : roleLabel[r]}
          </button>
        ))}
      </div>

      <Panel padded={false}>
        {staff.length === 0 ? (
          <EmptyState icon={BriefcaseBusiness} title="No staff accounts here">Create supervisor and jury logins before assigning them to groups.</EmptyState>
        ) : (
          <ul className="divide-y divide-black/5">
            {staff.map((p) => (
              <li key={p.id} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar name={p.display_name} size={36} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{p.display_name}</span>
                      <Badge tone={roleTone[p.role as StaffRole]}>{roleLabel[p.role as StaffRole]}</Badge>
                      {p.id === user?.profileId && <Badge tone="grey">You</Badge>}
                    </div>
                    <div className="text-xs text-ink-3 truncate">
                      <span className="font-mono">{p.username}</span>
                      {p.contact_email && ` · ${p.contact_email}`} · {workload(p)}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button variant="secondary" size="sm" icon={KeyRound} onClick={() => setResetting(p)}>Reset password</Button>
                  {p.id !== user?.profileId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      aria-label={`Delete ${p.display_name}`}
                      onClick={() => window.confirm(`Delete the login of ${p.display_name}? Groups they supervise will show “No supervisor”.`) && run(() => deleteLogin(p.id), 'Login deleted.')}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {creating && <StaffDialog onClose={() => setCreating(false)} />}
      {resetting && <ResetPasswordDialog profile={resetting} onClose={() => setResetting(null)} />}
    </>
  )
}
