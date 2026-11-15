/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { loadAdminData, loadSettings, type Group, type GroupJury, type Member, type Profile, type ResetRequest, type Settings } from '../lib/adminApi'
import { errorMessage } from '../lib/supabase'
import { loadVisibleProposals, type Proposal } from '../lib/proposalsApi'
import { absencesIn, loadMarksData, marksConfig, type MarksData } from '../lib/marksApi'
import { loadWorkflow, type WorkflowData } from '../lib/workflowApi'
import { useToast } from '../components/Toast'

export interface AdminData {
  groups: Group[]
  members: Member[]
  profiles: Profile[]
  jury: GroupJury[]
  requests: ResetRequest[]
  settings: Settings
  proposals: Proposal[]
  marks: MarksData
  work: WorkflowData
}

interface AdminValue {
  data: AdminData | null
  loading: boolean
  loadError: string | null
  reload: () => Promise<void>
  toast: (message: string) => void
  /** Run an admin action: on success shows `success` and reloads; on failure shows the error. */
  run: (action: () => Promise<unknown>, success?: string) => Promise<boolean>
  actionError: string | null
  clearActionError: () => void
}

const AdminContext = createContext<AdminValue | undefined>(undefined)

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const [core, settings, proposals, marks, work] = await Promise.all([loadAdminData(), loadSettings().catch(() => ({})), loadVisibleProposals(), loadMarksData(), loadWorkflow()])
      setData({ ...core, settings, proposals, marks, work })
      setLoadError(null)
    } catch (e) {
      setLoadError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const run = useCallback(
    async (action: () => Promise<unknown>, success?: string) => {
      setActionError(null)
      try {
        await action()
        if (success) toast(success)
        await reload()
        return true
      } catch (e) {
        setActionError(errorMessage(e))
        return false
      }
    },
    [reload, toast],
  )

  return (
    <AdminContext.Provider value={{ data, loading, loadError, reload, toast, run, actionError, clearActionError: () => setActionError(null) }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin must be used inside <AdminDataProvider>')
  return ctx
}

/** For pages that render only after data has loaded (AdminLayout guarantees this). */
export function useAdminData(): AdminValue & { data: AdminData } {
  const ctx = useAdmin()
  if (!ctx.data) throw new Error('Admin data not loaded yet')
  return ctx as AdminValue & { data: AdminData }
}

// ---------- derived facts used by several pages

export const membersOf = (d: AdminData, groupId: string) => d.members.filter((m) => m.group_id === groupId)
export const profileName = (d: AdminData, id: string | null) => d.profiles.find((p) => p.id === id)?.display_name ?? null

/** What is still missing for an active group, in the order the coordinator should do it. */
export function groupGaps(d: AdminData, g: Group) {
  if (g.status !== 'active') return []
  const members = membersOf(d, g.id)
  const gaps: string[] = []
  if (members.length === 0) gaps.push('No members')
  else if (!members.some((m) => m.is_lead)) gaps.push('No lead')
  if (!g.supervisor_id) gaps.push('No supervisor')
  if (!d.jury.some((j) => j.group_id === g.id)) gaps.push('No jury')
  if (!g.account_id) gaps.push('No login')
  const cfg = marksConfig(d.settings)
  const over = members.filter((m) => absencesIn(d.marks, m.id, cfg.currentPhase) > cfg.absenceLimit).length
  if (over) gaps.push(`${over} over absence limit`)
  const groupAbsent = d.marks.sessions.some((s) => {
    const rows = d.marks.attendance.filter((a) => a.session_id === s.id)
    return s.group_id === g.id && s.phase === cfg.currentPhase && rows.length > 0 && rows.every((a) => a.status === 'absent')
  })
  if (groupAbsent) gaps.push('Whole group absent')
  const ineligible = members.filter((m) => !m.eligible).length
  if (ineligible) gaps.push(`${ineligible} not eligible`)
  return gaps
}
