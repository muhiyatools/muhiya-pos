import { useMemo, useState, useEffect } from 'react'
import { useShifts } from '../hooks/useSaasData'
import { useTenant } from '../context/TenantContext'
import { useAuth } from '../context/AuthContext'
import { formatEGP } from '../lib/utils'
import { Clock, Play, Square, Loader2, Building2, User2, ChevronDown, ChevronUp, Banknote, CreditCard, TrendingUp } from 'lucide-react'

export default function ShiftsPage() {
  const { tenant, currentBranch, branches } = useTenant()
  const { user, isAdmin, currentUser } = useAuth()
  const [filterBranch, setFilterBranch] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin && currentUser?.branch_id) setFilterBranch(currentUser.branch_id)
  }, [isAdmin, currentUser?.branch_id])

  const { shifts, loading, openShift, closeShift } = useShifts(tenant?.id, filterBranch || currentBranch?.id)

  const activeShift = useMemo(() => shifts.find(s => s.status === 'open'), [shifts])
  const closedShifts = useMemo(() => shifts.filter(s => s.status === 'closed'), [shifts])
  const [expandedShift, setExpandedShift] = useState<string | null>(null)

  // Summary stats across all shifts
  const summary = useMemo(() => {
    const totalSales = closedShifts.reduce((s, sh) => s + (sh.total_sales || 0), 0)
    const totalOrders = closedShifts.reduce((s, sh) => s + (sh.total_orders || 0), 0)
    const totalRefunds = closedShifts.reduce((s, sh) => s + (sh.total_refunds || 0), 0)
    const avgPerShift = closedShifts.length > 0 ? totalSales / closedShifts.length : 0
    return { totalSales, totalOrders, totalRefunds, avgPerShift, shiftCount: closedShifts.length }
  }, [closedShifts])

  const getBranchName = (id: string) => branches.find(b => b.id === id)?.name || '—'

  const handleOpen = async () => {
    if (!tenant || !currentBranch || !user) return
    await openShift({
      tenant_id: tenant.id,
      branch_id: currentBranch.id,
      cashier_id: user.id,
      cashier_name: currentUser?.full_name || user.email?.split('@')[0] || 'كاشير',
      starting_cash: 0,
    })
  }

  const handleClose = async () => {
    if (!activeShift) return
    const expectedCash = (activeShift.starting_cash || 0) + (activeShift.total_sales || 0) - (activeShift.total_refunds || 0)
    await closeShift(activeShift.id, expectedCash)
  }

  const formatDuration = (start: string, end?: string) => {
    const s = new Date(start)
    const e = end ? new Date(end) : new Date()
    const diffMs = e.getTime() - s.getTime()
    const hours = Math.floor(diffMs / 3600000)
    const mins = Math.floor((diffMs % 3600000) / 60000)
    return `${hours}س ${mins}د`
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-heading)' }}>الورديات</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>إدارة ورديات العمل</p>
        </div>
        {!activeShift ? (
          <button onClick={handleOpen} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold" style={{ background: '#10b981', color: '#fff' }}>
            <Play className="w-4 h-4" />فتح وردية
          </button>
        ) : (
          <button onClick={handleClose} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold" style={{ background: '#ef4444', color: '#fff' }}>
            <Square className="w-4 h-4" />إغلاق الوردية
          </button>
        )}
      </div>

      {/* Branch Filter — admin only */}
      {isAdmin && branches.length > 1 && (
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-input)' }}>
            <button onClick={() => setFilterBranch(null)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{ background: !filterBranch ? 'var(--bg-card)' : 'transparent', color: !filterBranch ? 'var(--primary)' : 'var(--text-muted)', boxShadow: !filterBranch ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              كل الفروع
            </button>
            {branches.map(b => (
              <button key={b.id} onClick={() => setFilterBranch(b.id)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{ background: filterBranch === b.id ? 'var(--bg-card)' : 'transparent', color: filterBranch === b.id ? 'var(--primary)' : 'var(--text-muted)', boxShadow: filterBranch === b.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active shift card */}
      {activeShift && (
        <div className="p-6 rounded-2xl border-2" style={{ borderColor: '#10b981', background: 'rgba(16,185,129,0.05)' }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: '#10b981' }} />
            <span className="text-sm font-bold" style={{ color: '#10b981' }}>وردية نشطة</span>
            {isAdmin && <span className="text-xs px-2 py-0.5 rounded-lg mr-2" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>{getBranchName(activeShift.branch_id)}</span>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>الكاشير</p>
              <p className="text-sm font-bold mt-1 flex items-center gap-1" style={{ color: 'var(--text-heading)' }}>
                <User2 className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                {activeShift.cashier_name || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>وقت البدء</p>
              <p className="text-sm font-bold mt-1" style={{ color: 'var(--text-heading)' }}>{new Date(activeShift.opened_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>المدة</p>
              <p className="text-sm font-bold mt-1" style={{ color: 'var(--text-heading)' }}>{formatDuration(activeShift.opened_at, activeShift.closed_at || undefined)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>إجمالي المبيعات</p>
              <p className="text-sm font-bold mt-1" style={{ color: 'var(--text-heading)' }}>{formatEGP(activeShift.total_sales || 0)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>عدد الطلبات</p>
              <p className="text-sm font-bold mt-1" style={{ color: 'var(--text-heading)' }}>{activeShift.total_orders || 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* Shift Summary Stats */}
      {closedShifts.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'إجمالي الورديات', value: summary.shiftCount, color: 'var(--primary)', icon: Clock },
            { label: 'إجمالي المبيعات', value: formatEGP(summary.totalSales), color: '#3b82f6', icon: TrendingUp, isText: true },
            { label: 'إجمالي الطلبات', value: summary.totalOrders, color: '#8b5cf6', icon: Banknote },
            { label: 'إجمالي المرتجعات', value: formatEGP(summary.totalRefunds), color: '#ef4444', icon: CreditCard, isText: true },
            { label: 'متوسط المبيعات/وردية', value: formatEGP(summary.avgPerShift), color: '#10b981', icon: TrendingUp, isText: true },
          ].map((card, i) => (
            <div key={i} className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
              <div className="flex items-center gap-2 mb-1">
                <card.icon className="w-3.5 h-3.5" style={{ color: card.color }} />
                <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{card.label}</p>
              </div>
              <p className="text-lg font-black" style={{ color: card.color }}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Shift history */}
      <div>
        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-heading)' }}>سجل الورديات</h2>
        <div className="space-y-2">
          {closedShifts.map(s => (
            <div key={s.id} className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
              <div className="p-4 cursor-pointer" onClick={() => setExpandedShift(expandedShift === s.id ? null : s.id)}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(107,114,128,0.1)' }}>
                      <Clock className="w-5 h-5" style={{ color: '#6b7280' }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
                          {new Date(s.opened_at).toLocaleDateString('ar-EG')}
                        </p>
                        {isAdmin && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>{getBranchName(s.branch_id)}</span>
                        )}
                      </div>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        <User2 className="w-3 h-3 inline ml-1" />{s.cashier_name || '—'} · {new Date(s.opened_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })} — {s.closed_at ? new Date(s.closed_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—'} ({formatDuration(s.opened_at, s.closed_at || undefined)})
                      </p>
                      {s.cash_difference != null && s.cash_difference !== 0 && (
                        <p className="text-[10px] font-medium mt-0.5" style={{ color: s.cash_difference > 0 ? '#10b981' : '#ef4444' }}>
                          فرق الدرج: {s.cash_difference > 0 ? '+' : ''}{formatEGP(s.cash_difference)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{formatEGP(s.total_sales || 0)}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.total_orders || 0} طلب {s.total_refunds ? `· مرتجعات ${formatEGP(s.total_refunds)}` : ''}</p>
                    </div>
                    {expandedShift === s.id ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
                  </div>
                </div>
              </div>
              {expandedShift === s.id && (
                <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border-light)' }}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                    <div className="p-3 rounded-xl" style={{ background: 'var(--bg-input)' }}>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>نقدية البداية</p>
                      <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--text-heading)' }}>{formatEGP(s.starting_cash || 0)}</p>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: 'var(--bg-input)' }}>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>نقدية الإغلاق</p>
                      <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--text-heading)' }}>{formatEGP(s.closing_cash || 0)}</p>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: 'var(--bg-input)' }}>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>النقدية المتوقعة</p>
                      <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--text-heading)' }}>{formatEGP((s.starting_cash || 0) + (s.total_sales || 0) - (s.total_refunds || 0))}</p>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: 'var(--bg-input)' }}>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>فرق الدرج</p>
                      <p className="text-sm font-bold mt-0.5" style={{ color: (s.cash_difference || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                        {(s.cash_difference || 0) >= 0 ? '+' : ''}{formatEGP(s.cash_difference || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {closedShifts.length === 0 && !activeShift && (
          <div className="text-center py-16 opacity-50">
            <Clock className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>لا توجد ورديات سابقة</p>
          </div>
        )}
      </div>
    </div>
  )
}
