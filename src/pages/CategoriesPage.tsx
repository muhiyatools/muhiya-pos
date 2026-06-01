import { useCategories } from '../hooks/useData'
import { useToast } from '../context/ToastContext'
import { useState } from 'react'
import { Plus, Edit2, Trash2, FolderOpen, Loader2, X, Check, Upload, Search } from 'lucide-react'
import { uploadImage } from '../lib/storage'

export default function CategoriesPage() {
  const { categories, loading, add, update, remove } = useCategories()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const [form, setForm] = useState({ name: '', slug: '', description: '', parent_category_id: null as string | null, color_hex: '#10b981', sort_order: 0, applies_to: 'all' as string, image_url: null as string | null })

  const filtered = categories.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageUploading(true)
    const r = await uploadImage({ file, bucket: 'product-images', path: `categories/${Date.now()}-${file.name}` })
    if (!r.error) setForm(prev => ({ ...prev, image_url: r.publicUrl }))
    setImageUploading(false)
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) return
    setProcessing(true)
    const slug = form.slug || form.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    if (editingId) { await update(editingId, { ...form, slug }); toast.success('تم تحديث التصنيف') }
    else { await add({ ...form, slug }); toast.success('تمت إضافة التصنيف') }
    setProcessing(false); setShowForm(false); setEditingId(null)
    setForm({ name: '', slug: '', description: '', parent_category_id: null, color_hex: '#10b981', sort_order: 0, applies_to: 'all', image_url: null })
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-black" style={{ color: 'var(--text-heading)' }}>التصنيفات</h1><p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{categories.length} تصنيف</p></div>
        <button onClick={() => { setForm({ name: '', slug: '', description: '', parent_category_id: null, color_hex: '#10b981', sort_order: 0, applies_to: 'all', image_url: null }); setEditingId(null); setShowForm(true) }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}><Plus className="w-4 h-4" />إضافة</button>
      </div>
      <div className="relative max-w-md"><Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..." className="w-full pr-10 pl-4 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }} /></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(cat => {
          const catColor = cat.color_hex || '#10b981'
          return (
          <div key={cat.id} className="p-4 rounded-xl border flex items-center gap-3 group" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
            {cat.image_url ? <img src={cat.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" /> : <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: catColor + '18' }}><FolderOpen className="w-5 h-5" style={{ color: catColor }} /></div>}
            <div className="flex-1 min-w-0"><p className="text-sm font-bold truncate" style={{ color: 'var(--text-heading)' }}>{cat.name}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{cat.applies_to}</p></div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity touch-visible"><button onClick={() => { setEditingId(cat.id); setForm({ name: cat.name, slug: cat.slug, description: cat.description || '', parent_category_id: cat.parent_category_id, color_hex: cat.color_hex || '#10b981', sort_order: cat.sort_order, applies_to: cat.applies_to, image_url: cat.image_url || null }); setShowForm(true) }} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}><Edit2 className="w-3.5 h-3.5" /></button><button onClick={async () => { await remove(cat.id); toast.success('تم حذف التصنيف') }} className="p-1 rounded" style={{ color: '#ef4444' }}><Trash2 className="w-3.5 h-3.5" /></button></div>
          </div>
        )})}
        {filtered.length === 0 && <div className="col-span-full flex flex-col items-center justify-center py-16 opacity-40"><FolderOpen className="w-16 h-16 mb-3" style={{ color: 'var(--text-muted)' }} /><p className="text-sm" style={{ color: 'var(--text-muted)' }}>لا توجد تصنيفات</p></div>}
      </div>
      {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
        <div className="p-5 rounded-xl shadow-2xl max-w-md w-full space-y-3" style={{ background: 'var(--bg-card)' }}>
          <div className="flex items-center justify-between"><h3 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>{editingId ? 'تعديل' : 'إضافة'}</h3><button onClick={() => { setShowForm(false); setEditingId(null) }} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button></div>
          <div className="flex items-center gap-3"><label className="flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer text-xs font-bold" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>{imageUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}صورة<input type="file" accept="image/*" onChange={handleImage} className="hidden" disabled={imageUploading} /></label>{form.image_url && <img src={form.image_url} alt="" className="w-10 h-10 rounded" />}</div>
          <div><label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>الاسم</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} /></div>
          <div><label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Slug</label><input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm text-left" dir="ltr" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} /></div>
          <div><label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>ينطبق على</label><select value={form.applies_to} onChange={e => setForm({ ...form, applies_to: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}><option value="all">الكل</option><option value="product">المنتجات</option><option value="expense">المصروفات</option></select></div>
          <div className="flex items-center gap-2"><input type="color" value={form.color_hex} onChange={e => setForm({ ...form, color_hex: e.target.value })} className="w-8 h-8 rounded" /><span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{form.color_hex}</span></div>
          <button onClick={handleSubmit} disabled={processing || !form.name} className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>{processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{editingId ? 'حفظ' : 'إضافة'}</button>
        </div>
      </div>}
    </div>
  )
}
