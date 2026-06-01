import { useState } from 'react'
import { usePurchaseOrders, useSuppliers } from '../hooks/useSaasData'
import { useProducts } from '../hooks/useData'
import { useTenant } from '../context/TenantContext'
import { useToast } from '../context/ToastContext'
import { formatEGP } from '../lib/utils'
import { Plus, FileText, Loader2, X, Trash2, Package, Search } from 'lucide-react'

type POItem = { product_id: string; product_name: string; quantity: number; unit_cost: number; line_total: number }

export default function PurchaseOrdersPage() {
  const { tenant } = useTenant()
  const { orders, loading, create } = usePurchaseOrders(tenant?.id)
  const { suppliers } = useSuppliers(tenant?.id)
  const { products } = useProducts()
  const toast = useToast()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ supplier_id: '', notes: '', expected_date: '' })
  const [items, setItems] = useState<POItem[]>([])
  const [productSearch, setProductSearch] = useState('')

  const filteredProducts = products.filter(p =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.barcode?.includes(productSearch)
  ).slice(0, 15)

  const addItem = (p: typeof products[0]) => {
    if (items.find(i => i.product_id === p.id)) { toast.warning('المنتج مضاف بالفعل'); return }
    setItems(prev => [...prev, { product_id: p.id, product_name: p.name, quantity: 1, unit_cost: 0, line_total: 0 }])
    setProductSearch('')
  }

  const updateItem = (idx: number, field: keyof POItem, value: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: value }
      updated.line_total = updated.quantity * updated.unit_cost
      return updated
    }))
  }

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const totalAmount = items.reduce((s, i) => s + i.line_total, 0)

  const handleSubmit = async () => {
    if (!form.supplier_id || !tenant) { toast.error('اختر المورد'); return }
    if (items.length === 0) { toast.error('أضف منتجات للأمر'); return }
    const supplier = suppliers.find(s => s.id === form.supplier_id)
    await create({
      tenant_id: tenant.id,
      supplier_id: form.supplier_id,
      supplier_name: supplier?.name || '',
      status: 'draft',
      notes: form.notes || null,
      expected_date: form.expected_date || null,
      total_amount: totalAmount,
    }, items)
    toast.success('تم إنشاء أمر الشراء')
    setForm({ supplier_id: '', notes: '', expected_date: '' })
    setItems([])
    setShowForm(false)
  }

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { draft: 'مسودة', sent: 'مرسل', received: 'مستلم', cancelled: 'ملغي' }
    return map[s] || s
  }

  const statusColor = (s: string) => {
    const map: Record<string, { bg: string; color: string }> = {
      draft: { bg: 'rgba(107,114,128,0.1)', color: '#6b7280' },
      sent: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' },
      received: { bg: 'rgba(16,185,129,0.1)', color: '#10b981' },
      cancelled: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
    }
    return map[s] || map.draft
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-heading)' }}>أوامر الشراء</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>إدارة أوامر الشراء من الموردين</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
          <Plus className="w-4 h-4" />أمر شراء جديد
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي الأوامر', value: orders.length, color: 'var(--primary)' },
          { label: 'مسودة', value: orders.filter(o => o.status === 'draft').length, color: '#6b7280' },
          { label: 'مرسل', value: orders.filter(o => o.status === 'sent').length, color: '#3b82f6' },
          { label: 'مستلم', value: orders.filter(o => o.status === 'received').length, color: '#10b981' },
        ].map((card, i) => (
          <div key={i} className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{card.label}</p>
            <p className="text-2xl font-black mt-1" style={{ color: card.color }}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {orders.map(o => {
          const sc = statusColor(o.status)
          return (
            <div key={o.id} className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: sc.bg }}>
                    <FileText className="w-5 h-5" style={{ color: sc.color }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{o.po_ref}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{o.supplier_name} — {new Date(o.created_at).toLocaleDateString('ar-EG')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{formatEGP(o.total_amount || 0)}</span>
                  <span className="px-2 py-1 rounded-lg text-[10px] font-bold" style={{ background: sc.bg, color: sc.color }}>{statusLabel(o.status)}</span>
                </div>
              </div>
              {o.notes && <p className="text-xs mt-2 pr-14" style={{ color: 'var(--text-muted)' }}>{o.notes}</p>}
            </div>
          )
        })}
      </div>

      {orders.length === 0 && (
        <div className="text-center py-16 opacity-50">
          <FileText className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>لا توجد أوامر شراء</p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" style={{ background: 'var(--bg-card)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-light)' }}>
              <h3 className="text-lg font-black" style={{ color: 'var(--text-heading)' }}>أمر شراء جديد</h3>
              <button onClick={() => { setShowForm(false); setItems([]) }} style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
            </div>

            {/* Body — scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Basic info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>المورد *</label>
                  <select value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
                    <option value="">اختر المورد</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>تاريخ التوريد المتوقع</label>
                  <input type="date" value={form.expected_date} onChange={e => setForm({ ...form, expected_date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                </div>
              </div>

              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="ملاحظات" rows={2} className="w-full px-3 py-2.5 rounded-xl border text-sm resize-none" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />

              {/* Product search */}
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>إضافة منتجات</label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <input value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="ابحث بالاسم أو الباركود..." className="w-full pr-10 pl-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                </div>
                {productSearch && (
                  <div className="mt-1 max-h-36 overflow-y-auto rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                    {filteredProducts.map(p => (
                      <button key={p.id} onClick={() => addItem(p)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-right hover:opacity-80 transition" style={{ color: 'var(--text-main)' }}>
                        <Package className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                        <span className="truncate">{p.name}</span>
                        {p.barcode && <span className="mr-auto text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{p.barcode}</span>}
                      </button>
                    ))}
                    {filteredProducts.length === 0 && <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>لا توجد نتائج</p>}
                  </div>
                )}
              </div>

              {/* Items table */}
              {items.length > 0 && (
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-light)' }}>
                  <table className="w-full text-right text-sm">
                    <thead>
                      <tr style={{ background: 'var(--bg-input)' }}>
                        <th className="px-3 py-2 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>المنتج</th>
                        <th className="px-3 py-2 text-xs font-bold w-24" style={{ color: 'var(--text-muted)' }}>الكمية</th>
                        <th className="px-3 py-2 text-xs font-bold w-28" style={{ color: 'var(--text-muted)' }}>سعر الوحدة</th>
                        <th className="px-3 py-2 text-xs font-bold w-24" style={{ color: 'var(--text-muted)' }}>الإجمالي</th>
                        <th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={idx} className="border-t" style={{ borderColor: 'var(--border-light)' }}>
                          <td className="px-3 py-2">
                            <p className="text-xs font-bold truncate" style={{ color: 'var(--text-heading)' }}>{item.product_name}</p>
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min={1} value={item.quantity} onChange={e => updateItem(idx, 'quantity', Math.max(1, +e.target.value))} className="w-full px-2 py-1 rounded-lg border text-xs text-center" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min={0} step={0.01} value={item.unit_cost} onChange={e => updateItem(idx, 'unit_cost', Math.max(0, +e.target.value))} className="w-full px-2 py-1 rounded-lg border text-xs text-center" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                          </td>
                          <td className="px-3 py-2 text-xs font-bold" style={{ color: 'var(--primary)' }}>{formatEGP(item.line_total)}</td>
                          <td className="px-3 py-2">
                            <button onClick={() => removeItem(idx)} className="p-1 rounded" style={{ color: '#ef4444' }}><Trash2 className="w-3.5 h-3.5" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {items.length === 0 && (
                <div className="text-center py-6 rounded-xl border border-dashed opacity-50" style={{ borderColor: 'var(--border)' }}>
                  <Package className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>ابحث عن منتج لإضافته</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t" style={{ borderColor: 'var(--border-light)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>الإجمالي</span>
                <span className="text-lg font-black" style={{ color: 'var(--primary)' }}>{formatEGP(totalAmount)}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowForm(false); setItems([]) }} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>إلغاء</button>
                <button onClick={handleSubmit} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>إنشاء أمر الشراء</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
