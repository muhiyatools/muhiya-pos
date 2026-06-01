import { useState } from 'react'
import { useToast } from '../context/ToastContext'
import { useBranches, useWarehouses } from '../hooks/useSaasData'
import { useTenant } from '../context/TenantContext'
import { Plus, Edit2, Trash2, MapPin, Phone, Building2, Warehouse, Loader2, X } from 'lucide-react'

type Tab = 'branches' | 'warehouses'

export default function BranchesPage() {
  const { tenant } = useTenant()
  const { branches, loading: branchLoading, add: addBranch, update: updateBranch, remove: removeBranch } = useBranches(tenant?.id)
  const { warehouses, loading: whLoading, add: addWarehouse, update: updateWarehouse } = useWarehouses(tenant?.id)
  const toast = useToast()

  const [tab, setTab] = useState<Tab>('branches')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [branchForm, setBranchForm] = useState({ name: '', address: '', phone: '' })
  const [whForm, setWhForm] = useState({ name: '', branch_id: '', address: '' })

  const handleBranchSubmit = async () => {
    if (!branchForm.name.trim() || !tenant) return
    if (editId) { await updateBranch(editId, branchForm); toast.success('تم تحديث بيانات الفرع') }
    else { await addBranch({ ...branchForm, tenant_id: tenant.id, is_active: true, is_main: branches.length === 0 }); toast.success('تمت إضافة الفرع') }
    setBranchForm({ name: '', address: '', phone: '' }); setShowForm(false); setEditId(null)
  }

  const handleWhSubmit = async () => {
    if (!whForm.name.trim() || !tenant) return
    if (editId) { await updateWarehouse(editId, whForm); toast.success('تم تحديث بيانات المخزن') }
    else { await addWarehouse({ ...whForm, tenant_id: tenant.id, is_active: true }); toast.success('تمت إضافة المخزن') }
    setWhForm({ name: '', branch_id: '', address: '' }); setShowForm(false); setEditId(null)
  }

  const loading = branchLoading || whLoading
  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-heading)' }}>الفروع والمخازن</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>إدارة فروع ومخازن المنشأة</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setBranchForm({ name: '', address: '', phone: '' }); setWhForm({ name: '', branch_id: '', address: '' }) }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
          <Plus className="w-4 h-4" />{tab === 'branches' ? 'إضافة فرع' : 'إضافة مخزن'}
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--bg-input)' }}>
        {([{ id: 'branches', label: 'الفروع', icon: Building2 }, { id: 'warehouses', label: 'المخازن', icon: Warehouse }] as { id: Tab; label: string; icon: typeof Building2 }[]).map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all"
              style={{ background: tab === t.id ? 'var(--bg-card)' : 'transparent', color: tab === t.id ? 'var(--primary)' : 'var(--text-muted)', boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              <Icon className="w-4 h-4" />{t.label}
            </button>
          )
        })}
      </div>

      {/* Branches */}
      {tab === 'branches' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map(b => (
            <div key={b.id} className="p-5 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: b.is_main ? 'rgba(245,158,11,0.1)' : 'var(--bg-input)' }}>
                    <Building2 className="w-5 h-5" style={{ color: b.is_main ? '#f59e0b' : 'var(--text-muted)' }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{b.name}</h3>
                    {b.is_main && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>رئيسي</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setEditId(b.id); setBranchForm({ name: b.name, address: b.address || '', phone: (b as any).phone || '' }); setShowForm(true) }} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}><Edit2 className="w-3.5 h-3.5" /></button>
                  {!b.is_main && <button onClick={() => removeBranch(b.id)} className="p-1.5 rounded-lg" style={{ color: 'var(--danger)' }}><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
              </div>
              {b.address && <p className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--text-muted)' }}><MapPin className="w-3 h-3" />{b.address}</p>}
              {(b as any).phone && <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}><Phone className="w-3 h-3" />{(b as any).phone}</p>}
            </div>
          ))}
          {branches.length === 0 && <div className="col-span-full text-center py-16 opacity-50"><Building2 className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} /><p className="text-sm" style={{ color: 'var(--text-muted)' }}>لا توجد فروع بعد</p></div>}
        </div>
      )}

      {/* Warehouses */}
      {tab === 'warehouses' && (
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
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{(w as any).branch?.name ? `الفرع: ${(w as any).branch.name}` : 'مخزن مستقل'}</span>
                  </div>
                </div>
                <button onClick={() => { setEditId(w.id); setWhForm({ name: w.name, branch_id: (w as any).branch_id || '', address: w.address || '' }); setShowForm(true) }} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}><Edit2 className="w-3.5 h-3.5" /></button>
              </div>
              {(w as any).branch?.name && <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>الفرع: {(w as any).branch.name}</p>}
              {w.address && <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}><MapPin className="w-3 h-3" />{w.address}</p>}
            </div>
          ))}
          {warehouses.length === 0 && <div className="col-span-full text-center py-16 opacity-50"><Warehouse className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} /><p className="text-sm" style={{ color: 'var(--text-muted)' }}>لا توجد مخازن بعد</p></div>}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="p-6 rounded-2xl shadow-2xl max-w-md w-full" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black" style={{ color: 'var(--text-heading)' }}>
                {tab === 'branches' ? (editId ? 'تعديل الفرع' : 'فرع جديد') : (editId ? 'تعديل المخزن' : 'مخزن جديد')}
              </h3>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
            </div>
            {tab === 'branches' ? (
              <div className="space-y-3">
                <input value={branchForm.name} onChange={e => setBranchForm({ ...branchForm, name: e.target.value })} placeholder="اسم الفرع *" className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                <input value={branchForm.address} onChange={e => setBranchForm({ ...branchForm, address: e.target.value })} placeholder="العنوان" className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                <input value={branchForm.phone} onChange={e => setBranchForm({ ...branchForm, phone: e.target.value })} placeholder="الهاتف" className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
              </div>
            ) : (
              <div className="space-y-3">
                <input value={whForm.name} onChange={e => setWhForm({ ...whForm, name: e.target.value })} placeholder="اسم المخزن *" className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                <select value={whForm.branch_id} onChange={e => setWhForm({ ...whForm, branch_id: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
                  <option value="">— بدون فرع —</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <input value={whForm.address} onChange={e => setWhForm({ ...whForm, address: e.target.value })} placeholder="العنوان" className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>إلغاء</button>
              <button onClick={tab === 'branches' ? handleBranchSubmit : handleWhSubmit} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>{editId ? 'تحديث' : 'إضافة'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
