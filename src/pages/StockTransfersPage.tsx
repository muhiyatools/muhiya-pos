import { useState } from 'react'
import { useStockTransfers, useWarehouses } from '../hooks/useSaasData'
import { useProducts } from '../hooks/useData'
import { useTenant } from '../context/TenantContext'
import { useToast } from '../context/ToastContext'
import { Plus, ArrowRightLeft, Check, Loader2, X, Package } from 'lucide-react'

export default function StockTransfersPage() {
  const { tenant } = useTenant()
  const { transfers, loading, create, complete } = useStockTransfers(tenant?.id)
  const { warehouses } = useWarehouses(tenant?.id)
  const { products } = useProducts()
  const toast = useToast()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ from_warehouse_id: '', to_warehouse_id: '', product_id: '', quantity: 1, notes: '' })
  const [productSearch, setProductSearch] = useState('')

  const filteredProducts = products.filter(p =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.barcode?.includes(productSearch)
  ).slice(0, 20)

  const getWarehouseName = (id: string) => warehouses.find(w => w.id === id)?.name || 'مخزن'
  const getProductName = (id: string) => products.find(p => p.id === id)?.name || '—'

  const handleSubmit = async () => {
    if (!form.from_warehouse_id || !form.to_warehouse_id || !form.product_id || form.quantity <= 0 || !tenant) {
      toast.error('يرجى ملء جميع الحقول المطلوبة')
      return
    }
    if (form.from_warehouse_id === form.to_warehouse_id) {
      toast.error('لا يمكن التحويل لنفس المخزن')
      return
    }
    await create({
      tenant_id: tenant.id,
      from_warehouse_id: form.from_warehouse_id,
      to_warehouse_id: form.to_warehouse_id,
      product_id: form.product_id,
      quantity: form.quantity,
      notes: form.notes || null,
      status: 'pending',
    })
    toast.success('تم إنشاء التحويل بنجاح')
    setForm({ from_warehouse_id: '', to_warehouse_id: '', product_id: '', quantity: 1, notes: '' })
    setProductSearch('')
    setShowForm(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-heading)' }}>تحويلات المخزون</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>نقل المنتجات بين المخازن</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
          <Plus className="w-4 h-4" />تحويل جديد
        </button>
      </div>

      <div className="space-y-3">
        {transfers.map(t => (
          <div key={t.id} className="p-4 rounded-2xl border flex items-center justify-between" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: t.status === 'completed' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)' }}>
                <ArrowRightLeft className="w-5 h-5" style={{ color: t.status === 'completed' ? '#10b981' : '#f59e0b' }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
                  {getWarehouseName(t.from_warehouse_id)} → {getWarehouseName(t.to_warehouse_id)}
                </p>
                <p className="text-xs font-medium" style={{ color: 'var(--text-main)' }}>
                  {getProductName(t.product_id)} × {t.quantity}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(t.created_at).toLocaleDateString('ar-EG')}</p>
                {t.notes && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t.notes}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded-lg text-[10px] font-bold" style={{
                background: t.status === 'completed' ? 'rgba(16,185,129,0.1)' : t.status === 'in_transit' ? 'rgba(59,130,246,0.1)' : 'rgba(245,158,11,0.1)',
                color: t.status === 'completed' ? '#10b981' : t.status === 'in_transit' ? '#3b82f6' : '#f59e0b',
              }}>
                {t.status === 'completed' ? 'مكتمل' : t.status === 'in_transit' ? 'في الطريق' : 'معلق'}
              </span>
              {t.status !== 'completed' && (
                <button onClick={() => complete(t.id)} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'var(--success)', color: '#fff' }}>
                  <Check className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {transfers.length === 0 && (
        <div className="text-center py-16 opacity-50">
          <ArrowRightLeft className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>لا توجد تحويلات</p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="p-6 rounded-2xl shadow-2xl max-w-md w-full" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black" style={{ color: 'var(--text-heading)' }}>تحويل مخزون جديد</h3>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <select value={form.from_warehouse_id} onChange={e => setForm({ ...form, from_warehouse_id: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
                <option value="">من مخزن *</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <select value={form.to_warehouse_id} onChange={e => setForm({ ...form, to_warehouse_id: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
                <option value="">إلى مخزن *</option>
                {warehouses.filter(w => w.id !== form.from_warehouse_id).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>

              {/* Product search & select */}
              <div>
                <input value={productSearch} onChange={e => { setProductSearch(e.target.value); if (form.product_id) setForm({ ...form, product_id: '' }) }} placeholder="ابحث عن منتج بالاسم أو الباركود *" className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                {productSearch && !form.product_id && (
                  <div className="mt-1 max-h-40 overflow-y-auto rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                    {filteredProducts.map(p => (
                      <button key={p.id} onClick={() => { setForm({ ...form, product_id: p.id }); setProductSearch(p.name) }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-right hover:opacity-80 transition-opacity"
                        style={{ color: 'var(--text-main)' }}>
                        <Package className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                        <span>{p.name}</span>
                        {p.stock != null && <span className="mr-auto text-xs" style={{ color: 'var(--text-muted)' }}>({p.stock})</span>}
                      </button>
                    ))}
                    {filteredProducts.length === 0 && <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>لا توجد نتائج</p>}
                  </div>
                )}
              </div>

              <input type="number" min={1} value={form.quantity} onChange={e => setForm({ ...form, quantity: Math.max(1, Number(e.target.value)) })} placeholder="الكمية *" className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />

              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="ملاحظات" rows={2} className="w-full px-3 py-2.5 rounded-xl border text-sm resize-none" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>إلغاء</button>
              <button onClick={handleSubmit} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>إنشاء التحويل</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
