import { useOrders } from '../hooks/useData'
import { useAuth } from '../context/AuthContext'
import { useTenant } from '../context/TenantContext'
import { useToast } from '../context/ToastContext'
import { formatEGP } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { useState, useEffect } from 'react'
import { Search, Loader2, X, Building2, CheckCircle, Clock } from 'lucide-react'

export default function OrdersPage() {
  const { isAdmin, currentUser } = useAuth()
  const { branches } = useTenant()
  const toast = useToast()
  const [filterBranch, setFilterBranch] = useState<string | null>(null)

  // Non-admin users see only their branch
  useEffect(() => {
    if (!isAdmin && currentUser?.branch_id) setFilterBranch(currentUser.branch_id)
  }, [isAdmin, currentUser?.branch_id])

  const branchForQuery = filterBranch || (isAdmin ? null : currentUser?.branch_id) || null
  const { orders, loading, fetch: refetch } = useOrders(branchForQuery)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null)
  const [markingPaid, setMarkingPaid] = useState<string | null>(null)

  const filtered = orders.filter(o => {
    const matchSearch = !search || o.order_ref.toLowerCase().includes(search.toLowerCase()) || (o.customer_name && o.customer_name.toLowerCase().includes(search.toLowerCase()))
    const matchStatus = !statusFilter || o.status === statusFilter
    const matchPayStatus = !paymentStatusFilter || o.payment_status === paymentStatusFilter
    return matchSearch && matchStatus && matchPayStatus
  })

  const deferredCount = orders.filter(o => o.payment_status === 'deferred').length

  const handleMarkAsPaid = async (orderId: string) => {
    setMarkingPaid(orderId)
    try {
      const { error } = await supabase.from('orders').update({ payment_status: 'paid', payment_method: 'cash' }).eq('id', orderId)
      if (error) throw error

      // Create income entry
      const order = orders.find(o => o.id === orderId)
      if (order) {
        await supabase.from('income_entries').insert({
          source: 'sales',
          amount: order.total,
          description: `تسديد آجل - طلب ${order.order_ref}`,
          income_date: new Date().toISOString().split('T')[0],
          is_recurring: false,
          ...(order.tenant_id ? { tenant_id: order.tenant_id } : {}),
          ...(order.branch_id ? { branch_id: order.branch_id } : {}),
        })
      }
      toast.success('تم تسديد الطلب بنجاح')
      refetch()
      setSelectedOrder(null)
    } catch (err) {
      console.error(err)
      toast.error('فشل تسديد الطلب')
    }
    setMarkingPaid(null)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black" style={{ color: 'var(--text-heading)' }}>الطلبات</h1>
        <span className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>{orders.length} طلب</span>
      </div>

      {/* Branch Filter — admin only */}
      {isAdmin && branches.length > 1 && (
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-input)' }}>
            <button onClick={() => setFilterBranch(null)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
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

      {/* Deferred Orders Quick Badge */}
      {deferredCount > 0 && (
        <button onClick={() => { setPaymentStatusFilter(paymentStatusFilter === 'deferred' ? null : 'deferred'); setStatusFilter(null) }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all"
          style={{
            borderColor: paymentStatusFilter === 'deferred' ? '#f59e0b' : 'rgba(245,158,11,0.3)',
            background: paymentStatusFilter === 'deferred' ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.05)',
            color: '#f59e0b',
          }}>
          <Clock className="w-4 h-4" />
          طلبات آجلة: {deferredCount}
        </button>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالرقم أو العميل..." className="w-full pr-10 pl-4 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
        </div>
        <select value={statusFilter || ''} onChange={e => setStatusFilter(e.target.value || null)} className="px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
          <option value="">كل الحالات</option>
          <option value="pending">معلق</option>
          <option value="processing">قيد التنفيذ</option>
          <option value="completed">مكتمل</option>
          <option value="cancelled">ملغي</option>
          <option value="refunded">مسترد</option>
        </select>
        <select value={paymentStatusFilter || ''} onChange={e => setPaymentStatusFilter(e.target.value || null)} className="px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
          <option value="">كل حالات الدفع</option>
          <option value="paid">مدفوع</option>
          <option value="deferred">آجل</option>
          <option value="pending">في الانتظار</option>
        </select>
      </div>

      {/* Orders List */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr style={{ background: 'var(--bg-input)' }}>
                <th className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>رقم الطلب</th>
                <th className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>العميل</th>
                <th className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>التاريخ</th>
                <th className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>الحالة</th>
                <th className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>الدفع</th>
                <th className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>حالة الدفع</th>
                <th className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>الإجمالي</th>
                <th className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>الكاشير</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => (
                <tr key={order.id} className="border-t cursor-pointer hover:opacity-80 transition-opacity" style={{ borderColor: 'var(--border-light)' }} onClick={() => setSelectedOrder(order)}>
                  <td className="px-4 py-3 text-sm font-mono font-bold" style={{ color: 'var(--text-heading)' }}>{order.order_ref}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-main)' }}>{order.customer_name || '—'}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>{order.created_at?.split('T')[0] || ''}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-bold px-2 py-1 rounded" style={{
                      background: order.status === 'completed' ? 'rgba(16,185,129,0.1)' : order.status === 'pending' ? 'rgba(245,158,11,0.1)' : order.status === 'cancelled' ? 'rgba(239,68,68,0.1)' : 'var(--bg-input)',
                      color: order.status === 'completed' ? '#10b981' : order.status === 'pending' ? '#f59e0b' : order.status === 'cancelled' ? '#ef4444' : 'var(--text-muted)',
                    }}>
                      {order.status === 'completed' ? 'مكتمل' : order.status === 'pending' ? 'معلق' : order.status === 'processing' ? 'قيد التنفيذ' : order.status === 'cancelled' ? 'ملغي' : order.status === 'refunded' ? 'مسترد' : order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>{order.payment_method === 'cash' ? 'نقدي' : order.payment_method === 'card' ? 'بطاقة' : order.payment_method === 'split' ? 'تقسيم' : order.payment_method === 'link' ? 'رابط' : order.payment_method === 'deferred' ? 'آجل' : order.payment_method || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-bold px-2 py-1 rounded" style={{
                      background: order.payment_status === 'paid' ? 'rgba(16,185,129,0.1)' : order.payment_status === 'deferred' ? 'rgba(245,158,11,0.1)' : 'rgba(107,114,128,0.1)',
                      color: order.payment_status === 'paid' ? '#10b981' : order.payment_status === 'deferred' ? '#f59e0b' : 'var(--text-muted)',
                    }}>
                      {order.payment_status === 'paid' ? 'مدفوع' : order.payment_status === 'deferred' ? 'آجل' : order.payment_status === 'pending' ? 'في الانتظار' : order.payment_status || '—'}
                    </span>
                    {order.payment_status === 'deferred' && (
                      <button onClick={(e) => { e.stopPropagation(); handleMarkAsPaid(order.id) }} disabled={markingPaid === order.id}
                        className="mr-2 text-xs font-bold px-2 py-1 rounded transition-all hover:opacity-80"
                        style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                        {markingPaid === order.id ? <Loader2 className="w-3 h-3 animate-spin inline" /> : <><CheckCircle className="w-3 h-3 inline ml-1" />تسديد</>}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{formatEGP(order.total)}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>{order.cashier_name || '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>لا توجد طلبات</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="p-5 rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>تفاصيل الطلب {selectedOrder.order_ref}</h3>
              <button onClick={() => setSelectedOrder(null)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span style={{ color: 'var(--text-muted)' }}>الحالة:</span> <span className="font-bold" style={{ color: 'var(--text-heading)' }}>{selectedOrder.status}</span></div>
                <div><span style={{ color: 'var(--text-muted)' }}>العميل:</span> <span className="font-bold" style={{ color: 'var(--text-heading)' }}>{selectedOrder.customer_name || '—'}</span></div>
                <div><span style={{ color: 'var(--text-muted)' }}>الدفع:</span> <span className="font-bold" style={{ color: 'var(--text-heading)' }}>{selectedOrder.payment_method === 'cash' ? 'نقدي' : selectedOrder.payment_method === 'deferred' ? 'آجل' : selectedOrder.payment_method === 'link' ? 'رابط' : selectedOrder.payment_method === 'split' ? 'تقسيم' : selectedOrder.payment_method || '—'}</span></div>
                <div><span style={{ color: 'var(--text-muted)' }}>حالة الدفع:</span> <span className="font-bold" style={{ color: selectedOrder.payment_status === 'deferred' ? '#f59e0b' : selectedOrder.payment_status === 'paid' ? '#10b981' : 'var(--text-heading)' }}>{selectedOrder.payment_status === 'paid' ? 'مدفوع' : selectedOrder.payment_status === 'deferred' ? 'آجل' : selectedOrder.payment_status || '—'}</span></div>
                <div><span style={{ color: 'var(--text-muted)' }}>الكاشير:</span> <span className="font-bold" style={{ color: 'var(--text-heading)' }}>{selectedOrder.cashier_name || '—'}</span></div>
                <div><span style={{ color: 'var(--text-muted)' }}>التاريخ:</span> <span className="font-bold" style={{ color: 'var(--text-heading)' }}>{selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('ar-EG') : '—'}</span></div>
              </div>
              {selectedOrder.payment_status === 'deferred' && (
                <button onClick={() => handleMarkAsPaid(selectedOrder.id)} disabled={markingPaid === selectedOrder.id}
                  className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90"
                  style={{ background: '#10b981', color: '#fff' }}>
                  {markingPaid === selectedOrder.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4" />تسديد هذا الطلب</>}
                </button>
              )}
              <div className="border-t pt-3 space-y-2" style={{ borderColor: 'var(--border-light)' }}>
                {(selectedOrder.items || []).map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--text-main)' }}>{item.product_name} × {item.quantity}</span>
                    <span className="font-bold" style={{ color: 'var(--text-heading)' }}>{formatEGP(item.line_total)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-3 space-y-1" style={{ borderColor: 'var(--border-light)' }}>
                <div className="flex justify-between text-sm"><span style={{ color: 'var(--text-muted)' }}>المجموع</span><span style={{ color: 'var(--text-main)' }}>{formatEGP(selectedOrder.subtotal)}</span></div>
                {selectedOrder.tax_amount > 0 && <div className="flex justify-between text-sm"><span style={{ color: 'var(--text-muted)' }}>الضريبة</span><span style={{ color: 'var(--text-main)' }}>{formatEGP(selectedOrder.tax_amount)}</span></div>}
                {selectedOrder.discount_amount > 0 && <div className="flex justify-between text-sm"><span style={{ color: 'var(--text-muted)' }}>الخصم</span><span style={{ color: 'var(--text-muted)' }}>-{formatEGP(selectedOrder.discount_amount)}</span></div>}
                <div className="flex justify-between text-base font-black pt-1 border-t" style={{ borderColor: 'var(--border-light)', color: 'var(--text-heading)' }}>
                  <span>الإجمالي</span><span>{formatEGP(selectedOrder.total)}</span>
                </div>
              </div>
              {selectedOrder.notes && <p className="text-sm p-3 rounded-lg" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>{selectedOrder.notes}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
