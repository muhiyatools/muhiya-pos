import { useState } from 'react'
import { useActivityLog } from '../hooks/useSaasData'
import { useTenant } from '../context/TenantContext'
import { Activity, Loader2, Search, Clock } from 'lucide-react'

const actionLabels: Record<string, string> = {
  login: 'تسجيل دخول',
  logout: 'تسجيل خروج',
  create_order: 'إنشاء طلب',
  void_order: 'إلغاء طلب',
  create_product: 'إضافة منتج',
  update_product: 'تحديث منتج',
  delete_product: 'حذف منتج',
  create_category: 'إضافة تصنيف',
  open_shift: 'فتح وردية',
  close_shift: 'إغلاق وردية',
  create_return: 'إنشاء مرتجع',
  create_transfer: 'إنشاء تحويل',
  create_po: 'إنشاء أمر شراء',
  supplier_payment: 'دفع مورد',
  update_settings: 'تحديث الإعدادات',
}

const actionColors: Record<string, string> = {
  login: '#3b82f6',
  logout: '#6b7280',
  create_order: '#10b981',
  void_order: '#ef4444',
  create_return: '#f59e0b',
  open_shift: '#8b5cf6',
  close_shift: '#6b7280',
  delete_product: '#ef4444',
}

export default function ActivityLogPage() {
  const { tenant } = useTenant()
  const { logs, loading } = useActivityLog(tenant?.id)
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('')

  const filtered = logs.filter(l => {
    if (search && !JSON.stringify(l).toLowerCase().includes(search.toLowerCase())) return false
    if (filterAction && l.action !== filterAction) return false
    return true
  })

  const uniqueActions = [...new Set(logs.map(l => l.action))]

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} /></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black" style={{ color: 'var(--text-heading)' }}>سجل النشاطات</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>متابعة جميع العمليات والإجراءات</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..." className="w-full pr-10 pl-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
        </div>
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)} className="px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
          <option value="">كل الإجراءات</option>
          {uniqueActions.map(a => <option key={a} value={a}>{actionLabels[a] || a}</option>)}
        </select>
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute right-5 top-0 bottom-0 w-0.5" style={{ background: 'var(--border-light)' }} />
        <div className="space-y-1">
          {filtered.map(log => {
            const color = actionColors[log.action] || 'var(--primary)'
            return (
              <div key={log.id} className="flex gap-4 pr-2 py-2">
                <div className="relative z-10 w-10 min-w-[2.5rem] flex items-start justify-center pt-1">
                  <div className="w-3 h-3 rounded-full border-2" style={{ background: color, borderColor: 'var(--bg-card)' }} />
                </div>
                <div className="flex-1 p-3 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold" style={{ background: color + '1a', color }}>{actionLabels[log.action] || log.action}</span>
                      {log.entity_type && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{log.entity_type}</span>}
                    </div>
                    <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <Clock className="w-3 h-3" />
                      {new Date(log.created_at).toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {log.details && (
                    <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                      {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 opacity-50">
          <Activity className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>لا توجد نشاطات</p>
        </div>
      )}
    </div>
  )
}
