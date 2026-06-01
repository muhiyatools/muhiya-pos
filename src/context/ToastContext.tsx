import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastContextValue {
  success: (msg: string, duration?: number) => void
  error: (msg: string, duration?: number) => void
  warning: (msg: string, duration?: number) => void
  info: (msg: string, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue>({
  success: () => {},
  error: () => {},
  warning: () => {},
  info: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

const configs: Record<ToastType, { bg: string; border: string; color: string; icon: typeof CheckCircle2 }> = {
  success: { bg: '#f0fdf4', border: '#86efac', color: '#16a34a', icon: CheckCircle2 },
  error:   { bg: '#fef2f2', border: '#fca5a5', color: '#dc2626', icon: XCircle },
  warning: { bg: '#fffbeb', border: '#fcd34d', color: '#d97706', icon: AlertTriangle },
  info:    { bg: '#eff6ff', border: '#93c5fd', color: '#2563eb', icon: Info },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)

  const add = useCallback((type: ToastType, message: string, duration = 3500) => {
    const id = `t-${++counter.current}`
    setToasts(prev => [...prev.slice(-4), { id, type, message, duration }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const ctx: ToastContextValue = {
    success: (m, d) => add('success', m, d),
    error:   (m, d) => add('error', m, d),
    warning: (m, d) => add('warning', m, d),
    info:    (m, d) => add('info', m, d),
  }

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* Toast Container */}
      <div
        className="fixed bottom-4 left-4 z-[9999] flex flex-col gap-2 pointer-events-none"
        style={{ maxWidth: '360px' }}
      >
        {toasts.map(toast => {
          const cfg = configs[toast.type]
          const Icon = cfg.icon
          return (
            <div
              key={toast.id}
              className="flex items-start gap-3 p-3.5 rounded-xl shadow-2xl border pointer-events-auto"
              style={{
                background: cfg.bg,
                borderColor: cfg.border,
                animation: 'slideUpToast 0.25s ease-out',
              }}
            >
              <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: cfg.color }} />
              <p className="flex-1 text-sm font-medium leading-snug" style={{ color: cfg.color }}>{toast.message}</p>
              <button
                onClick={() => remove(toast.id)}
                className="flex-shrink-0 p-0.5 rounded hover:opacity-70 transition-opacity pointer-events-auto"
                style={{ color: cfg.color }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>
      <style>{`
        @keyframes slideUpToast {
          from { transform: translateY(16px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </ToastContext.Provider>
  )
}
