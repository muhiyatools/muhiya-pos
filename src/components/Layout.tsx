import { Outlet, Link, useLocation } from 'react-router-dom'
import { useThemeStore } from '../store/useThemeStore'
import { useAuth } from '../context/AuthContext'
import { useTenant } from '../context/TenantContext'
import { useCompanyProfile, useOrganization } from '../hooks/useData'
import { cn } from '../lib/utils'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, ShoppingCart, Package, ClipboardList, Receipt,
  LogOut, Menu, X, Users, Settings, Building2,
  ArrowLeftRight, Truck, RotateCcw, BarChart3, Tag, FolderOpen,
} from 'lucide-react'

const allNavSections = [
  {
    label: 'الرئيسية',
    items: [
      { path: '/',    label: 'لوحة التحكم', icon: LayoutDashboard, module: 'dashboard' },
      { path: '/pos', label: 'نقطة البيع',  icon: ShoppingCart,    module: 'pos' },
    ],
  },
  {
    label: 'العمليات',
    items: [
      { path: '/orders',      label: 'الطلبات',      icon: ClipboardList, module: 'orders' },
      { path: '/returns',     label: 'المرتجعات',    icon: RotateCcw,     module: 'returns' },
      { path: '/promo-codes', label: 'أكواد الخصم', icon: Tag,           module: 'promo_codes' },
    ],
  },
  {
    label: 'المخزون والمشتريات',
    items: [
      { path: '/products',        label: 'المنتجات',        icon: Package,         module: 'products' },
      { path: '/categories',      label: 'التصنيفات',       icon: FolderOpen,      module: 'categories' },
      { path: '/stock-transfers', label: 'تحويل المخزون',  icon: ArrowLeftRight,  module: 'stock_transfers' },
      { path: '/suppliers', label: 'الموردون والمشتريات', icon: Truck, module: 'suppliers' },
    ],
  },
  {
    label: 'المالية والتقارير',
    items: [
      { path: '/finance',  label: 'الإيرادات والمصروفات', icon: Receipt,   module: 'finance' },
      { path: '/reports',  label: 'التقارير',              icon: BarChart3, module: 'reports' },
    ],
  },
  {
    label: 'الإدارة',
    items: [
      { path: '/branches', label: 'الفروع والمخازن', icon: Building2, module: 'branches' },
      { path: '/users-roles',   label: 'المستخدمون والأدوار', icon: Users,    module: 'users' },
      { path: '/settings',      label: 'الإعدادات',            icon: Settings, module: 'settings' },
    ],
  },
]

// For breadcrumb title lookup (includes merged routes)
const allNavPaths: Record<string, string> = {
  '/': 'لوحة التحكم', '/pos': 'نقطة البيع',
  '/products': 'المنتجات', '/categories': 'التصنيفات', '/stock-transfers': 'تحويل المخزون',
  '/orders': 'الطلبات', '/returns': 'المرتجعات', '/promo-codes': 'أكواد الخصم',
  '/suppliers': 'الموردون والمشتريات', '/purchase-orders': 'الموردون والمشتريات',
  '/finance': 'الإيرادات والمصروفات', '/reports': 'التقارير',
  '/branches': 'الفروع والمخازن', '/warehouses': 'الفروع والمخازن',
  '/users-roles': 'المستخدمون والأدوار', '/settings': 'الإعدادات',
}

export default function Layout() {
  const { applyToDOM } = useThemeStore()
  const { org } = useOrganization()
  const { user, currentUser, signOut, isAdmin, hasPermission } = useAuth()
  const { tenant, branches } = useTenant()
  const { company } = useCompanyProfile(tenant?.id)

  // Resolve user's assigned branch name
  const userBranch = !isAdmin && currentUser?.branch_id ? branches.find(b => b.id === currentUser.branch_id) : null

  // Filter nav: check role permissions for each module
  const navSections = allNavSections.map(sec => ({
    ...sec,
    items: sec.items.filter(item => hasPermission(item.module)),
  })).filter(sec => sec.items.length > 0)
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => { applyToDOM() }, [applyToDOM])

  const displayName = currentUser?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'مستخدم'
  const roleLabel = currentUser?.role_name || currentUser?.roles[0]?.name || 'مستخدم'
  const initials = displayName.substring(0, 2)
  const companyName = company?.name || org?.name || 'المؤسسة'
  const companyLogo = company?.logo_url || org?.logo_url || ''

  // Dynamic browser title (white label)
  useEffect(() => {
    document.title = companyName || 'نظام نقاط البيع'
  }, [companyName])

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-main)' }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed lg:relative z-50 h-full flex flex-col flex-shrink-0 transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-[260px]',
        mobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
      )} style={{ background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border-light)' }}>

        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border-light)' }}>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {companyLogo ? (
              <img
                src={companyLogo}
                alt={companyName || 'logo'}
                className="flex-shrink-0 object-contain rounded-lg"
                style={{ width: '32px', height: '32px' }}
              />
            ) : (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black flex-shrink-0" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
                {companyName?.[0] || 'م'}
              </div>
            )}
            {!collapsed && <span className="font-bold text-sm truncate" style={{ color: '#fff' }}>{companyName}</span>}
          </div>
          <button className="lg:hidden ml-auto p-1 flex-shrink-0" onClick={() => setMobileOpen(false)} style={{ color: 'var(--text-muted)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {navSections.map(section => (
            <div key={section.label}>
              {!collapsed && (
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2 px-2" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>{section.label}</p>
              )}
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const Icon = item.icon
                  const active = isActive(item.path)
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                        active && 'font-bold shadow-sm',
                        !active && 'hover:translate-x-[-2px]'
                      )}
                      style={{
                        background: active ? 'rgba(16,185,129,0.12)' : 'transparent',
                        color: active ? 'var(--primary)' : 'var(--text-on-sidebar)',
                        boxShadow: active ? '0 0 12px rgba(16,185,129,0.1)' : 'none',
                      }}
                      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' } }}
                      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent' } }}
                    >
                      <Icon className="w-[18px] h-[18px] flex-shrink-0 transition-opacity" style={{ opacity: active ? 1 : 0.5 }} />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t flex-shrink-0" style={{ borderColor: 'var(--border-light)' }}>
          <div className={cn('flex items-center gap-2', collapsed && 'justify-center')}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
              {initials}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate" style={{ color: '#fff' }}>{displayName}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{roleLabel}</p>
                {userBranch && (
                  <p className="text-[10px] flex items-center gap-1 mt-0.5" style={{ color: 'var(--primary)' }}>
                    <Building2 className="w-2.5 h-2.5" />{userBranch.name}
                  </p>
                )}
              </div>
            )}
            {!collapsed && (
              <button onClick={() => signOut()} className="p-1.5 rounded-lg hover:opacity-80 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex items-center px-4 lg:px-6 justify-between flex-shrink-0 border-b" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-1" onClick={() => setMobileOpen(true)} style={{ color: 'var(--text-muted)' }}>
              <Menu className="w-5 h-5" />
            </button>
            <button className="hidden lg:block p-1" onClick={() => setCollapsed(!collapsed)} style={{ color: 'var(--text-muted)' }}>
              <Menu className="w-4 h-4" />
            </button>
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
              {allNavPaths[location.pathname] || 'لوحة التحكم'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {new Date().toLocaleDateString('ar-EG', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
