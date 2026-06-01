import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Loader2 } from 'lucide-react'

// Map route paths to the permission module they require
const ROUTE_MODULE_MAP: Record<string, string> = {
  '/': 'dashboard',
  '/products': 'products',
  '/categories': 'categories',
  '/stock-transfers': 'stock_transfers',
  '/branches': 'branches',
  '/warehouses': 'branches',
  '/suppliers': 'suppliers',
  '/purchase-orders': 'suppliers',
  '/orders': 'orders',
  '/returns': 'returns',
  '/promo-codes': 'promo_codes',
  '/finance': 'finance',
  '/reports': 'reports',
  '/users-roles': 'users',
  '/settings': 'settings',
  '/notifications': 'notifications',
  '/pos': 'pos',
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, hasPermission } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main, #f0f4ff)' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary, #2563eb)' }} />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Check route-level permissions
  const pathBase = '/' + (location.pathname.split('/')[1] || '')
  const requiredModule = ROUTE_MODULE_MAP[pathBase]

  if (requiredModule && !hasPermission(requiredModule)) {
    const fallbackOrder = ['/pos', '/orders', '/returns', '/products', '/finance', '/reports', '/']
    const fallback = fallbackOrder.find(p => {
      const mod = ROUTE_MODULE_MAP[p]
      return mod && hasPermission(mod)
    }) || '/pos'
    if (pathBase !== fallback) {
      return <Navigate to={fallback} replace />
    }
  }

  return <>{children}</>
}

export function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main, #f0f4ff)' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary, #2563eb)' }} />
      </div>
    )
  }

  if (user) {
    const from = location.state?.from?.pathname || '/'
    return <Navigate to={from} replace />
  }

  return <>{children}</>
}
