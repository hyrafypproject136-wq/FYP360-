/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { errorMessage } from '../lib/supabase'
import { loadVisibleProposals, type Proposal } from '../lib/proposalsApi'
import { loadSettings, type Settings } from '../lib/adminApi'
import { loadMarksData, type MarksData } from '../lib/marksApi'
import { loadWorkflow, type WorkflowData } from '../lib/workflowApi'
import { loadAssignedGroups } from '../pages/portal/portalApi'
import { useToast } from '../components/Toast'

export type StaffData = Awaited<ReturnType<typeof loadAssignedGroups>> & { proposals: Proposal[]; marks: MarksData; settings: Settings; work: WorkflowData }

interface StaffValue {
  data: StaffData | null
  error: string | null
  reload: () => Promise<void>
  toast: (m: string) => void
}

const Ctx = createContext<StaffValue | undefined>(undefined)

export function StaffDataProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [data, setData] = useState<StaffData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(async () => {
    try {
      const [g, proposals, marks, settings, work] = await Promise.all([loadAssignedGroups(), loadVisibleProposals(), loadMarksData(), loadSettings(), loadWorkflow()])
      setData({ ...g, proposals, marks, settings, work })
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [])
  useEffect(() => {
    reload()
  }, [reload])
  return <Ctx.Provider value={{ data, error, reload, toast }}>{children}</Ctx.Provider>
}

export function useStaff() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStaff outside provider')
  return v
}

export function useStaffData() {
  const v = useStaff()
  if (!v.data) throw new Error('Staff data not loaded')
  return v as StaffValue & { data: StaffData }
}
