import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const db = supabase

/* ═══ Branches ═══ */
export function useBranches(tenantId?: string | null) {
  const [branches, setBranches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('branches').select('*').eq('is_active', true).order('is_main', { ascending: false }).order('name')
    if (tenantId) q = q.eq('tenant_id', tenantId)
    const { data } = await q
    if (data) setBranches(data)
    setLoading(false)
  }, [tenantId])
  useEffect(() => { fetch() }, [fetch])
  const add = async (b: any) => { const { data, error } = await supabase.from('branches').insert(b).select().single(); if (!error) await fetch(); return { data, error } }
  const update = async (id: string, u: any) => { await supabase.from('branches').update(u).eq('id', id); await fetch() }
  const remove = async (id: string) => { await supabase.from('branches').update({ is_active: false }).eq('id', id); await fetch() }
  return { branches, loading, fetch, add, update, remove }
}

/* ═══ Warehouses ═══ */
export function useWarehouses(tenantId?: string | null) {
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('warehouses').select('*, branch:branches(name)').eq('is_active', true).order('name')
    if (tenantId) q = q.eq('tenant_id', tenantId)
    const { data } = await q
    if (data) setWarehouses(data)
    setLoading(false)
  }, [tenantId])
  useEffect(() => { fetch() }, [fetch])
  const add = async (w: any) => { const { data, error } = await supabase.from('warehouses').insert(w).select().single(); if (!error) await fetch(); return { data, error } }
  const update = async (id: string, u: any) => { await supabase.from('warehouses').update(u).eq('id', id); await fetch() }
  return { warehouses, loading, fetch, add, update }
}

/* ═══ Stock Locations ═══ */
export function useStockLocations(productId?: string, warehouseId?: string) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('stock_locations').select('*, warehouse:warehouses(name)')
    if (productId) q = q.eq('product_id', productId)
    if (warehouseId) q = q.eq('warehouse_id', warehouseId)
    const { data } = await q
    if (data) setItems(data)
    setLoading(false)
  }, [productId, warehouseId])
  useEffect(() => { fetch() }, [fetch])
  const upsert = async (s: any) => { const { data, error } = await supabase.from('stock_locations').upsert(s).select().single(); if (!error) await fetch(); return { data, error } }
  return { items, loading, fetch, upsert }
}

/* ═══ Stock Transfers ═══ */
export function useStockTransfers(tenantId?: string | null) {
  const [transfers, setTransfers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('stock_transfers').select('*').order('created_at', { ascending: false }).limit(200)
    if (tenantId) q = q.eq('tenant_id', tenantId)
    const { data } = await q
    if (data) setTransfers(data)
    setLoading(false)
  }, [tenantId])
  useEffect(() => { fetch() }, [fetch])
  const create = async (t: any) => {
    const { data, error } = await supabase.from('stock_transfers').insert(t).select().single()
    if (!error) await fetch()
    return { data, error }
  }
  const complete = async (id: string) => {
    // Get transfer details
    const { data: transfer } = await supabase.from('stock_transfers').select('*').eq('id', id).single()
    if (!transfer) return
    // Decrease from source
    const { data: srcStock } = await supabase.from('stock_locations').select('*').eq('product_id', transfer.product_id).eq('warehouse_id', transfer.from_warehouse_id).maybeSingle()
    if (srcStock) {
      await supabase.from('stock_locations').update({ quantity: Math.max(0, srcStock.quantity - transfer.quantity) }).eq('id', srcStock.id)
    }
    // Increase at destination
    const { data: dstStock } = await supabase.from('stock_locations').select('*').eq('product_id', transfer.product_id).eq('warehouse_id', transfer.to_warehouse_id).maybeSingle()
    if (dstStock) {
      await supabase.from('stock_locations').update({ quantity: dstStock.quantity + transfer.quantity }).eq('id', dstStock.id)
    } else {
      await supabase.from('stock_locations').insert({ tenant_id: transfer.tenant_id, product_id: transfer.product_id, warehouse_id: transfer.to_warehouse_id, quantity: transfer.quantity })
    }
    await supabase.from('stock_transfers').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id)
    await fetch()
  }
  return { transfers, loading, fetch, create, complete }
}

/* ═══ Suppliers ═══ */
export function useSuppliers(tenantId?: string | null) {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('suppliers').select('*').eq('is_active', true).order('name')
    if (tenantId) q = q.eq('tenant_id', tenantId)
    const { data } = await q
    if (data) setSuppliers(data)
    setLoading(false)
  }, [tenantId])
  useEffect(() => { fetch() }, [fetch])
  const add = async (s: any) => { const { data, error } = await supabase.from('suppliers').insert(s).select().single(); if (!error) await fetch(); return { data, error } }
  const update = async (id: string, u: any) => { const { data, error } = await supabase.from('suppliers').update(u).eq('id', id).select().single(); if (!error) await fetch(); return { data, error } }
  const remove = async (id: string) => { await supabase.from('suppliers').update({ is_active: false }).eq('id', id); await fetch() }
  return { suppliers, loading, fetch, add, update, remove }
}

/* ═══ Purchase Orders ═══ */
export function usePurchaseOrders(tenantId?: string | null) {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const normalizePurchaseOrder = (record: any) => ({
    ...record,
    po_ref: record.po_number,
    supplier_name: record.supplier?.name || record.supplier_name || '',
    total_amount: record.total ?? record.subtotal ?? 0,
  })

  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('purchase_orders').select('*, supplier:suppliers(name), items:purchase_order_items(*)').order('created_at', { ascending: false }).limit(200)
    if (tenantId) q = q.eq('tenant_id', tenantId)
    const { data } = await q
    if (data) setOrders(data.map(normalizePurchaseOrder))
    setLoading(false)
  }, [tenantId])
  useEffect(() => { fetch() }, [fetch])
  const create = async (po: any, items: any[]) => {
    const subtotal = Number(po.total_amount ?? items.reduce((sum, item) => sum + Number(item.line_total || 0), 0))
    const payload = {
      tenant_id: po.tenant_id,
      supplier_id: po.supplier_id,
      po_number: po.po_number || `PO-${Date.now()}`,
      status: po.status || 'draft',
      notes: po.notes || null,
      expected_date: po.expected_date || null,
      subtotal,
      tax_amount: Number(po.tax_amount || 0),
      total: subtotal + Number(po.tax_amount || 0),
      created_by: po.created_by || null,
    }
    const { data, error } = await supabase.from('purchase_orders').insert(payload).select('*, supplier:suppliers(name), items:purchase_order_items(*)').single()
    if (error || !data) return { data: null, error }
    for (const item of items) {
      await supabase.from('purchase_order_items').insert({ ...item, purchase_order_id: data.id })
    }
    await fetch()
    return { data: normalizePurchaseOrder(data), error: null }
  }
  const updateStatus = async (id: string, status: string) => {
    await supabase.from('purchase_orders').update({ status, ...(status === 'received' ? { received_at: new Date().toISOString() } : {}) }).eq('id', id)
    await fetch()
  }
  return { orders, loading, fetch, create, updateStatus }
}

/* ═══ Supplier Payments ═══ */
export function useSupplierPayments(supplierId?: string) {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('supplier_payments').select('*').order('paid_at', { ascending: false })
    if (supplierId) q = q.eq('supplier_id', supplierId)
    const { data } = await q
    if (data) setPayments(data)
    setLoading(false)
  }, [supplierId])
  useEffect(() => { fetch() }, [fetch])
  const add = async (p: any) => {
    const { data, error } = await supabase.from('supplier_payments').insert(p).select().single()
    if (!error && p.supplier_id) {
      // Update supplier balance
      const { data: supplier } = await supabase.from('suppliers').select('balance').eq('id', p.supplier_id).single()
      if (supplier) {
        await supabase.from('suppliers').update({ balance: (supplier.balance || 0) - p.amount }).eq('id', p.supplier_id)
      }
    }
    if (!error) await fetch()
    return { data, error }
  }
  return { payments, loading, fetch, add }
}

/* ═══ Shifts ═══ */
export function useShifts(tenantId?: string | null, branchId?: string | null) {
  const [shifts, setShifts] = useState<any[]>([])
  const [activeShift, setActiveShift] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('shifts').select('*').order('opened_at', { ascending: false }).limit(100)
    if (tenantId) q = q.eq('tenant_id', tenantId)
    if (branchId) q = q.eq('branch_id', branchId)
    const { data } = await q
    if (data) {
      setShifts(data)
      setActiveShift(data.find((s: any) => s.status === 'open') || null)
    }
    setLoading(false)
  }, [tenantId, branchId])

  useEffect(() => { fetch() }, [fetch])

  const openShift = async (payload: { tenant_id: string; branch_id: string; cashier_id: string; cashier_name: string; starting_cash: number }) => {
    const { data, error } = await supabase.from('shifts').insert({ ...payload, status: 'open' }).select().single()
    if (!error) { setActiveShift(data); await fetch() }
    return { data, error }
  }

  const closeShift = async (id: string, actual_cash: number, notes?: string) => {
    // Calculate expected cash
    const shift = shifts.find(s => s.id === id)
    if (!shift) return
    const expected = shift.starting_cash + shift.total_sales - shift.total_refunds
    await supabase.from('shifts').update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      actual_cash,
      expected_cash: expected,
      cash_difference: actual_cash - expected,
      notes,
    }).eq('id', id)
    setActiveShift(null)
    await fetch()
  }

  const updateShiftTotals = async (id: string, saleAmount: number) => {
    const shift = shifts.find(s => s.id === id)
    if (!shift) return
    await supabase.from('shifts').update({
      total_sales: (shift.total_sales || 0) + saleAmount,
      total_orders: (shift.total_orders || 0) + 1,
    }).eq('id', id)
    await fetch()
  }

  return { shifts, activeShift, loading, fetch, openShift, closeShift, updateShiftTotals }
}

/* ═══ Activity Log ═══ */
export function useActivityLog(tenantId?: string | null) {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(500)
    if (tenantId) q = q.eq('tenant_id', tenantId)
    const { data } = await q
    if (data) setLogs(data)
    setLoading(false)
  }, [tenantId])
  useEffect(() => { fetch() }, [fetch])
  return { logs, loading, fetch }
}

export async function logActivity(payload: {
  tenant_id?: string
  user_id?: string
  user_name?: string
  action: string
  entity_type: string
  entity_id?: string
  details?: any
}) {
  await supabase.from('activity_logs').insert(payload)
}

/* ═══ Returns ═══ */
export function useReturns(tenantId?: string | null, branchId?: string | null) {
  const [returns, setReturns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const fetch = useCallback(async () => {
    setLoading(true)
    let q = db.from('returns').select('*, items:return_items(*), order:orders(order_ref, branch_id)').order('created_at', { ascending: false }).limit(200)
    if (tenantId) q = q.eq('tenant_id', tenantId)
    if (branchId) q = q.eq('branch_id', branchId)
    const { data } = await q
    if (data) setReturns(data)
    setLoading(false)
  }, [tenantId, branchId])
  useEffect(() => { fetch() }, [fetch])
  const create = async (ret: any, items: any[]) => {
    const { data, error } = await db.from('returns').insert(ret).select().single()
    if (error || !data) return { data: null, error }

    const { data: orderRow } = await db.from('orders').select('id, tenant_id, branch_id').eq('id', ret.order_id).maybeSingle()
    const effectiveTenantId = ret.tenant_id || orderRow?.tenant_id || tenantId || null
    const effectiveBranchId = ret.branch_id || orderRow?.branch_id || branchId || null

    for (const item of items) {
      await db.from('return_items').insert({ ...item, return_id: data.id })

      const { data: orderItem } = await db
        .from('order_items')
        .select('product_id, quantity')
        .eq('id', item.order_item_id)
        .maybeSingle()

      if (!orderItem?.product_id || !effectiveBranchId) continue

      const { data: warehouse } = await db
        .from('warehouses')
        .select('id')
        .eq('branch_id', effectiveBranchId)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (!warehouse?.id) continue

      const { data: stockRow } = await db
        .from('stock_locations')
        .select('id, quantity')
        .eq('warehouse_id', warehouse.id)
        .eq('product_id', orderItem.product_id)
        .maybeSingle()

      if (stockRow?.id) {
        await db.from('stock_locations').update({ quantity: Number(stockRow.quantity || 0) + Number(item.quantity || orderItem.quantity || 0) }).eq('id', stockRow.id)
      } else {
        await db.from('stock_locations').insert({
          tenant_id: effectiveTenantId,
          warehouse_id: warehouse.id,
          product_id: orderItem.product_id,
          quantity: Number(item.quantity || orderItem.quantity || 0),
        })
      }
    }

    await db.from('expenses').insert({
      tenant_id: effectiveTenantId,
      branch_id: effectiveBranchId,
      category: 'مرتجعات',
      amount: Math.abs(Number(ret.refund_amount || 0)),
      description: `مرتجع ${ret.return_ref || data.id}`,
      expense_date: new Date().toISOString().slice(0, 10),
      status: 'paid',
      is_recurring: false,
      created_by: 'system',
    })

    // Update order return_status
    await db.from('orders').update({ return_status: 'returned' }).eq('id', ret.order_id)
    await fetch()
    return { data, error: null }
  }
  return { returns, loading, fetch, create }
}

/* ═══ Promo Codes ═══ */
export function usePromoCodes(tenantId?: string | null) {
  const [codes, setCodes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const fetch = useCallback(async () => {
    setLoading(true)
    let q = db.from('promo_codes').select('*').order('created_at', { ascending: false })
    if (tenantId) q = q.eq('tenant_id', tenantId)
    const { data } = await q
    if (data) setCodes(data)
    setLoading(false)
  }, [tenantId])
  useEffect(() => { fetch() }, [fetch])
  const add = async (c: any) => { const { data, error } = await db.from('promo_codes').insert(c).select().single(); if (!error) await fetch(); return { data, error } }
  const update = async (id: string, u: any) => { const { data, error } = await db.from('promo_codes').update(u).eq('id', id).select().single(); if (!error) await fetch(); return { data, error } }
  const remove = async (id: string) => { await db.from('promo_codes').update({ is_active: false }).eq('id', id); await fetch() }
  const validate = async (code: string, orderAmount: number): Promise<{ valid: boolean; discount_type?: string; discount_value?: number; error?: string }> => {
    const { data } = await db.from('promo_codes').select('*').eq('code', code.toUpperCase()).eq('is_active', true).maybeSingle()
    if (!data) return { valid: false, error: 'كود غير صالح' }
    if (data.valid_until && new Date(data.valid_until) < new Date()) return { valid: false, error: 'انتهت صلاحية الكود' }
    if (data.max_uses && data.used_count >= data.max_uses) return { valid: false, error: 'تم استنفاذ عدد الاستخدامات' }
    if (data.min_order_amount && orderAmount < data.min_order_amount) return { valid: false, error: `الحد الأدنى للطلب ${data.min_order_amount}` }
    return { valid: true, discount_type: data.discount_type, discount_value: data.discount_value }
  }
  const use = async (id: string) => {
    const promo = codes.find(c => c.id === id)
    if (promo) await db.from('promo_codes').update({ used_count: (promo.used_count || 0) + 1 }).eq('id', id)
  }
  return { codes, loading, fetch, add, update, remove, validate, use }
}

/* ═══ Notifications ═══ */
function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
    void ctx
  } catch { /* audio blocked */ }
}

export function useNotifications(tenantId?: string | null, userId?: string) {
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    let q = db.from('notifications').select('*').order('created_at', { ascending: false }).limit(100)
    if (tenantId) q = q.eq('tenant_id', tenantId)
    if (userId) q = q.or(`user_id.eq.${userId},user_id.is.null`)
    const { data } = await q
    if (data) {
      setNotifications(data)
      setUnreadCount(data.filter((n: any) => !n.is_read).length)
    }
    setLoading(false)
  }, [tenantId, userId])

  useEffect(() => { fetch() }, [fetch])

  // Real-time subscription
  useEffect(() => {
    if (!tenantId || !userId) return
    let channel: any
    const setupRealtime = async () => {
      try {
        channel = db.channel(`notifications:tenant:${tenantId}:user:${userId}`, {
          config: { broadcast: { self: true } }
        })
        channel.on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `tenant_id=eq.${tenantId}`,
        }, (payload: any) => {
          const n = payload.new as any
          // Filter: show if user_id matches or is null (broadcast)
          if (n.user_id && n.user_id !== userId) return
          setNotifications(prev => [n, ...prev])
          setUnreadCount(prev => prev + 1)
          playNotifSound()
        })
        await channel.subscribe()
      } catch (err) {
        console.error('Realtime subscription error:', err)
      }
    }
    setupRealtime()
    return () => { if (channel) db.removeChannel(channel) }
  }, [tenantId, userId])

  const markRead = async (id: string) => {
    await db.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }
  const markAllRead = async () => {
    let q = db.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('is_read', false)
    if (tenantId) q = q.eq('tenant_id', tenantId)
    await q
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }
  return { notifications, unreadCount, loading, fetch, markRead, markAllRead }
}

export async function createNotification(payload: { tenant_id?: string; user_id?: string; title: string; body?: string; type?: string; link?: string }) {
  await db.from('notifications').insert(payload)
}

/* ═══ Sync Staging (Offline Approval Queue) ═══ */
export function useSyncStaging(tenantId?: string | null) {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('sync_staging').select('*').order('created_at', { ascending: false })
    if (tenantId) q = q.eq('tenant_id', tenantId)
    const { data } = await q
    if (data) setEntries(data)
    setLoading(false)
  }, [tenantId])

  useEffect(() => { fetch() }, [fetch])

  const pending = entries.filter(e => e.status === 'pending')
  const approved = entries.filter(e => e.status === 'approved')
  const rejected = entries.filter(e => e.status === 'rejected')

  return { entries, pending, approved, rejected, loading, fetch }
}
