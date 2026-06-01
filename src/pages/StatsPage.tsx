import { useStats, useIncome, useExpenses } from '../hooks/useData'
import { formatEGP } from '../lib/utils'
import { TrendingUp, TrendingDown, DollarSign, Loader2 } from 'lucide-react'

export default function StatsPage() {
  const { stats, loading } = useStats()
  const { entries: incomeEntries } = useIncome()
  const { expenses } = useExpenses()
  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} /></div>

  const netProfit = stats.netProfit
  const profitMargin = stats.totalRevenue > 0 ? Math.round((netProfit / stats.totalRevenue) * 100) : 0

  // Other income by source
  const bySource: Record<string, number> = {}
  incomeEntries.filter(e => e.source !== 'sales').forEach(e => { bySource[e.source] = (bySource[e.source] || 0) + e.amount })

  // Expenses by category
  const byCategory: Record<string, number> = {}
  expenses.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount })

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-black" style={{ color: 'var(--text-heading)' }}>الإحصائيات</h1>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-5 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4" style={{ color: '#10b981' }} /><p className="text-xs" style={{ color: 'var(--text-muted)' }}>إجمالي المبيعات</p></div>
          <p className="text-xl font-black" style={{ color: '#10b981' }}>{formatEGP(stats.totalRevenue)}</p>
        </div>
        <div className="p-5 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4" style={{ color: '#0ea5e9' }} /><p className="text-xs" style={{ color: 'var(--text-muted)' }}>الدخل الإضافي</p></div>
          <p className="text-xl font-black" style={{ color: '#0ea5e9' }}>{formatEGP(stats.totalOtherIncome || 0)}</p>
        </div>
        <div className="p-5 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          <div className="flex items-center gap-2 mb-2"><TrendingDown className="w-4 h-4" style={{ color: '#ef4444' }} /><p className="text-xs" style={{ color: 'var(--text-muted)' }}>إجمالي المصروفات</p></div>
          <p className="text-xl font-black" style={{ color: '#ef4444' }}>{formatEGP(stats.totalExpenses)}</p>
        </div>
        <div className="p-5 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          <div className="flex items-center gap-2 mb-2"><DollarSign className="w-4 h-4" style={{ color: netProfit >= 0 ? '#10b981' : '#ef4444' }} /><p className="text-xs" style={{ color: 'var(--text-muted)' }}>صافي النشاط</p></div>
          <p className="text-xl font-black" style={{ color: netProfit >= 0 ? '#10b981' : '#ef4444' }}>{formatEGP(netProfit)}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>هامش النشاط: {profitMargin}%</p>
        </div>
        <div className="p-5 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          <div className="flex items-center gap-2 mb-2"><DollarSign className="w-4 h-4" style={{ color: '#f59e0b' }} /><p className="text-xs" style={{ color: 'var(--text-muted)' }}>مبيعات اليوم</p></div>
          <p className="text-xl font-black" style={{ color: '#f59e0b' }}>{formatEGP(stats.todayRevenue)}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{stats.todayOrders} طلب</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Income by Source */}
        <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-heading)' }}>الدخل الإضافي حسب المصدر</h3>
          <div className="space-y-3">
            {Object.entries(bySource).sort((a, b) => b[1] - a[1]).map(([source, amount]) => {
              const pct = (stats.totalOtherIncome || 0) > 0 ? Math.round((amount / (stats.totalOtherIncome || 1)) * 100) : 0
              return (
                <div key={source}>
                  <div className="flex items-center justify-between text-sm mb-1"><span style={{ color: 'var(--text-main)' }}>{source === 'manual' ? 'يدوي' : source}</span><span className="font-bold" style={{ color: 'var(--text-heading)' }}>{formatEGP(amount)} ({pct}%)</span></div>
                  <div className="w-full h-2 rounded-full" style={{ background: 'var(--border-light)' }}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#10b981' }} /></div>
                </div>
              )
            })}
            {Object.keys(bySource).length === 0 && <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>لا يوجد بيانات</p>}
          </div>
        </div>

        {/* Expenses by Category */}
        <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-heading)' }}>المصروفات حسب التصنيف</h3>
          <div className="space-y-3">
            {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => {
              const pct = stats.totalExpenses > 0 ? Math.round((amount / stats.totalExpenses) * 100) : 0
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between text-sm mb-1"><span style={{ color: 'var(--text-main)' }}>{cat}</span><span className="font-bold" style={{ color: 'var(--text-heading)' }}>{formatEGP(amount)} ({pct}%)</span></div>
                  <div className="w-full h-2 rounded-full" style={{ background: 'var(--border-light)' }}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#ef4444' }} /></div>
                </div>
              )
            })}
            {Object.keys(byCategory).length === 0 && <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>لا يوجد بيانات</p>}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>المنتجات</p><p className="text-lg font-black" style={{ color: 'var(--text-heading)' }}>{stats.totalProducts}</p>
        </div>
        <div className="p-4 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>العملاء</p><p className="text-lg font-black" style={{ color: 'var(--text-heading)' }}>{stats.totalCustomers}</p>
        </div>
        <div className="p-4 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الطلبات</p><p className="text-lg font-black" style={{ color: 'var(--text-heading)' }}>{stats.totalOrders}</p>
        </div>
        <div className="p-4 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>طلبات اليوم</p><p className="text-lg font-black" style={{ color: 'var(--text-heading)' }}>{stats.todayOrders}</p>
        </div>
      </div>
    </div>
  )
}
