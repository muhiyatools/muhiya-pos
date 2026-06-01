import { useState } from 'react'
import { useToast } from '../context/ToastContext'
import { useSuppliers, useSupplierPayments, usePurchaseOrders, useBranches, useWarehouses } from '../hooks/useSaasData'
import { useProducts } from '../hooks/useData'
import { useTenant } from '../context/TenantContext'
import { useExpenses } from '../hooks/useData'
import { formatEGP } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { Plus, User, Phone, Mail, FileText, Loader2, X, Trash2, Edit3, Check } from 'lucide-react'

type Tab = 'suppliers' | 'purchase-orders'

export default function SuppliersPage() {
  const { tenant } = useTenant()
  const { suppliers, loading, add: create, update, remove } = useSuppliers(tenant?.id)
  const { orders: purchaseOrders, loading: poLoading, create: createPO, updateStatus } = usePurchaseOrders(tenant?.id)
  const { products } = useProducts()
  const { branches } = useBranches(tenant?.id)
  const { warehouses } = useWarehouses(tenant?.id)
  const { add: addExpense } = useExpenses()
  const toast = useToast()

  const [tab, setTab] = useState<Tab>('suppliers')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', contact_name: '', phone: '', email: '', address: '' })
  const [poForm, setPoForm] = useState({ supplier_id: '', notes: '', expected_date: '', branch_id: '', warehouse_id: '' })
  const [poItems, setPoItems] = useState<{ product_id: string; product_name: string; quantity: number; unit_price: number }[]>([{ product_id: '', product_name: '', quantity: 1, unit_price: 0 }])
  const [processing, setProcessing] = useState(false)
  const [showReceiveModal, setShowReceiveModal] = useState<any>(null)
  const [receiveBranch, setReceiveBranch] = useState('')
  const [receiveWarehouse, setReceiveWarehouse] = useState('')
  const emptyForm = { name: '', contact_name: '', phone: '', email: '', address: '' }

  const openEdit = (s: any) => {
    setEditId(s.id)
    setForm({ name: s.name, contact_name: s.contact_name || '', phone: s.phone || '', email: s.email || '', address: s.address || '' })
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!form.name || !tenant) return
    setProcessing(true)
    const payload = {
      tenant_id: tenant.id,
      name: form.name,
      contact_name: form.contact_name || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
    }
    if (editId) {
      const { error } = await update(editId, payload)
      if (error) { toast.error('فشل تحديث بيانات المورد: ' + (error.message || 'خطأ')); setProcessing(false); return }
      toast.success('تم تحديث بيانات المورد')
    } else {
      const { error } = await create(payload)
      if (error) { toast.error('فشل حفظ المورد: ' + (error.message || 'خطأ')); setProcessing(false); return }
      toast.success('تمت إضافة المورد')
    }
    setForm(emptyForm); setEditId(null); setShowForm(false); setProcessing(false)
  }

  const handleCreatePO = async () => {
    if (!poForm.supplier_id || !tenant) return
    if (!poForm.branch_id || !poForm.warehouse_id) return toast.warning('اختر الفرع والمخزن')
    const validItems = poItems.filter(i => i.product_id && i.quantity > 0 && i.unit_price >= 0)
    if (validItems.length === 0) return toast.warning('أضف منتجاً واحداً على الأقل')
    setProcessing(true)
    const supplier = suppliers.find(s => s.id === poForm.supplier_id)
    const totalAmount = validItems.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0)
    const items = validItems.map(i => ({ product_id: i.product_id, product_name: i.product_name, quantity: i.quantity, unit_price: i.unit_price, line_total: i.quantity * i.unit_price }))
    const { error } = await createPO({
      tenant_id: tenant.id, supplier_id: poForm.supplier_id, supplier_name: supplier?.name || '',
      total_amount: totalAmount, status: 'draft',
      notes: poForm.notes || null, expected_date: poForm.expected_date || null,
      branch_id: poForm.branch_id, warehouse_id: poForm.warehouse_id,
    }, items)
    if (error) { toast.error('فشل إنشاء أمر الشراء'); setProcessing(false); return }
    setPoForm({ supplier_id: '', notes: '', expected_date: '', branch_id: '', warehouse_id: '' })
    setPoItems([{ product_id: '', product_name: '', quantity: 1, unit_price: 0 }])
    setShowForm(false)
    setProcessing(false); toast.success('تمت إضافة أمر الشراء')
  }

  const handleReceivePO = async (po: any) => {
    if (!po || po.status === 'received') return
    // If PO has warehouse_id already (set at creation), use it directly
    const warehouseId = po.warehouse_id || receiveWarehouse
    if (!warehouseId) {
      setShowReceiveModal(po)
      return
    }
    setProcessing(true)
    // Mark as received
    await updateStatus(po.id, 'received')
    // Add stock to warehouse for each PO item
    const poItems = po.items || []
    for (const item of poItems) {
      if (!item.product_id) continue
      const { data: existing } = await supabase
        .from('stock_locations')
        .select('id, quantity')
        .eq('product_id', item.product_id)
        .eq('warehouse_id', warehouseId)
        .maybeSingle()

      if (existing?.id) {
        await supabase.from('stock_locations').update({
          quantity: Number(existing.quantity || 0) + Number(item.quantity || 0),
        }).eq('id', existing.id)
      } else {
        await supabase.from('stock_locations').insert({
          tenant_id: tenant?.id,
          product_id: item.product_id,
          warehouse_id: warehouseId,
          quantity: Number(item.quantity || 0),
        })
      }
    }
    // Auto-create expense
    if (po.total_amount > 0) {
      await addExpense({
        category: 'مشتريات',
        amount: po.total_amount,
        description: `أمر شراء ${po.po_ref} — ${po.supplier_name}`,
        expense_date: new Date().toISOString().split('T')[0],
        status: 'paid',
        is_recurring: false,
        created_by: 'system',
      })
      toast.success(`تم استلام الأمر وإضافة المخزون وتسجيله كمصروف: ${formatEGP(po.total_amount)}`)
    } else {
      toast.success('تم تحديث حالة الأمر وإضافة المخزون')
    }
    setProcessing(false)
    setShowReceiveModal(null)
    setReceiveBranch('')
    setReceiveWarehouse('')
  }

  const addPoItem = () => setPoItems([...poItems, { product_id: '', product_name: '', quantity: 1, unit_price: 0 }])
  const updatePoItem = (idx: number, field: string, val: any) => {
    const items = [...poItems]
    items[idx] = { ...items[idx], [field]: val }
    setPoItems(items)
  }
  const removePoItem = (idx: number) => setPoItems(poItems.filter((_, i) => i !== idx))
  const poTotal = poItems.reduce((s, i) => s + (i.quantity * i.unit_price), 0)

  const statusLabel = (s: string) => ({ draft: 'مسودة', sent: 'مرسل', received: 'مستلم', cancelled: 'ملغي' }[s] || s)
  const statusColor = (s: string) => ({ draft: { bg: 'rgba(107,114,128,0.1)', color: '#6b7280' }, sent: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' }, received: { bg: 'rgba(16,185,129,0.1)', color: '#10b981' }, cancelled: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444' } }[s] || { bg: 'rgba(107,114,128,0.1)', color: '#6b7280' })

  if (loading || poLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-heading)' }}>الموردون وأوامر الشراء</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>إدارة الموردين وتتبع أوامر الشراء</p>
        </div>
        <button onClick={() => { setEditId(null); setForm(emptyForm); setPoForm({ supplier_id: '', notes: '', expected_date: '', branch_id: '', warehouse_id: '' }); setPoItems([{ product_id: '', product_name: '', quantity: 1, unit_price: 0 }]); setShowForm(true) }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
          <Plus className="w-4 h-4" />{tab === 'suppliers' ? 'مورد جديد' : 'أمر شراء جديد'}
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--bg-input)' }}>
        {([{ id: 'suppliers', label: 'الموردون', icon: User }, { id: 'purchase-orders', label: 'أوامر الشراء', icon: FileText }] as { id: Tab; label: string; icon: typeof User }[]).map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all"
              style={{ background: tab === t.id ? 'var(--bg-card)' : 'transparent', color: tab === t.id ? 'var(--primary)' : 'var(--text-muted)', boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              <Icon className="w-4 h-4" />{t.label}
            </button>
          )
        })}
      </div>

      {/* Suppliers Tab */}
      {tab === 'suppliers' && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {suppliers.map(s => (
              <div key={s.id} className="p-4 rounded-2xl border cursor-pointer transition-all hover:shadow-lg" style={{ background: 'var(--bg-card)', borderColor: selectedSupplier === s.id ? 'var(--primary)' : 'var(--border-light)' }} onClick={() => setSelectedSupplier(selectedSupplier === s.id ? null : s.id)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
                      <User className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{s.name}</p>
                      {s.contact_name && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.contact_name}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={e => { e.stopPropagation(); openEdit(s) }} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}><Edit3 className="w-3.5 h-3.5" /></button>
                    <button onClick={e => { e.stopPropagation(); remove(s.id) }} className="p-1.5 rounded-lg" style={{ color: '#ef4444' }}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {s.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{s.phone}</span>}
                  {s.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{s.email}</span>}
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-light)' }}>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>الرصيد المستحق</span>
                  <span className="text-sm font-bold" style={{ color: (s.balance || 0) > 0 ? '#ef4444' : '#10b981' }}>{formatEGP(s.balance || 0)}</span>
                </div>
              </div>
            ))}
          </div>
          {selectedSupplier && <SupplierPayments supplierId={selectedSupplier} tenantId={tenant?.id} />}
          {suppliers.length === 0 && <div className="text-center py-16 opacity-50"><User className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} /><p className="text-sm" style={{ color: 'var(--text-muted)' }}>لا يوجد موردون</p></div>}
        </>
      )}

      {/* Purchase Orders Tab */}
      {tab === 'purchase-orders' && (
        <div className="space-y-3">
          {purchaseOrders.map(o => {
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
                    {o.status !== 'received' && o.status !== 'cancelled' && (
                      <button disabled={processing} onClick={() => handleReceivePO(o)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                        {processing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        استلام
                      </button>
                    )}
                  </div>
                </div>
                {o.notes && <p className="text-xs mt-2 pr-14" style={{ color: 'var(--text-muted)' }}>{o.notes}</p>}
              </div>
            )
          })}
          {purchaseOrders.length === 0 && <div className="text-center py-16 opacity-50"><FileText className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} /><p className="text-sm" style={{ color: 'var(--text-muted)' }}>لا توجد أوامر شراء</p></div>}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="p-6 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black" style={{ color: 'var(--text-heading)' }}>
                {tab === 'suppliers' ? (editId ? 'تعديل المورد' : 'مورد جديد') : 'أمر شراء جديد'}
              </h3>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
            </div>
            {tab === 'suppliers' ? (
              <div className="space-y-3">
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="اسم المورد *" className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                <input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} placeholder="جهة الاتصال" className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                <div className="grid grid-cols-2 gap-3">
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="الهاتف" className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                  <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="البريد الإلكتروني" className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                </div>
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="العنوان" className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
              </div>
            ) : (
              <div className="space-y-3">
                <select value={poForm.supplier_id} onChange={e => setPoForm({ ...poForm, supplier_id: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
                  <option value="">— اختر المورد —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {/* Branch & Warehouse for stock receiving */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>الفرع المستلم</label>
                    <select value={poForm.branch_id} onChange={e => setPoForm({ ...poForm, branch_id: e.target.value, warehouse_id: '' })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
                      <option value="">— اختر الفرع —</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>المخزن</label>
                    <select value={poForm.warehouse_id} onChange={e => setPoForm({ ...poForm, warehouse_id: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
                      <option value="">— اختر المخزن —</option>
                      {warehouses.filter(w => w.branch_id === poForm.branch_id).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" value={poForm.expected_date} onChange={e => setPoForm({ ...poForm, expected_date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                  <input disabled value={formatEGP(poTotal)} className="w-full px-3 py-2.5 rounded-xl border text-sm font-bold" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: '#10b981' }} />
                </div>
                {/* Items Grid */}
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                  <div className="grid grid-cols-12 gap-0 px-3 py-2 text-xs font-bold" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                    <span className="col-span-5">المنتج</span><span className="col-span-2 text-center">الكمية</span><span className="col-span-3 text-center">السعر</span><span className="col-span-2"></span>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
                    {poItems.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-1 px-2 py-1.5 items-center">
                        <select
                          value={item.product_id}
                          onChange={e => {
                            const p = products.find(pr => pr.id === e.target.value)
                            const items = [...poItems]
                            items[idx] = { ...items[idx], product_id: e.target.value, product_name: p?.name || '' }
                            setPoItems(items)
                          }}
                          className="col-span-5 px-2 py-1 rounded-lg border text-xs"
                          style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}
                        >
                          <option value="">— اختر منتج —</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <input type="number" min="1" value={item.quantity} onChange={e => updatePoItem(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))} className="col-span-2 px-2 py-1 rounded-lg border text-xs text-center" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                        <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => updatePoItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} className="col-span-3 px-2 py-1 rounded-lg border text-xs text-center" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                        <div className="col-span-2 flex justify-end">
                          {poItems.length > 1 && <button onClick={() => removePoItem(idx)} className="p-1 rounded" style={{ color: '#ef4444' }}><X className="w-3 h-3" /></button>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={addPoItem} className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg w-full justify-center" style={{ background: 'rgba(16,185,129,0.08)', color: '#10b981', border: '1px dashed #10b981' }}>
                  <Plus className="w-3 h-3" />إضافة منتج
                </button>
                <textarea value={poForm.notes} onChange={e => setPoForm({ ...poForm, notes: e.target.value })} placeholder="ملاحظات (اختياري)" rows={2} className="w-full px-3 py-2.5 rounded-xl border text-sm resize-none" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>إلغاء</button>
              <button disabled={processing} onClick={tab === 'suppliers' ? handleSubmit : handleCreatePO} className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
                {processing && <Loader2 className="w-4 h-4 animate-spin" />}{editId ? 'حفظ' : 'إنشاء'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal - for POs without pre-set warehouse */}
      {showReceiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="p-6 rounded-2xl shadow-2xl max-w-md w-full" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black" style={{ color: 'var(--text-heading)' }}>استلام أمر الشراء</h3>
              <button onClick={() => { setShowReceiveModal(null); setReceiveBranch(''); setReceiveWarehouse('') }} style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              اختر الفرع والمخزن لإضافة المخزون إليه
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>الفرع</label>
                <select value={receiveBranch} onChange={e => { setReceiveBranch(e.target.value); setReceiveWarehouse('') }} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
                  <option value="">— اختر الفرع —</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>المخزن</label>
                <select value={receiveWarehouse} onChange={e => setReceiveWarehouse(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
                  <option value="">— اختر المخزن —</option>
                  {warehouses.filter(w => w.branch_id === receiveBranch).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setShowReceiveModal(null); setReceiveBranch(''); setReceiveWarehouse('') }} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>إلغاء</button>
              <button disabled={processing || !receiveWarehouse} onClick={() => handleReceivePO(showReceiveModal)} className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2" style={{ background: '#10b981', color: '#fff', opacity: !receiveWarehouse ? 0.5 : 1 }}>
                {processing && <Loader2 className="w-4 h-4 animate-spin" />}
                <Check className="w-4 h-4" />استلام وإضافة المخزون
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SupplierPayments({ supplierId, tenantId }: { supplierId: string; tenantId?: string }) {
  const { payments, loading, add: create } = useSupplierPayments(supplierId)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [notes, setNotes] = useState('')

  const handlePay = async () => {
    if (!amount || !tenantId) return
    await create({ tenant_id: tenantId, supplier_id: supplierId, amount: parseFloat(amount), method, notes: notes || null, paid_at: new Date().toISOString() })
    setAmount('')
    setNotes('')
  }

  return (
    <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
      <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-heading)' }}>سجل المدفوعات</h3>
      <div className="flex gap-2 mb-4">
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="المبلغ" className="flex-1 px-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
        <select value={method} onChange={e => setMethod(e.target.value)} className="px-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
          <option value="cash">نقدي</option>
          <option value="bank_transfer">تحويل بنكي</option>
          <option value="check">شيك</option>
        </select>
        <button onClick={handlePay} className="px-4 py-2 rounded-xl text-sm font-bold" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>دفع</button>
      </div>
      {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" style={{ color: 'var(--primary)' }} /> : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {payments.map(p => (
            <div key={p.id} className="flex items-center justify-between text-xs py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
              <div>
                <span className="font-bold" style={{ color: 'var(--text-heading)' }}>{formatEGP(p.amount)}</span>
                <span className="mr-2" style={{ color: 'var(--text-muted)' }}>{p.method}</span>
              </div>
              <span style={{ color: 'var(--text-muted)' }}>{new Date(p.paid_at).toLocaleDateString('ar-EG')}</span>
            </div>
          ))}
          {payments.length === 0 && <p className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>لا توجد مدفوعات</p>}
        </div>
      )}
    </div>
  )
}
