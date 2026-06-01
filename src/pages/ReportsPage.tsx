import { useEffect, useState } from 'react'
import { useTenant } from '../context/TenantContext'
import { useAuth } from '../context/AuthContext'
import { formatEGP } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { Loader2, TrendingUp, ShoppingBag, DollarSign, Package, Building2 } from 'lucide-react'

type DateRange = 'today' | 'week' | 'month' | 'year' | 'custom'

function getRange(range: DateRange, customStart?: string, customEnd?: string) {
  const now = new Date()
  let start: Date
  let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  switch (range) {
    case 'today': start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break
    case 'week': start = new Date(now); start.setDate(now.getDate() - 7); break
    case 'month': start = new Date(now.getFullYear(), now.getMonth(), 1); break
    case 'year': start = new Date(now.getFullYear(), 0, 1); break
    case 'custom': start = customStart ? new Date(customStart) : new Date(now.getFullYear(), now.getMonth(), now.getDate()); end = customEnd ? new Date(customEnd + 'T23:59:59') : end; break
    default: start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }
  return { start: start.toISOString(), end: end.toISOString() }
}

interface ReportData {
  totalSales: number
  totalReturns: number
  totalOrders: number
  avgOrderValue: number
  totalExpenses: number
  totalOtherIncome: number
  netProfit: number
  paymobFees: number
  topProducts: { name: string; qty: number; revenue: number }[]
  salesByDay: { date: string; total: number }[]
  paymentBreakdown: { method: string; total: number }[]
}

const RANGE_LABELS: Record<DateRange, string> = {
  today: 'اليوم',
  week: 'أسبوع',
  month: 'شهر',
  year: 'سنة',
  custom: 'مخصص',
}

export default function ReportsPage() {
  const { tenant, branches, currentBranch, loading: tenantLoading } = useTenant()
  const { isAdmin } = useAuth()
  const [filterBranch, setFilterBranch] = useState<string | null>(null)
  const [range, setRange] = useState<DateRange>('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ReportData>({
    totalSales: 0, totalReturns: 0, totalOrders: 0, avgOrderValue: 0, totalExpenses: 0,
    totalOtherIncome: 0, netProfit: 0, paymobFees: 0, topProducts: [], salesByDay: [], paymentBreakdown: []
  })

  useEffect(() => {
    if (tenantLoading) return
    loadReport()
  }, [tenant, filterBranch, currentBranch, range, customStart, customEnd, tenantLoading])

  const loadReport = async () => {
    setLoading(true)
    const { start, end } = getRange(range, customStart, customEnd)
    const tenantId = tenant?.id
    const branchId = filterBranch || (!isAdmin ? currentBranch?.id : null)

    try {
      // Orders - with optional tenant filter
      let ordersQ = supabase.from('orders').select('id, total, payment_method, created_at, completed_at').gte('created_at', start).lte('created_at', end).eq('status', 'completed')
      if (tenantId) ordersQ = ordersQ.eq('tenant_id', tenantId)
      if (branchId) ordersQ = ordersQ.eq('branch_id', branchId)
      const { data: orders } = await ordersQ

      // Order items for top products
      const orderIds = (orders || []).map(o => o.id)
      let topProducts: ReportData['topProducts'] = []
      if (orderIds.length > 0) {
        const { data: items } = await supabase.from('order_items').select('product_name, quantity, line_total').in('order_id', orderIds.slice(0, 200))
        const prodMap = new Map<string, { qty: number; revenue: number }>()
        ;(items || []).forEach(i => {
          const p = prodMap.get(i.product_name) || { qty: 0, revenue: 0 }
          p.qty += i.quantity
          p.revenue += i.line_total
          prodMap.set(i.product_name, p)
        })
        topProducts = [...prodMap.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
      }

      // Sales by day
      const dayMap = new Map<string, number>()
      ;(orders || []).forEach(o => {
        const createdAt = o.created_at || o.completed_at
        if (!createdAt) return
        const d = createdAt.slice(0, 10)
        dayMap.set(d, (dayMap.get(d) || 0) + (o.total || 0))
      })
      const salesByDay = [...dayMap.entries()].map(([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date))

      // Payment breakdown
      const payMap = new Map<string, number>()
      ;(orders || []).forEach(o => {
        const m = o.payment_method || 'cash'
        payMap.set(m, (payMap.get(m) || 0) + (o.total || 0))
      })
      const paymentBreakdown = [...payMap.entries()].map(([method, total]) => ({ method, total }))

      // Expenses - filter soft-deleted, include branch-less
      let expQ = supabase.from('expenses').select('amount').is('deleted_at', null).gte('expense_date', start.slice(0, 10)).lte('expense_date', end.slice(0, 10))
      if (tenantId) expQ = expQ.eq('tenant_id', tenantId)
      if (branchId) expQ = expQ.or(`branch_id.eq.${branchId},branch_id.is.null`)
      const { data: expenses } = await expQ

      // Other income only (sales come from POS orders) - filter soft-deleted, include branch-less
      let incQ = supabase.from('income_entries').select('amount').is('deleted_at', null).neq('source', 'sales').gte('income_date', start.slice(0, 10)).lte('income_date', end.slice(0, 10))
      if (tenantId) incQ = incQ.eq('tenant_id', tenantId)
      if (branchId) incQ = incQ.or(`branch_id.eq.${branchId},branch_id.is.null`)
      const { data: incomes } = await incQ

      let returnsQ = supabase.from('returns').select('refund_amount, created_at').eq('status', 'completed').gte('created_at', start).lte('created_at', end)
      if (tenantId) returnsQ = returnsQ.eq('tenant_id', tenantId)
      if (orderIds.length > 0) returnsQ = returnsQ.in('order_id', orderIds)
      const { data: returnsRows } = await returnsQ

      // Paymob fees: 2.75% + 3 EGP per successful transaction (non-refundable)
      let paymobQ = supabase.from('paymob_transactions').select('amount_cents, status').in('status', ['paid', 'refunded', 'partially_refunded']).gte('created_at', start).lte('created_at', end)
      if (tenantId) paymobQ = paymobQ.eq('tenant_id', tenantId)
      const { data: paymobTxs } = await paymobQ
      const paymobFees = (paymobTxs || []).reduce((s, tx) => {
        const amountEGP = (tx.amount_cents || 0) / 100
        return s + (amountEGP * 0.0275) + 3
      }, 0)

      const totalSales = (orders || []).reduce((s, o) => s + (o.total || 0), 0)
      const totalReturns = (returnsRows || []).reduce((s, r: any) => s + Number(r.refund_amount || 0), 0)
      const netSales = Math.max(0, totalSales - totalReturns)
      const totalOrders = (orders || []).length
      // totalExpenses already includes returns (مرتجعات category) from the expense table
      const totalExpenses = (expenses || []).reduce((s, e) => s + (e.amount || 0), 0)
      const totalOtherIncome = (incomes || []).reduce((s, i) => s + (i.amount || 0), 0)
      const allExpenses = totalExpenses + paymobFees

      setData({
        totalSales: netSales,
        totalReturns,
        totalOrders,
        avgOrderValue: totalOrders > 0 ? netSales / totalOrders : 0,
        totalExpenses: allExpenses,
        totalOtherIncome,
        netProfit: netSales + totalOtherIncome - allExpenses,
        paymobFees,
        topProducts,
        salesByDay,
        paymentBreakdown,
      })
    } catch (e) {
      console.error('Report error:', e)
    } finally {
      setLoading(false)
    }
  }

  const payMethodLabel = (m: string) => {
    const map: Record<string, string> = { cash: 'نقدي', card: 'بطاقة', split: 'مقسم', link: 'رابط دفع', deferred: 'آجل' }
    return map[m] || m
  }

  const maxSaleDay = Math.max(...data.salesByDay.map(d => d.total), 1)

  return (
    <div className="space-y-6 slide-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-heading)' }}>التقارير</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>تحليل الأداء والمبيعات</p>
        </div>
        <div className="flex gap-1.5 flex-wrap items-center p-1 rounded-xl" style={{ background: 'var(--bg-input)' }}>
          {(['today', 'week', 'month', 'year'] as DateRange[]).map(r => (
            <button key={r} onClick={() => setRange(r)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200" style={{ background: range === r ? 'var(--bg-card)' : 'transparent', color: range === r ? 'var(--primary)' : 'var(--text-muted)', boxShadow: range === r ? '0 1px 3px rgba(0,0,0,0.15)' : 'none' }}>
              {RANGE_LABELS[r]}
            </button>
          ))}
          <button onClick={() => setRange('custom')} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200" style={{ background: range === 'custom' ? 'var(--bg-card)' : 'transparent', color: range === 'custom' ? 'var(--primary)' : 'var(--text-muted)', boxShadow: range === 'custom' ? '0 1px 3px rgba(0,0,0,0.15)' : 'none' }}>مخصص</button>
        </div>
      </div>

      {/* Branch filter */}
      {isAdmin && branches.length > 1 && (
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-input)' }}>
            <button onClick={() => setFilterBranch(null)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{ background: !filterBranch ? 'var(--bg-card)' : 'transparent', color: !filterBranch ? 'var(--primary)' : 'var(--text-muted)', boxShadow: !filterBranch ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              الكل
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

      {range === 'custom' && (
        <div className="flex gap-3">
          <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="px-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
          <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="px-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} />
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>جاري تحميل التقرير...</p>
          </div>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'صافي المبيعات', value: formatEGP(data.totalSales), icon: ShoppingBag, color: 'var(--primary)' },
              { label: 'الطلبات', value: data.totalOrders, icon: Package, color: '#3b82f6' },
              { label: 'متوسط الطلب', value: formatEGP(data.avgOrderValue), icon: TrendingUp, color: '#8b5cf6' },
              { label: 'الدخل الإضافي', value: formatEGP(data.totalOtherIncome), icon: DollarSign, color: '#0ea5e9' },
              { label: 'المصروفات', value: formatEGP(data.totalExpenses), sub: [data.totalReturns > 0 ? `مرتجعات ${formatEGP(data.totalReturns)}` : '', data.paymobFees > 0 ? `عمولة بوابات الدفع ${formatEGP(data.paymobFees)}` : ''].filter(Boolean).join(' · ') || undefined, icon: DollarSign, color: '#ef4444' },
              { label: 'صافي النشاط', value: formatEGP(data.netProfit), icon: TrendingUp, color: data.netProfit >= 0 ? '#10b981' : '#ef4444' },
            ].map((kpi, i) => (
              <div key={i} className="p-4 rounded-2xl border transition-all duration-200 hover:shadow-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: kpi.color + '1a' }}>
                    <kpi.icon className="w-3.5 h-3.5" style={{ color: kpi.color }} />
                  </div>
                  <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{kpi.label}</span>
                </div>
                <p className="text-lg font-black tabular-nums" style={{ color: kpi.color }}>{kpi.value}</p>
                {kpi.sub && <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{kpi.sub}</p>}
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Sales chart (bar) */}
            <div className="p-5 rounded-2xl border shadow-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
              <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-heading)' }}>المبيعات اليومية</h3>
              {data.salesByDay.length > 0 ? (
                <div className="space-y-2">
                  {data.salesByDay.map(d => (
                    <div key={d.date} className="flex items-center gap-2">
                      <span className="text-[10px] w-16 text-left" style={{ color: 'var(--text-muted)' }}>{new Date(d.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}</span>
                      <div className="flex-1 h-5 rounded-lg overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                        <div className="h-full rounded-lg transition-all duration-500" style={{ width: `${(d.total / maxSaleDay) * 100}%`, background: 'var(--primary)' }} />
                      </div>
                      <span className="text-[10px] w-20 text-right font-bold" style={{ color: 'var(--text-heading)' }}>{formatEGP(d.total)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>لا توجد بيانات</p>}
            </div>

            {/* Top products */}
            <div className="p-5 rounded-2xl border shadow-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
              <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-heading)' }}>أعلى المنتجات مبيعاً</h3>
              {data.topProducts.length > 0 ? (
                <div className="space-y-3">
                  {data.topProducts.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate" style={{ color: 'var(--text-heading)' }}>{p.name}</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.qty} مبيع</p>
                      </div>
                      <span className="text-xs font-bold" style={{ color: 'var(--text-heading)' }}>{formatEGP(p.revenue)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>لا توجد بيانات</p>}
            </div>
          </div>

          {/* Payment breakdown */}
          {data.paymentBreakdown.length > 0 && (
            <div className="p-5 rounded-2xl border shadow-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
              <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-heading)' }}>طرق الدفع</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {data.paymentBreakdown.map(p => (
                  <div key={p.method} className="p-4 rounded-xl text-center transition-all duration-200 hover:shadow-sm" style={{ background: 'var(--bg-input)' }}>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{payMethodLabel(p.method)}</p>
                    <p className="text-lg font-black tabular-nums" style={{ color: 'var(--text-heading)' }}>{formatEGP(p.total)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
