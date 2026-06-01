import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-main, #f0f4ff)' }}>
          <div className="max-w-md w-full p-8 rounded-2xl shadow-2xl text-center border" style={{ background: 'var(--bg-card, #fff)', borderColor: 'var(--danger, #ef4444)' }}>
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <AlertTriangle className="w-8 h-8" style={{ color: 'var(--danger, #ef4444)' }} />
            </div>
            <h2 className="text-xl font-black mb-2" style={{ color: 'var(--text-heading, #020617)' }}>
              حدث خطأ غير متوقع
            </h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted, #64748b)' }}>
              نعتذر عن هذا الخطأ. يرجى تحديث الصفحة والمحاولة مرة أخرى.
            </p>
            {this.state.error && (
              <details className="text-xs text-left mb-4 p-3 rounded-lg" style={{ background: 'var(--bg-input, #f8fafc)', color: 'var(--text-muted, #64748b)' }}>
                <summary className="font-bold cursor-pointer mb-1">تفاصيل الخطأ</summary>
                <pre className="whitespace-pre-wrap mt-1">{this.state.error.message}</pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
              style={{ background: 'var(--primary, #2563eb)', color: 'var(--text-on-primary, #fff)' }}
            >
              <RefreshCw className="w-4 h-4" />
              تحديث الصفحة
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
