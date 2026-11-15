/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'

const ToastContext = createContext<(message: string) => void>(() => {})

/** macOS-notification style messages in the top-right corner. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; message: string }[]>([])
  const toast = useCallback((message: string) => {
    const id = Date.now() + Math.random()
    setItems((list) => [...list.slice(-2), { id, message }])
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 3800)
  }, [])
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 w-[min(360px,calc(100vw-32px))]" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="glass-strong window-shadow rounded-2xl px-4 py-3 flex items-start gap-3 toast-in">
            <CheckCircle2 size={18} className="text-good mt-0.5 shrink-0" />
            <span className="text-[13px] text-ink">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
