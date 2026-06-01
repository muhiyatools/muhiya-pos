import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useThemeStore } from '../store/useThemeStore'
import { useCompanyProfile, useOrganization } from '../hooks/useData'
import { Lock, Mail, Eye, EyeOff, AlertCircle, Loader2, ArrowLeft } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'

export default function Auth() {
  const { companyName, applyToDOM } = useThemeStore()
  const { company } = useCompanyProfile()
  const { org } = useOrganization()
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { applyToDOM() }, [applyToDOM])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) { setError(error.message); return }
    const from = location.state?.from?.pathname || '/'
    navigate(from, { replace: true })
  }

  const displayName = company?.name || org?.name || (() => { try { const c = JSON.parse(localStorage.getItem('app_org_cache') || '{}'); return c.name } catch { return null } })() || companyName || 'نظام الإدارة'
  const displayLogo = company?.logo_url || org?.logo_url || (() => { try { const c = JSON.parse(localStorage.getItem('app_org_cache') || '{}'); return c.logo_url } catch { return '' } })() || ''
  const displayAddress = company?.address || org?.address || (() => { try { const c = JSON.parse(localStorage.getItem('app_org_cache') || '{}'); return c.address } catch { return '' } })() || ''
  const displayPhone = company?.phone || org?.phone || (() => { try { const c = JSON.parse(localStorage.getItem('app_org_cache') || '{}'); return c.phone } catch { return '' } })() || ''

  // Set browser title dynamically
  useEffect(() => {
    document.title = displayName || 'نظام نقاط البيع'
  }, [displayName])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'var(--bg-main)' }}>
      <div className="w-full max-w-sm z-10 slide-up">
        <div className="text-center mb-8">
          {displayLogo ? (
            <img src={displayLogo} alt={displayName} className="h-20 mx-auto mb-5 object-contain" />
          ) : (
            <div className="w-20 h-20 rounded-2xl mx-auto mb-5 flex items-center justify-center text-3xl font-black" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
              {displayName?.[0] || 'م'}
            </div>
          )}
          <h1 className="text-xl font-black" style={{ color: 'var(--text-heading)' }}>{displayName}</h1>
          {displayAddress && (
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{displayAddress}</p>
          )}
          {displayPhone && (
            <p className="text-xs mt-1 font-mono" dir="ltr" style={{ color: 'var(--text-muted)' }}>{displayPhone}</p>
          )}
        </div>

        <div className="p-6 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="flex items-center gap-3 p-4 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold mb-2.5" style={{ color: 'var(--text-muted)' }}>البريد الإلكتروني</label>
              <div className="relative">
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--primary)' }} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={loading}
                  className="w-full pr-12 pl-4 py-3.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 disabled:opacity-50"
                  dir="ltr"
                  placeholder="admin@example.com"
                  style={{ background: 'var(--bg-input)', borderColor: error ? '#ef4444' : 'var(--border)', color: 'var(--text-main)' } as any}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-2.5" style={{ color: 'var(--text-muted)' }}>كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--primary)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full pr-12 pl-12 py-3.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 disabled:opacity-50"
                  dir="ltr"
                  placeholder="••••••••"
                  style={{ background: 'var(--bg-input)', borderColor: error ? '#ef4444' : 'var(--border)', color: 'var(--text-main)' } as any}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-1 transition-colors disabled:opacity-50"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-3.5 rounded-xl font-bold text-sm shadow-lg transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2 hover:shadow-xl active:scale-[0.98]"
              style={{ background: 'var(--primary)', color: 'var(--text-on-primary)', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)' }}
            >
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" />جاري تسجيل الدخول...</> : <><ArrowLeft className="w-5 h-5" />تسجيل الدخول</>}
            </button>
          </form>

        </div>
      </div>
    </div>
  )
}
