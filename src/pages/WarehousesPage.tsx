import { useState } from 'react'
import { useToast } from '../context/ToastContext'
import { useWarehouses, useBranches } from '../hooks/useSaasData'
import { useTenant } from '../context/TenantContext'
import { Plus, Edit2, Warehouse, MapPin, Loader2, X } from 'lucide-react'

export default function WarehousesPage() {
  const { tenant } = useTenant()
  const { warehouses, loading, add, update } = useWarehouses(tenant?.id)
  const { branches } = useBranches(tenant?.id)
  const toast = useToast()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', branch_id: '', address: '', type: 'main' })

  const handleSubmit = async () => {
    if (!form.name.trim() || !tenant) return
    if (editId) {
      await update(editId, form)
      toast.success('تم تحديث بيانات المخزن')
    } else {
      await add({ ...form, tenant_id: tenant.id, is_active: true })
      toast.success('تمت إضافة المخزن')
    }
    setForm({ name: '', branch_id: '', address: '', type: 'main' })
    setShowForm(false)
    setEditId(null)
  }

  const startEdit = (w: any) => {
    setEditId(w.id)
    setForm({ name: w.name, branch_id: w.branch_id || '', address: w.address || '', type: w.type || 'main' })
    setShowForm(true)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-heading)' }}>المخازن</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>إدارة المخازن والمستودعات</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ name: '', branch_id: '', address: '', type: 'main' }) }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
          <Plus className="w-4 h-4" />إضافة مخزن
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {warehouses.map(w => (
          <div key={w.id} className="p-5 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-input)' }}>
                  <Warehouse className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{w.name}</h3>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{w.type === 'main' ? 'رئيسي' : w.type === 'cold' ? 'تبريد' : w.type === 'raw' ? 'خامات' : w.type}</span>
                </div>
              </div>
              <button onClick={() => startEdit(w)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}><Edit2 className="w-3.5 h-3.5" /></button>
            </div>
            {w.branch && <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الفرع: {w.branch.name}</p>}
            {w.address && <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}><MapPin className="w-3 h-3" />{w.address}</p>}
          </div>
        ))}
      </div>

      {warehouses.length === 0 && (
        <div className="text-center py-16 opacity-50">
          <Warehouse className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>لا توجد مخازن بعد</p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="p-6 rounded-2xl shadow-2xl max-w-md w-full" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black" style={{ color: 'var(--text-heading)' }}>{editId ? 'تعديل المخزن' : 'مخزن جديد'}</h3>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="اسم المخزن *" className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
              <select value={form.branch_id} onChange={e => setForm({ ...form, branch_id: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
                <option value="">اختر الفرع</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
                <option value="main">رئيسي</option>
                <option value="cold">تبريد</option>
                <option value="raw">خامات</option>
                <option value="other">أخرى</option>
              </select>
              <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="العنوان" className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>إلغاء</button>
              <button onClick={handleSubmit} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>{editId ? 'تحديث' : 'إضافة'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
