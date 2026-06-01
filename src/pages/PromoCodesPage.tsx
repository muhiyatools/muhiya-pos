import { useState } from 'react'
import { useToast } from '../context/ToastContext'
import { usePromoCodes } from '../hooks/useSaasData'
import { useTenant } from '../context/TenantContext'
import { formatEGP } from '../lib/utils'
import { Tag, Plus, Loader2, X, Trash2, Edit3, Check, Copy } from 'lucide-react'

export default function PromoCodesPage() {
  const { tenant } = useTenant()
  const { codes: promos, loading, add: create, update, remove } = usePromoCodes(tenant?.id)
  const toast = useToast()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const emptyForm = { code: '', discount_type: 'percent' as const, discount_value: '', min_order_amount: '', max_uses: '', valid_from: '', valid_until: '' }
  const [form, setForm] = useState(emptyForm)

  const openEdit = (p: any) => {
    setEditId(p.id)
    setForm({
      code: p.code,
      discount_type: p.discount_type,
      discount_value: String(p.discount_value),
      min_order_amount: p.min_order_amount ? String(p.min_order_amount) : '',
      max_uses: p.max_uses ? String(p.max_uses) : '',
      valid_from: p.valid_from ? p.valid_from.slice(0, 10) : '',
      valid_until: p.valid_until ? p.valid_until.slice(0, 10) : '',
    })
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!form.code || !form.discount_value || !tenant) return
    const data = {
      tenant_id: tenant.id,
      code: form.code.toUpperCase(),
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      min_order_amount: form.min_order_amount ? parseFloat(form.min_order_amount) : null,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      valid_from: form.valid_from || null,
      valid_until: form.valid_until || null,
      is_active: true,
    }
    if (editId) {
      const { error } = await update(editId, data)
      if (error) { toast.error('فشل تحديث الكود'); return }
      toast.success('تم تحديث الكود')
    } else {
      const { error } = await create(data as any)
      if (error) { toast.error('فشل إنشاء الكود: ' + (error.message || 'خطأ غير معروف')); return }
      toast.success('تم إنشاء كود الخصم')
    }
    setForm(emptyForm)
    setEditId(null)
    setShowForm(false)
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 1500)
  }

  const isExpired = (p: any) => p.valid_until && new Date(p.valid_until) < new Date()
  const isMaxed = (p: any) => p.max_uses && (p.used_count || 0) >= p.max_uses

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-heading)' }}>أكواد الخصم</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>إدارة أكواد الخصم والعروض</p>
        </div>
        <button onClick={() => { setEditId(null); setForm(emptyForm); setShowForm(true) }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
          <Plus className="w-4 h-4" />كود جديد
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {promos.map(p => {
          const expired = isExpired(p)
          const maxed = isMaxed(p)
          const active = p.is_active && !expired && !maxed
          return (
            <div key={p.id} className="p-4 rounded-2xl border transition-all" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)', opacity: active ? 1 : 0.6 }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: active ? 'rgba(16,185,129,0.1)' : 'rgba(107,114,128,0.1)' }}>
                    <Tag className="w-5 h-5" style={{ color: active ? '#10b981' : '#6b7280' }} />
                  </div>
                  <div>
                    <button onClick={() => copyCode(p.code)} className="flex items-center gap-1 text-sm font-mono font-black" style={{ color: 'var(--text-heading)' }}>
                      {p.code}
                      {copied === p.code ? <Check className="w-3 h-3" style={{ color: '#10b981' }} /> : <Copy className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />}
                    </button>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {p.discount_type === 'percent' ? `${p.discount_value}%` : formatEGP(p.discount_value)} خصم
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}><Edit3 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => remove(p.id)} className="p-1.5 rounded-lg" style={{ color: '#ef4444' }}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              <div className="space-y-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                {p.min_order_amount > 0 && <p>الحد الأدنى للطلب: {formatEGP(p.min_order_amount)}</p>}
                {p.max_uses && <p>الاستخدامات: {p.used_count || 0} / {p.max_uses}</p>}
                {p.valid_from && <p>من: {new Date(p.valid_from).toLocaleDateString('ar-EG')}</p>}
                {p.valid_until && <p>إلى: {new Date(p.valid_until).toLocaleDateString('ar-EG')}</p>}
              </div>

              <div className="mt-3 flex gap-2">
                {!p.is_active && <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: 'rgba(107,114,128,0.1)', color: '#6b7280' }}>معطل</span>}
                {expired && <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>منتهي</span>}
                {maxed && <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>مستنفد</span>}
                {active && <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>فعال</span>}
              </div>
            </div>
          )
        })}
      </div>

      {promos.length === 0 && (
        <div className="text-center py-16 opacity-50">
          <Tag className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>لا توجد أكواد خصم</p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="p-6 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black" style={{ color: 'var(--text-heading)' }}>{editId ? 'تعديل الكود' : 'كود خصم جديد'}</h3>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="الكود (مثال: SALE20) *" className="w-full px-3 py-2.5 rounded-xl border text-sm font-mono" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value as any })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
                  <option value="percent">نسبة مئوية %</option>
                  <option value="flat">مبلغ ثابت</option>
                </select>
                <input type="number" value={form.discount_value} onChange={e => setForm({ ...form, discount_value: e.target.value })} placeholder={form.discount_type === 'percent' ? 'النسبة *' : 'المبلغ *'} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" value={form.min_order_amount} onChange={e => setForm({ ...form, min_order_amount: e.target.value })} placeholder="حد أدنى للطلب" className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                <input type="number" value={form.max_uses} onChange={e => setForm({ ...form, max_uses: e.target.value })} placeholder="أقصى استخدامات" className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] mb-1 block" style={{ color: 'var(--text-muted)' }}>صالح من</label>
                  <input type="date" value={form.valid_from} onChange={e => setForm({ ...form, valid_from: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                </div>
                <div>
                  <label className="text-[10px] mb-1 block" style={{ color: 'var(--text-muted)' }}>صالح حتى</label>
                  <input type="date" value={form.valid_until} onChange={e => setForm({ ...form, valid_until: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>إلغاء</button>
              <button onClick={handleSubmit} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>{editId ? 'حفظ' : 'إنشاء'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
