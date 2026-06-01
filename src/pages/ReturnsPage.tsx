import { useState, useMemo, useEffect } from 'react'
import { useReturns } from '../hooks/useSaasData'
import { useTenant } from '../context/TenantContext'
import { useAuth } from '../context/AuthContext'
import { formatEGP } from '../lib/utils'
import { RotateCcw, Loader2, Plus, X, Search, Building2, CreditCard, Banknote } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'

export default function ReturnsPage() {
  const { tenant, currentBranch, branches } = useTenant()
  const { isAdmin, currentUser } = useAuth()
  const [filterBranch, setFilterBranch] = useState<string | undefined>(undefined)

  // Non-admin users see only their branch
  useEffect(() => {
    if (!isAdmin && currentUser?.branch_id) setFilterBranch(currentUser.branch_id)
  }, [isAdmin, currentUser?.branch_id])

  const branchForQuery = isAdmin ? filterBranch : currentBranch?.id
  const { returns, loading, create } = useReturns(tenant?.id, branchForQuery)
  const toast = useToast()
  const [showForm, setShowForm] = useState(false)
  const [orderId, setOrderId] = useState('')
  const [reason, setReason] = useState('')
  const [orderSearch, setOrderSearch] = useState('')
  const [foundOrder, setFoundOrder] = useState<any>(null)
  const [selectedItems, setSelectedItems] = useState<{ order_item_id: string; product_name: string; quantity: number; unit_price: number; line_total: number }[]>([])
  const [listSearch, setListSearch] = useState('')
  const [refundLoading, setRefundLoading] = useState(false)

  // Filter returns list by search (product name, order ref, reason)
  const filteredReturns = useMemo(() => {
    if (!listSearch.trim()) return returns
    const q = listSearch.trim().toLowerCase()
    return returns.filter(r => {
      // Match by return_ref
      if (r.return_ref?.toLowerCase().includes(q)) return true
      // Match by order_ref from joined order
      if (r.order?.order_ref?.toLowerCase().includes(q)) return true
      // Match by reason
      if (r.reason?.toLowerCase().includes(q)) return true
      // Match by product names in return items
      if (r.items?.some((item: any) => item.product_name?.toLowerCase().includes(q))) return true
      // Match by refund amount
      if (String(r.refund_amount).includes(q)) return true
      return false
    })
  }, [returns, listSearch])

  const searchOrder = async () => {
    if (!orderSearch.trim()) return
    // Sanitize input to prevent PostgREST filter injection
    const term = orderSearch.trim().replace(/[%,.*()]/g, '')
    if (!term) return
    // Search by order_ref (ilike for partial match) or by customer_name or by product name in items
    const { data } = await supabase
      .from('orders')
      .select('id, order_ref, total, customer_name, payment_method, payment_status, order_items(id, product_name, quantity, unit_price, line_total)')
      .or(`order_ref.ilike.%${term}%,customer_name.ilike.%${term}%`)
      .eq('tenant_id', tenant?.id || '')
      .eq('branch_id', isAdmin ? (currentBranch?.id || '') : (currentBranch?.id || ''))
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) {
      setFoundOrder(data)
      setOrderId(data.id)
      setSelectedItems([])
    } else {
      // Try searching by product name or barcode inside order_items
      const safeTerm = term
      const { data: items } = await supabase
        .from('order_items')
        .select('order_id, product_name')
        .or(`product_name.ilike.%${safeTerm}%,barcode.ilike.%${safeTerm}%`)
        .limit(1)
        .maybeSingle()
      if (items?.order_id) {
        const { data: order } = await supabase
          .from('orders')
          .select('id, order_ref, total, customer_name, payment_method, payment_status, order_items(id, product_name, quantity, unit_price, line_total)')
          .eq('id', items.order_id)
          .eq('tenant_id', tenant?.id || '')
          .eq('branch_id', isAdmin ? (currentBranch?.id || '') : (currentBranch?.id || ''))
          .single()
        if (order) {
          setFoundOrder(order)
          setOrderId(order.id)
          setSelectedItems([])
          return
        }
      }
      toast.warning('لم يتم العثور على طلب مطابق')
    }
  }

  const toggleItem = (item: any) => {
    const existing = selectedItems.find(si => si.order_item_id === item.id)
    if (existing) {
      setSelectedItems(selectedItems.filter(si => si.order_item_id !== item.id))
    } else {
      setSelectedItems([...selectedItems, { order_item_id: item.id, product_name: item.product_name, quantity: item.quantity, unit_price: item.unit_price, line_total: item.line_total }])
    }
  }

  const handleSubmit = async () => {
    if (!orderId || selectedItems.length === 0 || !tenant || !currentBranch) return
    const totalRefund = selectedItems.reduce((s, i) => s + i.line_total, 0)
    const isLinkPaid = foundOrder?.payment_method === 'link' && foundOrder?.payment_status === 'paid'

    setRefundLoading(true)
    try {
      // If paid by payment link, call Paymob refund API first
      if (isLinkPaid) {
        const amountCents = Math.round(totalRefund * 100)
        const { data: refundResult, error: refundError } = await supabase.functions.invoke('refund-paymob', {
          body: { order_id: orderId, amount_cents: amountCents, tenant_id: tenant.id },
        })
        if (refundError || refundResult?.error) {
          toast.error(`فشل استرداد المبلغ من بوابة الدفع: ${refundResult?.error || refundError?.message || 'خطأ غير معروف'}`)
          setRefundLoading(false)
          return
        }
        toast.success('تم استرداد المبلغ عبر بوابة الدفع بنجاح')
      }

      await create({
        tenant_id: tenant.id,
        branch_id: currentBranch.id,
        order_id: orderId,
        reason: reason || 'مرتجع طلب',
        refund_amount: totalRefund,
        refund_method: isLinkPaid ? 'payment_link' : 'cash',
        return_ref: `RET-${Date.now()}`,
        status: 'completed',
      }, selectedItems)
      setShowForm(false)
      setFoundOrder(null)
      setSelectedItems([])
      setOrderId('')
      setReason('')
      setOrderSearch('')
    } catch (err: any) {
      toast.error(`حدث خطأ أثناء إنشاء المرتجع: ${err.message || 'خطأ غير معروف'}`)
    }
    setRefundLoading(false)
  }

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { pending: 'قيد المراجعة', approved: 'معتمد', completed: 'مكتمل', rejected: 'مرفوض' }
    return map[s] || s
  }

  const statusColor = (s: string) => {
    const map: Record<string, { bg: string; color: string }> = {
      pending: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
      approved: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' },
      completed: { bg: 'rgba(16,185,129,0.1)', color: '#10b981' },
      rejected: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
    }
    return map[s] || map.pending
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-heading)' }}>المرتجعات</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>إدارة مرتجعات الطلبات</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
          <Plus className="w-4 h-4" />مرتجع جديد
        </button>
      </div>

      {/* Branch Filter — admin only */}
      {isAdmin && branches.length > 1 && (
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-input)' }}>
            <button onClick={() => setFilterBranch(undefined)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{ background: !filterBranch ? 'var(--bg-card)' : 'transparent', color: !filterBranch ? 'var(--primary)' : 'var(--text-muted)', boxShadow: !filterBranch ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              كل الفروع
            </button>
            {branches.map(b => (
              <button key={b.id} onClick={() => setFilterBranch(b.id)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{ background: filterBranch === b.id ? 'var(--bg-card)' : 'transparent', color: filterBranch === b.id ? 'var(--primary)' : 'var(--text-muted)', boxShadow: filterBranch === b.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي المرتجعات', value: returns.length, color: 'var(--primary)' },
          { label: 'مكتملة', value: returns.filter(r => r.status === 'completed').length, color: '#10b981' },
          { label: 'قيد المراجعة', value: returns.filter(r => r.status === 'pending').length, color: '#f59e0b' },
          { label: 'إجمالي المبالغ', value: formatEGP(returns.reduce((s, r) => s + (r.refund_amount || 0), 0)), color: '#ef4444', isText: true },
        ].map((card, i) => (
          <div key={i} className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{card.label}</p>
            <p className="text-2xl font-black mt-1" style={{ color: card.color }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        <input value={listSearch} onChange={e => setListSearch(e.target.value)} placeholder="بحث بالمنتج، رقم الطلب، السبب..." className="w-full pr-10 pl-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
      </div>

      {/* Returns list */}
      <div className="space-y-3">
        {filteredReturns.map(r => {
          const sc = statusColor(r.status)
          return (
            <div key={r.id} className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: sc.bg }}>
                    <RotateCcw className="w-5 h-5" style={{ color: sc.color }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>مرتجع #{r.id.slice(0, 8)}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {r.created_at ? new Date(r.created_at).toLocaleDateString('ar-EG') : 'بدون تاريخ'} — {r.reason || 'بدون سبب'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold" style={{ color: '#ef4444' }}>-{formatEGP(r.refund_amount || 0)}</span>
                  <span className="px-2 py-1 rounded-lg text-[10px] font-bold" style={{ background: sc.bg, color: sc.color }}>{statusLabel(r.status)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filteredReturns.length === 0 && (
        <div className="text-center py-16 opacity-50">
          <RotateCcw className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>لا توجد مرتجعات</p>
        </div>
      )}

      {/* Create return modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="p-6 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black" style={{ color: 'var(--text-heading)' }}>مرتجع جديد</h3>
              <button onClick={() => { setShowForm(false); setFoundOrder(null) }} style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
            </div>

            {/* Order search */}
            <div className="flex gap-2 mb-4">
              <input value={orderSearch} onChange={e => setOrderSearch(e.target.value)} placeholder="رقم الطلب أو المعرف" className="flex-1 px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
              <button onClick={searchOrder} className="px-4 py-2.5 rounded-xl text-sm font-bold" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>بحث</button>
            </div>

            {foundOrder && (
              <>
                {/* Payment method indicator */}
                <div className="flex items-center gap-2 p-3 rounded-xl mb-3" style={{ background: foundOrder.payment_method === 'link' ? 'rgba(59,130,246,0.06)' : 'rgba(16,185,129,0.06)' }}>
                  {foundOrder.payment_method === 'link' ? (
                    <>
                      <CreditCard className="w-4 h-4" style={{ color: '#3b82f6' }} />
                      <span className="text-xs font-bold" style={{ color: '#3b82f6' }}>دفع إلكتروني — سيتم الاسترداد عبر بوابة الدفع</span>
                    </>
                  ) : (
                    <>
                      <Banknote className="w-4 h-4" style={{ color: '#10b981' }} />
                      <span className="text-xs font-bold" style={{ color: '#10b981' }}>دفع نقدي — استرداد نقدي</span>
                    </>
                  )}
                </div>
                <p className="text-xs font-bold mb-2" style={{ color: 'var(--text-heading)' }}>اختر المنتجات للإرجاع:</p>
                <div className="space-y-2 mb-4">
                  {(foundOrder.order_items || []).map((item: any) => {
                    const sel = selectedItems.find(si => si.order_item_id === item.id)
                    return (
                      <div key={item.id} onClick={() => toggleItem(item)} className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer" style={{ background: sel ? 'rgba(var(--primary-rgb),0.05)' : 'var(--bg-input)', borderColor: sel ? 'var(--primary)' : 'var(--border)' }}>
                        <div className="w-5 h-5 rounded border-2 flex items-center justify-center" style={{ borderColor: sel ? 'var(--primary)' : 'var(--border)', background: sel ? 'var(--primary)' : 'transparent' }}>
                          {sel && <span className="text-white text-xs">✓</span>}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{item.product_name}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.quantity} × {formatEGP(item.unit_price)}</p>
                        </div>
                        <span className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{formatEGP(item.line_total)}</span>
                      </div>
                    )
                  })}
                </div>
                <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="سبب الإرجاع" rows={2} className="w-full px-3 py-2.5 rounded-xl border text-sm resize-none mb-4" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                {selectedItems.length > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-xl mb-4" style={{ background: 'rgba(239,68,68,0.05)' }}>
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>إجمالي المبلغ المسترد</span>
                    <span className="text-lg font-black" style={{ color: '#ef4444' }}>{formatEGP(selectedItems.reduce((s, i) => s + i.line_total, 0))}</span>
                  </div>
                )}
              </>
            )}

            <div className="flex gap-2">
              <button onClick={() => { setShowForm(false); setFoundOrder(null) }} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>إلغاء</button>
              <button onClick={handleSubmit} disabled={!foundOrder || selectedItems.length === 0 || refundLoading} className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
                {refundLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {foundOrder?.payment_method === 'link' ? 'استرداد إلكتروني' : 'إرجاع'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
