import { useUsers, useRoles } from '../hooks/useData'
import { useBranches } from '../hooks/useSaasData'
import { useToast } from '../context/ToastContext'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTenant } from '../context/TenantContext'
import { Plus, UserCog, Shield, Loader2, X, Check, Users, Edit3, Eye, EyeOff } from 'lucide-react'

export default function UsersPage() {
  const { currentUser } = useAuth()
  const { tenant } = useTenant()
  const { users, loading, add, update, fetch: refetchUsers } = useUsers()
  const { branches } = useBranches(tenant?.id)
  const { roles, loading: rolesLoading, add: addRole, updatePerm } = useRoles()
  const toast = useToast()
  const [showUserForm, setShowUserForm] = useState(false)
  const [showRoleForm, setShowRoleForm] = useState(false)
  const [showRoleAssign, setShowRoleAssign] = useState<string | null>(null)
  const [editUser, setEditUser] = useState<any | null>(null)
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users')
  const [processing, setProcessing] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [userForm, setUserForm] = useState({ email: '', full_name: '', phone: '', password: '', role_name: 'كاشير', branch_id: '' })
  const [roleForm, setRoleForm] = useState({ name: '', description: '' })

  const modules = ['dashboard', 'products', 'orders', 'finance', 'settings', 'users', 'reports']

  const handleAddUser = async () => {
    if (!userForm.email || !userForm.full_name) return toast.warning('أدخل الاسم والبريد الإلكتروني')
    if (!userForm.branch_id) return toast.warning('اختر الفرع للمستخدم')
    setProcessing(true)
    try {
      // Create auth user via signUp (doesn't affect current session)
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: userForm.email,
        password: userForm.password || Math.random().toString(36).slice(-10) + 'A1!',
        options: { data: { full_name: userForm.full_name } },
      })
      if (authErr) {
        toast.error('البريد الإلكتروني مستخدم مسبقاً أو غير صالح')
        setProcessing(false)
        return
      }
      // Insert into users table
      const { error: insertError } = await add({
        email: userForm.email,
        full_name: userForm.full_name,
        is_active: true,
        ...(userForm.phone ? { phone: userForm.phone } : {}),
        ...(userForm.role_name ? { role_name: userForm.role_name } : {}),
        branch_id: userForm.branch_id,
        ...(authData.user ? { auth_user_id: authData.user.id } : {}),
      } as any)
      if (insertError) {
        toast.error('تم إنشاء الحساب ولكن فشل حفظ بيانات المستخدم')
        setProcessing(false)
        return
      }
      toast.success('تمت إضافة المستخدم بنجاح')
      setShowUserForm(false)
      setUserForm({ email: '', full_name: '', phone: '', password: '', role_name: 'كاشير', branch_id: '' })
    } catch {
      toast.error('حدث خطأ أثناء إضافة المستخدم')
    }
    setProcessing(false)
  }

  const handleEditUser = async () => {
    if (!editUser) return
    setProcessing(true)
    await update(editUser.id, { full_name: editUser.full_name, phone: editUser.phone || null, role_name: editUser.role_name, branch_id: editUser.branch_id || null, is_active: editUser.is_active })
    toast.success('تم تحديث بيانات المستخدم')
    setEditUser(null)
    setProcessing(false)
  }

  const handleToggleActive = async (u: any) => {
    await update(u.id, { is_active: !u.is_active })
    toast.success(u.is_active ? 'تم تعطيل المستخدم' : 'تم تفعيل المستخدم')
  }

  const handleAssignRole = async (userId: string, roleId: string) => {
    await supabase.from('user_roles').upsert({ user_id: userId, role_id: roleId })
    await refetchUsers()
    toast.success('تم تعيين الدور')
    setShowRoleAssign(null)
  }

  const handleRemoveRole = async (userId: string, roleId: string) => {
    await supabase.from('user_roles').delete().eq('user_id', userId).eq('role_id', roleId)
    await refetchUsers()
    toast.success('تم إزالة الدور')
  }

  const handleAddRole = async () => {
    if (!roleForm.name) return
    setProcessing(true)
    await addRole(roleForm)
    toast.success('تمت إضافة الدور')
    setProcessing(false); setShowRoleForm(false)
    setRoleForm({ name: '', description: '' })
  }

  if (loading || rolesLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} /></div>

  const roleGradients = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899']

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-heading)' }}>المستخدمون والأدوار</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>إدارة حسابات المستخدمين وصلاحياتهم</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--bg-input)' }}>
        {[{ id: 'users' as const, label: 'المستخدمون', icon: Users }, { id: 'roles' as const, label: 'الأدوار', icon: Shield }].map(t => {
          const Icon = t.icon
          return <button key={t.id} onClick={() => setActiveTab(t.id)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all" style={{ background: activeTab === t.id ? 'var(--bg-card)' : 'transparent', color: activeTab === t.id ? 'var(--primary)' : 'var(--text-muted)', boxShadow: activeTab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}><Icon className="w-4 h-4" />{t.label}</button>
        })}
      </div>

      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setShowUserForm(true) }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
              <Plus className="w-4 h-4" />إضافة مستخدم
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {users.map(u => {
              const userRoles = (u as any).roles?.map((r: any) => r.name) || []
              const isCurrentUser = currentUser?.email === u.email || currentUser?.id === u.id
              const isSystemAdmin = (u as any).role_name === 'مدير النظام' || userRoles.includes('مدير النظام')
              return (
                <div key={u.id} className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)', opacity: u.is_active ? 1 : 0.6 }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white flex-shrink-0" style={{ background: 'var(--primary)' }}>
                        {u.full_name?.substring(0, 2) || '؟'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{u.full_name}</p>
                          {isCurrentUser && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>أنت</span>}
                          {isSystemAdmin && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(245,158,11,0.12)', color: '#d97706' }}>مدير النظام</span>}
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditUser({ ...u })} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }} title="تعديل"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleToggleActive(u)} className="p-1.5 rounded-lg" style={{ color: u.is_active ? '#10b981' : '#ef4444' }} title={u.is_active ? 'تعطيل' : 'تفعيل'}>
                        {u.is_active ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Roles */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {userRoles.map((rn: string, i: number) => (
                      <span key={rn} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg font-bold" style={{ background: `${roleGradients[i % roleGradients.length]}20`, color: roleGradients[i % roleGradients.length] }}>
                        {rn}
                        <button onClick={() => {
                          const roleObj = roles.find(r => r.name === rn)
                          if (roleObj) handleRemoveRole(u.id, roleObj.id)
                        }} className="opacity-60 hover:opacity-100"><X className="w-2.5 h-2.5" /></button>
                      </span>
                    ))}
                    <button onClick={() => setShowRoleAssign(u.id)} className="text-[11px] px-2 py-0.5 rounded-lg font-bold border border-dashed" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                      + دور
                    </button>
                  </div>

                  {showRoleAssign === u.id && (
                    <div className="flex flex-wrap gap-1 p-2 rounded-lg mb-2" style={{ background: 'var(--bg-input)' }}>
                      {roles.map(r => (
                        <button key={r.id} onClick={() => handleAssignRole(u.id, r.id)} className="text-[11px] px-2 py-1 rounded-lg font-bold" style={{ background: 'var(--bg-card)', color: 'var(--primary)', border: '1px solid var(--border-light)' }}>
                          {r.name}
                        </button>
                      ))}
                      <button onClick={() => setShowRoleAssign(null)} className="text-[11px] px-2 py-1 rounded-lg" style={{ color: 'var(--text-muted)' }}>إلغاء</button>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: u.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: u.is_active ? '#10b981' : '#ef4444' }}>
                      {u.is_active ? 'نشط' : 'معطل'}
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {(u as any).role_name || '—'}
                      {' · '}
                      {branches.find((b) => b.id === (u as any).branch_id)?.name || 'بدون فرع'}
                    </span>
                  </div>
                </div>
              )
            })}
            {users.length === 0 && (
              <div className="col-span-3 text-center py-16 opacity-50">
                <Users className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>لا يوجد مستخدمون</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowRoleForm(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
              <Plus className="w-4 h-4" />إضافة دور
            </button>
          </div>
          {roles.map(role => (
            <div key={role.id} className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-heading)' }}>
                <UserCog className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                {role.name}
                {role.is_system && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>نظام</span>}
                {role.description && <span className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>{role.description}</span>}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {modules.map(mod => {
                  const modLabels: Record<string, string> = { dashboard: 'الداشبورد', products: 'المنتجات', orders: 'الطلبات', finance: 'المالية', settings: 'الإعدادات', users: 'المستخدمون', reports: 'التقارير' }
                  const perm = (role as any).permissions?.find((p: any) => p.module === mod)
                  return (
                    <div key={mod} className="p-3 rounded-xl border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-light)' }}>
                      <p className="text-xs font-bold mb-2" style={{ color: 'var(--text-heading)' }}>{modLabels[mod] || mod}</p>
                      <div className="grid grid-cols-2 gap-1">
                        {[['can_view', 'عرض'], ['can_create', 'إضافة'], ['can_edit', 'تعديل'], ['can_delete', 'حذف']].map(([key, label]) => (
                          <label key={key} className="flex items-center gap-1 cursor-pointer">
                            <input type="checkbox"
                              checked={(perm as any)?.[key] || false}
                              onChange={e => updatePerm(role.id, mod, {
                                can_view: key === 'can_view' ? e.target.checked : perm?.can_view || false,
                                can_create: key === 'can_create' ? e.target.checked : perm?.can_create || false,
                                can_edit: key === 'can_edit' ? e.target.checked : perm?.can_edit || false,
                                can_delete: key === 'can_delete' ? e.target.checked : perm?.can_delete || false,
                              })}
                              className="w-3 h-3 accent-[var(--primary)]"
                            />
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add User Modal */}
      {showUserForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="p-6 rounded-2xl shadow-2xl max-w-md w-full space-y-4" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>إضافة مستخدم جديد</h3>
              <button onClick={() => setShowUserForm(false)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>الاسم الكامل *</label>
                <input value={userForm.full_name} onChange={e => setUserForm({ ...userForm, full_name: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} placeholder="أحمد محمد" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>البريد الإلكتروني *</label>
                <input type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm text-left" dir="ltr" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} placeholder="ahmed@example.com" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>الهاتف</label>
                <input value={userForm.phone} onChange={e => setUserForm({ ...userForm, phone: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} placeholder="01012345678" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>كلمة المرور *</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm pr-10" dir="ltr" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} placeholder="8 أحرف على الأقل" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>سيتمكن المستخدم من تسجيل الدخول بهذه البيانات</p>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>الدور</label>
                <select value={userForm.role_name} onChange={e => setUserForm({ ...userForm, role_name: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
                  {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                  <option value="كاشير">كاشير</option>
                  <option value="مشرف">مشرف</option>
                  <option value="مدير النظام">مدير النظام</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>الفرع *</label>
                <select value={userForm.branch_id} onChange={e => setUserForm({ ...userForm, branch_id: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
                  <option value="">— اختر الفرع —</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowUserForm(false)} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>إلغاء</button>
              <button onClick={handleAddUser} disabled={processing || !userForm.email || !userForm.full_name || userForm.password.length < 6} className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                إضافة المستخدم
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="p-6 rounded-2xl shadow-2xl max-w-md w-full space-y-4" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>تعديل المستخدم</h3>
              <button onClick={() => setEditUser(null)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>الاسم الكامل</label>
                <input value={editUser.full_name} onChange={e => setEditUser({ ...editUser, full_name: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>الهاتف</label>
                <input value={editUser.phone || ''} onChange={e => setEditUser({ ...editUser, phone: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>الدور</label>
                <select value={editUser.role_name || ''} onChange={e => setEditUser({ ...editUser, role_name: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
                  {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>الفرع</label>
                <select value={editUser.branch_id || ''} onChange={e => setEditUser({ ...editUser, branch_id: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
                  <option value="">— بدون فرع —</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editUser.is_active} onChange={e => setEditUser({ ...editUser, is_active: e.target.checked })} className="accent-[var(--primary)]" />
                <span className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>حساب نشط</span>
              </label>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditUser(null)} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>إلغاء</button>
              <button onClick={handleEditUser} disabled={processing} className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Role Modal */}
      {showRoleForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="p-5 rounded-xl shadow-2xl max-w-md w-full space-y-3" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>إضافة دور جديد</h3>
              <button onClick={() => setShowRoleForm(false)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>اسم الدور</label>
              <input value={roleForm.name} onChange={e => setRoleForm({ ...roleForm, name: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>الوصف</label>
              <input value={roleForm.description} onChange={e => setRoleForm({ ...roleForm, description: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowRoleForm(false)} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>إلغاء</button>
              <button onClick={handleAddRole} disabled={processing || !roleForm.name} className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                إضافة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
