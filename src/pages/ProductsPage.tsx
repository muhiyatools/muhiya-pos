import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useProducts, useCategories } from '../hooks/useData'
import { useBranches, useWarehouses } from '../hooks/useSaasData'
import { useTenant } from '../context/TenantContext'
import { useToast } from '../context/ToastContext'
import { uploadImage } from '../lib/storage'
import { formatEGP, playBeep } from '../lib/utils'
import { supabase } from '../lib/supabase'
import {
  Plus, Search, Edit2, Trash2, Package, Loader2, X, Check,
  Upload,
  AlertTriangle, Grid3X3, List, Barcode, Zap, Warehouse, Printer, RefreshCw,
} from 'lucide-react'

const UNITS = ['قطعة', 'كيلو', 'جرام', 'لتر', 'مل', 'علبة', 'كرتونة', 'رول', 'دستة', 'حبة', 'كيس', 'باكيت', 'زجاجة', 'طرد']

type StockFilter = 'all' | 'low' | 'out'
type ViewMode = 'grid' | 'list'

export default function ProductsPage() {
  const { products, loading, add, update, remove } = useProducts()
  const { categories, loading: catLoading } = useCategories('product')
  const { tenant } = useTenant()
  const { branches } = useBranches(tenant?.id)
  const { warehouses } = useWarehouses(tenant?.id)
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState<string | null>(null)
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [quickAddMode, setQuickAddMode] = useState(false)
  const [quickAddCount, setQuickAddCount] = useState(0)
  // Manual stock adjustment
  const [showStockAdjust, setShowStockAdjust] = useState<string | null>(null)
  const [stockAdjustForm, setStockAdjustForm] = useState({ branch_id: '', warehouse_id: '', quantity: 0 })
  const [stockProcessing, setStockProcessing] = useState(false)

  const emptyForm = {
    name: '', barcode: '', selling_price: 0,
    low_stock_threshold: 5,
    category_id: '' as string | null, description: '', primary_image_url: '' as string | null, unit: 'قطعة',
  }
  const [form, setForm] = useState(emptyForm)

  // Barcode scanner support in product form
  const barcodeBuffer = useRef('')
  const barcodeTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const handleBarcodeInput = useCallback((char: string) => {
    barcodeBuffer.current += char
    clearTimeout(barcodeTimeout.current)
    barcodeTimeout.current = setTimeout(() => {
      const barcode = barcodeBuffer.current.trim()
      if (barcode.length >= 3 && showForm) {
        playBeep(800, 150, 0.3)
        setForm(prev => ({ ...prev, barcode }))
      }
      barcodeBuffer.current = ''
    }, 300)
  }, [showForm])

  useEffect(() => {
    if (!showForm) return
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) handleBarcodeInput(e.key)
      else if (e.key === 'Enter' && barcodeBuffer.current.length > 0) handleBarcodeInput('')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showForm, handleBarcodeInput])

  /** Generate a unique barcode number (EAN-13 like) */
  const generateBarcode = () => {
    const existingBarcodes = new Set(products.map(p => p.barcode).filter(Boolean))
    let barcode = ''
    do {
      barcode = '200' + Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('')
      // Simple check digit
      const digits = barcode.split('').map(Number)
      const sum = digits.reduce((s, d, i) => s + d * (i % 2 === 0 ? 1 : 3), 0)
      barcode += ((10 - (sum % 10)) % 10).toString()
    } while (existingBarcodes.has(barcode))
    setForm(prev => ({ ...prev, barcode }))
    playBeep(600, 100, 0.2)
  }

  /** Print barcode label (opens print window) */
  const printBarcode = (barcode: string, productName: string) => {
    if (!barcode) return
    const win = window.open('', '_blank', 'width=400,height=300')
    if (!win) return
    win.document.write(
      '<html dir="rtl"><head><style>' +
      '@page{margin:2mm;size:50mm 30mm}' +
      'body{font-family:monospace;text-align:center;padding:2mm;margin:0}' +
      '.name{font-size:10px;font-weight:bold;margin-bottom:2mm;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}' +
      '.barcode{font-size:28px;letter-spacing:3px;font-family:"Libre Barcode 128",monospace;line-height:1.2}' +
      '.code{font-size:11px;font-family:monospace;margin-top:1mm}' +
      '@media print{body{padding:0}}' +
      '</style>' +
      '<link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap" rel="stylesheet">' +
      '</head><body>' +
      '<div class="name">' + productName + '</div>' +
      '<div class="barcode">' + barcode + '</div>' +
      '<div class="code">' + barcode + '</div>' +
      '<script>setTimeout(function(){window.print();setTimeout(function(){window.close()},500)},600)<\/script>' +
      '</body></html>'
    )
    win.document.close()
  }

  const filtered = useMemo(() => products.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !(p.barcode?.includes(search))) return false
    if (catFilter && p.category_id !== catFilter) return false
    if (stockFilter === 'low' && !(p.track_stock && p.stock !== null && p.stock > 0 && p.stock <= (p.low_stock_threshold ?? 5))) return false
    if (stockFilter === 'out' && !(p.track_stock && (p.stock ?? 1) <= 0)) return false
    return true
  }), [products, search, catFilter, stockFilter])

  const lowStockCount = products.filter(p => p.track_stock && p.stock !== null && p.stock <= (p.low_stock_threshold ?? 5)).length
  const outOfStockCount = products.filter(p => p.track_stock && (p.stock ?? 1) <= 0).length

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageUploading(true)
    const path = `products/${Date.now()}-${file.name}`
    const result = await uploadImage({ file, bucket: 'product-images', path })
    if (result.error) toast.error('فشل رفع الصورة')
    else setForm(prev => ({ ...prev, primary_image_url: result.publicUrl }))
    setImageUploading(false)
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.warning('أدخل اسم المنتج')
    if (form.selling_price <= 0) return toast.warning('أدخل سعر البيع')
    setProcessing(true)
    const payload: any = {
      name: form.name, barcode: form.barcode || null,
      selling_price: form.selling_price,
      track_stock: true, low_stock_threshold: form.low_stock_threshold,
      category_id: form.category_id || null, description: form.description || null,
      primary_image_url: form.primary_image_url, unit: form.unit || null,
    }
    if (editingId) {
      await update(editingId, payload)
      toast.success('تم تحديث المنتج')
      setProcessing(false); setShowForm(false); setEditingId(null); setForm(emptyForm)
    } else {
      payload.stock = 0
      const { error } = await add(payload)
      if (error) { toast.error('فشل إضافة المنتج'); setProcessing(false); return }
      setQuickAddCount(c => c + 1)
      toast.success('تمت إضافة المنتج ✓')
      if (quickAddMode) {
        setForm(prev => ({ ...emptyForm, category_id: prev.category_id, unit: prev.unit, low_stock_threshold: prev.low_stock_threshold }))
        setProcessing(false)
        return
      }
      setProcessing(false); setShowForm(false); setForm(emptyForm)
    }
  }

  const handleStockAdjust = async () => {
    if (!showStockAdjust || !stockAdjustForm.warehouse_id || stockAdjustForm.quantity <= 0) {
      return toast.warning('اختر المخزن وأدخل الكمية')
    }
    setStockProcessing(true)
    const productId = showStockAdjust
    // Upsert stock location
    const { data: existing } = await supabase
      .from('stock_locations')
      .select('id, quantity')
      .eq('product_id', productId)
      .eq('warehouse_id', stockAdjustForm.warehouse_id)
      .maybeSingle()

    if (existing?.id) {
      await supabase.from('stock_locations').update({
        quantity: Number(existing.quantity || 0) + stockAdjustForm.quantity,
      }).eq('id', existing.id)
    } else {
      await supabase.from('stock_locations').insert({
        tenant_id: tenant?.id,
        product_id: productId,
        warehouse_id: stockAdjustForm.warehouse_id,
        quantity: stockAdjustForm.quantity,
      })
    }
    toast.success(`تمت إضافة ${stockAdjustForm.quantity} للمخزون`)
    setStockProcessing(false)
    setShowStockAdjust(null)
    setStockAdjustForm({ branch_id: '', warehouse_id: '', quantity: 0 })
  }

  const handleDelete = async (id: string) => {
    await remove(id)
    toast.success('تم حذف المنتج')
    setDeleteConfirm(null)
  }

  const startEdit = (p: typeof products[0]) => {
    setEditingId(p.id)
    setForm({
      name: p.name, barcode: p.barcode || '', selling_price: p.selling_price,
      low_stock_threshold: p.low_stock_threshold || 5, category_id: p.category_id,
      description: p.description || '', primary_image_url: p.primary_image_url, unit: p.unit || 'قطعة',
    })
    setShowForm(true)
  }

  const stockBadge = (p: typeof products[0]) => {
    if (!p.track_stock || p.stock === null) return null
    if (p.stock <= 0) return { label: 'نفد المخزون', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' }
    if (p.stock <= (p.low_stock_threshold ?? 5)) return { label: `${p.stock} متبقي`, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
    return { label: `${p.stock} ${p.unit || ''}`, color: '#10b981', bg: 'rgba(16,185,129,0.1)' }
  }

  if (loading || catLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} /></div>

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-heading)' }}>المنتجات</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{products.length} منتج إجمالي</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true) }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
            <Plus className="w-4 h-4" />إضافة منتج
          </button>
        </div>
      </div>

      {/* Stock alerts bar */}
      {(lowStockCount > 0 || outOfStockCount > 0) && (
        <div className="flex gap-3 flex-wrap">
          {outOfStockCount > 0 && (
            <button onClick={() => setStockFilter(stockFilter === 'out' ? 'all' : 'out')} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: stockFilter === 'out' ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.07)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.25)' }}>
              <AlertTriangle className="w-3.5 h-3.5" />{outOfStockCount} نفد المخزون
            </button>
          )}
          {lowStockCount > 0 && (
            <button onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: stockFilter === 'low' ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.07)', color: '#d97706', border: '1px solid rgba(245,158,11,0.25)' }}>
              <AlertTriangle className="w-3.5 h-3.5" />{lowStockCount} مخزون منخفض
            </button>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="اسم أو باركود..." className="w-full pr-10 pl-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
        </div>
        <select value={catFilter || ''} onChange={e => setCatFilter(e.target.value || null)} className="px-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
          <option value="">كل الأقسام</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <button onClick={() => setViewMode('grid')} className="p-2" style={{ background: viewMode === 'grid' ? 'var(--primary)' : 'var(--bg-card)', color: viewMode === 'grid' ? 'var(--text-on-primary)' : 'var(--text-muted)' }}><Grid3X3 className="w-4 h-4" /></button>
          <button onClick={() => setViewMode('list')} className="p-2" style={{ background: viewMode === 'list' ? 'var(--primary)' : 'var(--bg-card)', color: viewMode === 'list' ? 'var(--text-on-primary)' : 'var(--text-muted)' }}><List className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map(product => {
            const badge = stockBadge(product)
            const catName = categories.find(c => c.id === product.category_id)?.name
            return (
              <div key={product.id} className="rounded-2xl border overflow-hidden group" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
                <div className="h-36 flex items-center justify-center relative overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                  {product.primary_image_url
                    ? <img src={product.primary_image_url} alt={product.name} className="w-full h-full object-cover" />
                    : <div className="flex flex-col items-center gap-1 opacity-30"><Package className="w-10 h-10" style={{ color: 'var(--text-muted)' }} /></div>
                  }
                  {badge && (badge.color === '#ef4444' || badge.color === '#f59e0b') && (
                    <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full" style={{ background: badge.color }} />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 touch-visible">
                    <button onClick={() => startEdit(product)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--bg-card)' }}><Edit2 className="w-3.5 h-3.5" style={{ color: 'var(--text-heading)' }} /></button>
                    <button onClick={() => { setShowStockAdjust(product.id); setStockAdjustForm({ branch_id: '', warehouse_id: '', quantity: 0 }) }} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--bg-card)' }}><Warehouse className="w-3.5 h-3.5" style={{ color: '#3b82f6' }} /></button>
                    {product.barcode && <button onClick={() => printBarcode(product.barcode!, product.name)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--bg-card)' }}><Printer className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} /></button>}
                    <button onClick={() => setDeleteConfirm(product.id)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#ef4444' }}><Trash2 className="w-3.5 h-3.5" style={{ color: '#fff' }} /></button>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-sm font-bold truncate" style={{ color: 'var(--text-heading)' }}>{product.name}</p>
                  {catName && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{catName}</p>}
                  {product.barcode && <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>{product.barcode}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-black" style={{ color: 'var(--primary)' }}>{formatEGP(product.selling_price)}</span>
                    {badge && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>}
                  </div>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 opacity-40">
              <Package className="w-16 h-16 mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>لا توجد منتجات</p>
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr style={{ background: 'var(--bg-input)' }}>
                  <th className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>المنتج</th>
                  <th className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>الباركود</th>
                  <th className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>القسم</th>
                  <th className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>سعر البيع</th>
                  <th className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  return (
                    <tr key={p.id} className="border-t" style={{ borderColor: 'var(--border-light)' }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.primary_image_url
                            ? <img src={p.primary_image_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                            : <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-input)' }}><Package className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></div>
                          }
                          <div>
                            <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{p.name}</p>
                            {p.unit && <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.unit}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{p.barcode || '—'}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{categories.find(c => c.id === p.category_id)?.name || '—'}</td>
                      <td className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--primary)' }}>{formatEGP(p.selling_price)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)', background: 'var(--bg-input)' }}><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { setShowStockAdjust(p.id); setStockAdjustForm({ branch_id: '', warehouse_id: '', quantity: 0 }) }} className="p-1.5 rounded-lg" style={{ color: '#3b82f6', background: 'rgba(59,130,246,0.08)' }}><Warehouse className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setDeleteConfirm(p.id)} className="p-1.5 rounded-lg" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>لا توجد منتجات</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="p-6 rounded-2xl shadow-2xl max-w-sm w-full" style={{ background: 'var(--bg-card)' }}>
            <h3 className="text-base font-bold mb-2" style={{ color: 'var(--text-heading)' }}>تأكيد الحذف</h3>
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>هل تريد حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl text-sm font-bold" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>إلغاء</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-2.5 rounded-xl text-sm font-bold" style={{ background: '#ef4444', color: '#fff' }}>حذف</button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="p-5 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
              <h3 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>{editingId ? 'تعديل منتج' : 'إضافة منتج جديد'}</h3>
              {!editingId && (
                <button
                  onClick={() => { setQuickAddMode(m => !m); setQuickAddCount(0) }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border"
                  style={{ background: quickAddMode ? 'rgba(245,158,11,0.1)' : 'transparent', borderColor: quickAddMode ? '#f59e0b' : 'var(--border)', color: quickAddMode ? '#d97706' : 'var(--text-muted)' }}
                >
                  <Zap className="w-3 h-3" />
                  {quickAddMode ? `سريعة (${quickAddCount})` : 'إضافة سريعة'}
                </button>
              )}
            </div>
              <button onClick={() => { setShowForm(false); setEditingId(null) }} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3">
              {/* Image */}
              <div>
                <label className="block text-xs font-bold mb-2" style={{ color: 'var(--text-muted)' }}>صورة المنتج</label>
                <div className="flex items-center gap-3">
                  {form.primary_image_url && <img src={form.primary_image_url} alt="" className="w-14 h-14 rounded-xl object-cover" />}
                  <label className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer text-xs font-bold" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
                    {imageUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {form.primary_image_url ? 'تغيير الصورة' : 'رفع صورة'}
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={imageUploading} />
                  </label>
                  {form.primary_image_url && <button onClick={() => setForm(f => ({ ...f, primary_image_url: null }))} className="p-1.5 rounded-lg text-xs" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}><X className="w-3.5 h-3.5" /></button>}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>اسم المنتج *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
              </div>

              {/* Barcode + Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>الباركود</label>
                  <div className="relative flex gap-1">
                    <div className="relative flex-1">
                      <Barcode className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                      <input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} placeholder="مسح أو إدخال" className="w-full pr-8 pl-3 py-2.5 rounded-xl border text-sm font-mono" dir="ltr" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                    </div>
                    <button type="button" onClick={generateBarcode} className="px-2 rounded-xl border flex items-center justify-center" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-input)' }} title="توليد باركود"><RefreshCw className="w-3.5 h-3.5" /></button>
                    {form.barcode && <button type="button" onClick={() => printBarcode(form.barcode, form.name)} className="px-2 rounded-xl border flex items-center justify-center" style={{ borderColor: 'var(--border)', color: 'var(--primary)', background: 'var(--bg-input)' }} title="طباعة باركود"><Printer className="w-3.5 h-3.5" /></button>}
                  </div>
                  <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>امسح بالماسح أو اضغط توليد</p>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>القسم</label>
                  <select value={form.category_id || ''} onChange={e => setForm({ ...form, category_id: e.target.value || null })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
                    <option value="">— بدون قسم —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Prices + Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>سعر البيع *</label>
                  <input type="number" min="0" step="0.01" value={form.selling_price || ''} onChange={e => setForm({ ...form, selling_price: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2.5 rounded-xl border text-sm" dir="ltr" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>الوحدة</label>
                  <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              {/* Profit margin indicator */}


              {/* Stock threshold */}
              <div className="p-3 rounded-xl" style={{ background: 'var(--bg-input)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>إعدادات المخزون</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>تتبع مفعّل دائماً</span>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>حد التنبيه للمخزون المنخفض</label>
                  <input type="number" min="0" value={form.low_stock_threshold} onChange={e => setForm({ ...form, low_stock_threshold: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border text-sm" dir="ltr" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                </div>
                <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>المخزون يُضاف عبر أوامر الشراء أو التعديل اليدوي</p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>الوصف</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2.5 rounded-xl border text-sm resize-none" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={processing || !form.name}
              className="w-full mt-4 py-3 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editingId ? 'حفظ التعديلات' : quickAddMode ? 'إضافة والاستمرار' : 'إضافة المنتج'}
            </button>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {showStockAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="p-5 rounded-2xl shadow-2xl max-w-md w-full mx-4 space-y-4 slide-up" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>تعديل المخزون يدوياً</h3>
              <button onClick={() => setShowStockAdjust(null)} style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              المنتج: <strong style={{ color: 'var(--text-heading)' }}>{products.find(p => p.id === showStockAdjust)?.name}</strong>
            </p>
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>الفرع</label>
              <select
                value={stockAdjustForm.branch_id}
                onChange={e => {
                  setStockAdjustForm({ ...stockAdjustForm, branch_id: e.target.value, warehouse_id: '' })
                }}
                className="w-full px-3 py-2.5 rounded-xl border text-sm"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}
              >
                <option value="">— اختر الفرع —</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            {stockAdjustForm.branch_id && (
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>المخزن</label>
                <select
                  value={stockAdjustForm.warehouse_id}
                  onChange={e => setStockAdjustForm({ ...stockAdjustForm, warehouse_id: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}
                >
                  <option value="">— اختر المخزن —</option>
                  {warehouses.filter(w => w.branch_id === stockAdjustForm.branch_id).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>الكمية المضافة</label>
              <input
                type="number" min="1" value={stockAdjustForm.quantity || ''}
                onChange={e => setStockAdjustForm({ ...stockAdjustForm, quantity: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 rounded-xl border text-sm" dir="ltr"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}
              />
            </div>
            <button
              onClick={handleStockAdjust}
              disabled={stockProcessing || !stockAdjustForm.warehouse_id || stockAdjustForm.quantity <= 0}
              className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}
            >
              {stockProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Warehouse className="w-4 h-4" />}
              إضافة للمخزون
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

