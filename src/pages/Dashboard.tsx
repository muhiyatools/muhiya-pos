import { useEffect, useState } from 'react'
import { useStats, useOrders, useProducts, useExpenses } from '../hooks/useData'
import { useSyncStaging } from '../hooks/useSaasData'
import { useAuth } from '../context/AuthContext'
import { useTenant } from '../context/TenantContext'
import { formatEGP } from '../lib/utils'
import { approveStaged, rejectStaged } from '../lib/syncEngine'
import { Link } from 'react-router-dom'
import {
  ShoppingCart, DollarSign, TrendingUp, TrendingDown,
  AlertTriangle, Package, ShoppingBag, CheckCircle2,
  Clock, ArrowLeft, BarChart3, Building2,
  Wifi, Check, X, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react'

export default function Dashboard() {
  const { branches, tenant } = useTenant()
  const { user, currentUser, isAdmin } = useAuth()
  const [filterBranch, setFilterBranch] = useState<string | null>(null)
  const [stagingExpanded, setStagingExpanded] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [rejectNotes, setRejectNotes] = useState('')
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  // Non-admin users see only their branch
  useEffect(() => {
    if (!isAdmin && currentUser?.branch_id) setFilterBranch(currentUser.branch_id)
  }, [isAdmin, currentUser?.branch_id])

  const branchForQuery = filterBranch || null
  const { stats, loading } = useStats(branchForQuery)
  const { orders } = useOrders(branchForQuery)
  const { products } = useProducts()
  const { pending: pendingExpenses } = useExpenses(branchForQuery)
  const { pending: pendingStaged, approved: approvedStaged, rejected: rejectedStaged, fetch: fetchStaging } = useSyncStaging(tenant?.id)

  const handleApprove = async (id: string) => {
    if (!user?.id) return
    setProcessingId(id)
    const ok = await approveStaged(id, user.id)
    if (ok) await fetchStaging()
    setProcessingId(null)
  }

  const handleReject = async (id: string) => {
    if (!user?.id) return
    setProcessingId(id)
    const ok = await rejectStaged(id, user.id, rejectNotes)
    if (ok) { setRejectingId(null); setRejectNotes(''); await fetchStaging() }
    setProcessingId(null)
  }

  const filteredOrders = branchForQuery ? orders.filter(o => o.branch_id === branchForQuery) : orders

  const lowStockProducts = products.filter(p => p.track_stock && p.stock !== null && p.stock <= (p.low_stock_threshold ?? 10))
  const todayOrders = filteredOrders.filter(o => {
    const today = new Date().toISOString().slice(0, 10)
    return o.created_at?.startsWith(today)
  })
  const completedOrders = filteredOrders.filter(o => o.status === 'completed')
  const netResult = stats.netProfit
  const displayName = currentUser?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0]
  const profitMargin = stats.totalRevenue > 0 ? ((netResult / (stats.totalRevenue + stats.totalOtherIncome)) * 100) : 0

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>جاري التحميل...</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-5 slide-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-heading)' }}>
            مرحباً {displayName}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link to="/pos" className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)' }}>
          <ShoppingCart className="w-4 h-4" />
          نقطة البيع
        </Link>
      </div>

      {/* Branch Filter — admin only, inline on page */}
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

      {/* Alerts */}
      {isAdmin && (lowStockProducts.length > 0 || pendingExpenses.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {lowStockProducts.length > 0 && (
            <Link to="/products" className="flex items-center gap-3 p-4 rounded-xl border" style={{ background: 'rgba(239,68,68,0.04)', borderColor: '#fca5a5' }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                <AlertTriangle className="w-4 h-4" style={{ color: '#dc2626' }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: '#dc2626' }}>مخزون منخفض: {lowStockProducts.length} منتج</p>
                <p className="text-xs" style={{ color: '#dc2626', opacity: 0.7 }}>انقر لمراجعة المنتجات</p>
              </div>
              <ArrowLeft className="w-4 h-4 mr-auto" style={{ color: '#dc2626' }} />
            </Link>
          )}
          {pendingExpenses.length > 0 && (
            <Link to="/finance" className="flex items-center gap-3 p-4 rounded-xl border" style={{ background: 'rgba(245,158,11,0.04)', borderColor: '#fcd34d' }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.1)' }}>
                <Clock className="w-4 h-4" style={{ color: '#d97706' }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: '#d97706' }}>مصروفات معلقة: {pendingExpenses.length}</p>
                <p className="text-xs" style={{ color: '#d97706', opacity: 0.7 }}>تحتاج مراجعة واعتماد</p>
              </div>
              <ArrowLeft className="w-4 h-4 mr-auto" style={{ color: '#d97706' }} />
            </Link>
          )}
        </div>
      )}

      {/* Offline Sync Staging — admin only */}
      {isAdmin && pendingStaged.length > 0 && (
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          <button onClick={() => setStagingExpanded(!stagingExpanded)} className="w-full flex items-center justify-between px-5 py-3.5 border-b transition-colors" style={{ borderColor: 'var(--border-light)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)' }}>
                <Wifi className="w-4 h-4" style={{ color: '#6366f1' }} />
              </div>
              <div className="text-right">
                <p className="text-sm font-bold" style={{ color: '#6366f1' }}>طلبات أوفلاين بانتظار الاعتماد: {pendingStaged.length}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {approvedStaged.length > 0 && `${approvedStaged.length} معتمد`}
                  {rejectedStaged.length > 0 && ` · ${rejectedStaged.length} مرفوض`}
                </p>
              </div>
            </div>
            {stagingExpanded ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
          </button>

          {stagingExpanded && (
            <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
              {pendingStaged.map(entry => {
                const { order, items } = (entry.payload || {}) as any
                if (!order) return null
                return (
                  <div key={entry.id} className="px-5 py-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold font-mono" style={{ color: 'var(--text-heading)' }}>{order.order_ref}</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {order.customer_name || 'عميل عام'} · {order.cashier_name} · {entry.offline_created_at?.slice(0, 16).replace('T', ' ')}
                        </p>
                      </div>
                      <span className="text-sm font-black" style={{ color: 'var(--primary)' }}>{formatEGP(order.total)}</span>
                    </div>

                    {/* Items summary */}
                    <div className="flex flex-wrap gap-1">
                      {(items || []).slice(0, 5).map((it: any, i: number) => (
                        <span key={i} className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                          {it.product_name} × {it.quantity}
                        </span>
                      ))}
                      {(items || []).length > 5 && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                          +{items.length - 5} أخرى
                        </span>
                      )}
                    </div>

                    {/* Payment info */}
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      الدفع: {order.payment_method === 'cash' ? 'نقدي' : order.payment_method === 'card' ? 'بطاقة' : order.payment_method === 'split' ? 'مقسم' : order.payment_method}
                      {order.discount_amount > 0 && ` · خصم ${formatEGP(order.discount_amount)}`}
                      {order.tax_amount > 0 && ` · ضريبة ${formatEGP(order.tax_amount)}`}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprove(entry.id)}
                        disabled={!!processingId}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-[1.02] disabled:opacity-50"
                        style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}
                      >
                        {processingId === entry.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        اعتماد
                      </button>

                      {rejectingId === entry.id ? (
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            value={rejectNotes}
                            onChange={e => setRejectNotes(e.target.value)}
                            placeholder="سبب الرفض (اختياري)"
                            className="flex-1 px-2 py-1.5 rounded-lg text-xs border outline-none"
                            style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}
                          />
                          <button
                            onClick={() => handleReject(entry.id)}
                            disabled={!!processingId}
                            className="px-2 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                          >
                            تأكيد الرفض
                          </button>
                          <button onClick={() => { setRejectingId(null); setRejectNotes('') }} className="px-2 py-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>إلغاء</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRejectingId(entry.id)}
                          disabled={!!processingId}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-[1.02] disabled:opacity-50"
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                        >
                          <X className="w-3 h-3" />
                          رفض
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Financial KPIs — 4 clean cards (admin full, cashier limited) */}
      <div className={`grid gap-4 ${isAdmin ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2'}`}>
        {[
          { icon: ShoppingBag, label: 'مبيعات اليوم', value: formatEGP(stats.todayRevenue), sub: `${todayOrders.length} طلب`, color: '#10b981', show: true },
          { icon: DollarSign, label: 'إجمالي الإيرادات', value: formatEGP(stats.totalRevenue + stats.totalOtherIncome), sub: stats.totalOtherIncome > 0 ? `دخل إضافي ${formatEGP(stats.totalOtherIncome)}` : undefined, color: '#0ea5e9', show: isAdmin },
          { icon: TrendingDown, label: 'إجمالي المصروفات', value: formatEGP(stats.totalExpenses), color: '#ef4444', show: isAdmin },
          { icon: TrendingUp, label: 'صافي الربح', value: formatEGP(netResult), sub: stats.totalRevenue > 0 ? `هامش ${profitMargin.toFixed(1)}%` : undefined, color: netResult >= 0 ? '#10b981' : '#ef4444', show: isAdmin },
          { icon: ShoppingCart, label: 'عدد الطلبات اليوم', value: todayOrders.length, color: '#3b82f6', show: !isAdmin },
        ].filter(k => k.show).map((kpi, i) => (
          <div key={i} className="p-5 rounded-2xl border transition-all duration-200 hover:shadow-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: kpi.color + '1a' }}>
                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
              </div>
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{kpi.label}</p>
            </div>
            <p className="text-xl font-black tabular-nums" style={{ color: 'var(--text-heading)' }}>{kpi.value}</p>
            {kpi.sub && <p className="text-[11px] mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>{kpi.sub}</p>}
          </div>
        ))}
      </div>

      {/* Quick Stats Row — admin only */}
      {isAdmin && <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Package, label: 'المنتجات', value: stats.totalProducts, color: '#8b5cf6', link: '/products' },
          { icon: ShoppingCart, label: 'الطلبات', value: stats.totalOrders, color: '#3b82f6', link: '/orders' },
          { icon: CheckCircle2, label: 'مكتملة', value: completedOrders.length, color: '#10b981', link: '/orders' },
          { icon: BarChart3, label: 'متوسط الطلب', value: stats.totalOrders > 0 ? formatEGP(stats.totalRevenue / stats.totalOrders) : formatEGP(0), color: '#f59e0b', link: '/reports' },
        ].map((kpi, i) => (
          <Link key={i} to={kpi.link} className="p-4 rounded-2xl border transition-all duration-200 hover:shadow-md group" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110" style={{ background: kpi.color + '1a' }}>
                <kpi.icon className="w-3.5 h-3.5" style={{ color: kpi.color }} />
              </div>
              <p className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>{kpi.label}</p>
            </div>
            <p className="text-lg font-black tabular-nums" style={{ color: kpi.color }}>{kpi.value}</p>
          </Link>
        ))}
      </div>}

      {/* Bottom: Recent orders + Low Stock */}
      <div className={`grid grid-cols-1 ${isAdmin ? 'lg:grid-cols-2' : ''} gap-5`}>
        {/* Recent Orders */}
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: 'var(--border-light)' }}>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>آخر الطلبات</h3>
            <Link to="/orders" className="text-xs font-bold transition-opacity hover:opacity-70" style={{ color: 'var(--primary)' }}>عرض الكل</Link>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
            {filteredOrders.slice(0, 6).map(o => (
              <div key={o.id} className="flex items-center justify-between px-5 py-3 transition-colors duration-150 hover:bg-opacity-50" style={{}} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-input)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <div>
                  <p className="text-xs font-bold font-mono tabular-nums" style={{ color: 'var(--text-heading)' }}>{o.order_ref}</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{o.customer_name || 'عميل عام'} · {o.created_at?.slice(11, 16)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: 'var(--text-heading)' }}>{formatEGP(o.total)}</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: o.status === 'completed' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: o.status === 'completed' ? '#10b981' : '#f59e0b' }}>
                    {o.status === 'completed' ? 'مكتمل' : 'معلق'}
                  </span>
                </div>
              </div>
            ))}
            {filteredOrders.length === 0 && <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>لا توجد طلبات</p>}
          </div>
        </div>

        {/* Low Stock Alert — admin only */}
        {isAdmin && <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: 'var(--border-light)' }}>
            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-heading)' }}>
              <AlertTriangle className="w-4 h-4" style={{ color: '#f59e0b' }} />
              تنبيهات المخزون
            </h3>
            <Link to="/products" className="text-xs font-bold transition-opacity hover:opacity-70" style={{ color: 'var(--primary)' }}>إدارة المخزون</Link>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
            {lowStockProducts.slice(0, 6).map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  {p.primary_image_url
                    ? <img src={p.primary_image_url} alt="" className="w-7 h-7 rounded object-cover" />
                    : <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: 'var(--bg-input)' }}><Package className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} /></div>
                  }
                  <div>
                    <p className="text-xs font-bold" style={{ color: 'var(--text-heading)' }}>{p.name}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.unit || 'قطعة'}</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold" style={{ background: (p.stock ?? 0) === 0 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', color: (p.stock ?? 0) === 0 ? '#ef4444' : '#f59e0b' }}>
                  {p.stock ?? 0} متبقي
                </span>
              </div>
            ))}
            {lowStockProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8">
                <CheckCircle2 className="w-8 h-8 mb-2" style={{ color: '#10b981' }} />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>المخزون كافٍ</p>
              </div>
            )}
          </div>
        </div>}
      </div>
    </div>
  )
}

