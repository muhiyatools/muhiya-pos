import { supabase } from './supabase'
import { offlineDb } from './offlineDb'
import type { OfflineProduct, OfflineCategory } from './offlineDb'

/* ── Sync engine: bridges IndexedDB ↔ Supabase ── */

let syncInterval: ReturnType<typeof setInterval> | null = null
let isOnline = navigator.onLine

// Track online status
window.addEventListener('online', () => { isOnline = true; syncPendingOrders() })
window.addEventListener('offline', () => { isOnline = false })

/** Pull products from Supabase → IndexedDB */
export async function syncProductsDown(): Promise<void> {
  if (!isOnline) return
  try {
    const { data } = await supabase
      .from('products')
      .select('*, category:categories(name)')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name')

    if (!data) return

    const now = Date.now()
    const offlineProducts: OfflineProduct[] = data.map((p: any) => ({
      id: p.id,
      name: p.name,
      barcode: p.barcode || null,
      sku: p.sku || null,
      selling_price: p.selling_price,

      category_id: p.category_id || null,
      category_name: p.category?.name || null,
      primary_image_url: p.primary_image_url || null,
      is_active: p.is_active,
      track_stock: p.track_stock || false,
      stock: p.stock ?? null,
      low_stock_threshold: p.low_stock_threshold ?? null,
      tenant_id: p.tenant_id || null,
      synced_at: now,
    }))

    await offlineDb.products.clear()
    await offlineDb.products.bulkPut(offlineProducts)
  } catch (err) {
    console.warn('[sync] products down failed:', err)
  }
}

/** Pull categories from Supabase → IndexedDB */
export async function syncCategoriesDown(): Promise<void> {
  if (!isOnline) return
  try {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order')
      .order('name')

    if (!data) return

    const now = Date.now()
    const offlineCats: OfflineCategory[] = data.map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      color_hex: c.color_hex || null,
      sort_order: c.sort_order || 0,
      applies_to: c.applies_to || 'all',
      is_active: c.is_active,
      tenant_id: c.tenant_id || null,
      synced_at: now,
    }))

    await offlineDb.categories.clear()
    await offlineDb.categories.bulkPut(offlineCats)
  } catch (err) {
    console.warn('[sync] categories down failed:', err)
  }
}

/** Push pending offline orders directly to Supabase orders table (bypass staging) */
export async function syncPendingOrders(): Promise<number> {
  if (!isOnline) return 0
  let synced = 0

  try {
    const pendingOrders = await offlineDb.orders.where('synced').equals(0).toArray()
    
    for (const order of pendingOrders) {
      try {
        // Gather order items
        const items = await offlineDb.orderItems.where('order_id').equals(order.id).toArray()

        // Build order payload for direct insert
        const orderPayload: any = {
          order_ref: order.order_ref,
          status: order.status,
          type: order.type,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          subtotal: order.subtotal,
          tax_amount: order.tax_amount,
          discount_amount: order.discount_amount,
          total: order.total,
          payment_method: order.payment_method,
          payment_status: order.payment_status,
          cashier_name: order.cashier_name,
          cashier_id: order.cashier_id,
          shift_id: order.shift_id,
          branch_id: order.branch_id,
          tenant_id: order.tenant_id,
          notes: order.notes,
          split_payments: order.split_payments ? JSON.parse(order.split_payments) : null,
          created_at: order.created_at,
        }

        // Insert directly into orders table
        const { data: remoteOrder, error: orderErr } = await supabase
          .from('orders')
          .insert(orderPayload)
          .select()
          .single()

        if (orderErr || !remoteOrder) {
          console.warn('[sync] direct order insert failed:', order.order_ref, orderErr)
          continue
        }

        // Insert items
        for (const item of items) {
          await supabase.from('order_items').insert({
            order_id: remoteOrder.id,
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            line_total: item.line_total,
            notes: item.notes,
          })
        }

        // Income entry (only for paid orders)
        if (order.payment_status === 'paid') {
          await supabase.from('income_entries').insert({
            source: 'sales',
            amount: order.total,
            description: `طلب ${order.order_ref}`,
            income_date: (order.created_at || new Date().toISOString()).split('T')[0],
            is_recurring: false,
            ...(order.tenant_id ? { tenant_id: order.tenant_id } : {}),
            ...(order.branch_id ? { branch_id: order.branch_id } : {}),
          })
        }

        // Deduct warehouse stock
        if (order.branch_id && items.length > 0) {
          try {
            const { data: wh } = await supabase
              .from('warehouses')
              .select('id')
              .eq('branch_id', order.branch_id)
              .eq('is_active', true)
              .limit(1)
              .maybeSingle()
            if (wh) {
              for (const item of items) {
                if (!item.product_id) continue
                const { data: stock } = await supabase
                  .from('stock_locations')
                  .select('id, quantity')
                  .eq('warehouse_id', wh.id)
                  .eq('product_id', item.product_id)
                  .maybeSingle()
                if (stock) {
                  await supabase.from('stock_locations').update({
                    quantity: Math.max(0, Number(stock.quantity || 0) - Number(item.quantity || 0)),
                  }).eq('id', stock.id)
                }
              }
            }
          } catch (stockErr) {
            console.warn('[sync] stock deduction failed:', stockErr)
          }
        }

        // Mark as fully synced (2 = directly inserted, not staged)
        await offlineDb.orders.update(order.id, { synced: 2 })
        for (const item of items) {
          await offlineDb.orderItems.update(item.id, { synced: 2 })
        }
        synced++
      } catch (e) {
        console.warn('[sync] single order sync failed:', e)
      }
    }
  } catch (err) {
    console.warn('[sync] pending orders push failed:', err)
  }

  return synced
}

/** Approve a staged action: write to real tables, then mark as approved */
export async function approveStaged(stagingId: string, reviewerId: string): Promise<boolean> {
  try {
    // Get the staging entry
    const { data: entry, error } = await (supabase as any)
      .from('sync_staging')
      .select('*')
      .eq('id', stagingId)
      .single()

    if (error || !entry || entry.status !== 'pending') return false

    const { order, items } = entry.payload as any

    // Insert order
    const orderPayload: any = { ...order }
    delete orderPayload.created_at // let Supabase set it
    if (orderPayload.split_payments && typeof orderPayload.split_payments === 'string') {
      orderPayload.split_payments = JSON.parse(orderPayload.split_payments)
    }

    const { data: remoteOrder, error: orderErr } = await supabase
      .from('orders')
      .insert(orderPayload)
      .select()
      .single()

    if (orderErr || !remoteOrder) {
      console.error('[sync] approve order insert failed:', orderErr)
      return false
    }

    // Insert items
    for (const item of items) {
      await supabase.from('order_items').insert({
        order_id: remoteOrder.id,
        ...item,
      })
    }

    // Income entry
    await supabase.from('income_entries').insert({
      source: 'sales',
      amount: order.total,
      description: `طلب ${order.order_ref}`,
      income_date: (order.created_at || new Date().toISOString()).split('T')[0],
      is_recurring: false,
      ...(order.tenant_id ? { tenant_id: order.tenant_id } : {}),
      ...(order.branch_id ? { branch_id: order.branch_id } : {}),
    })

    // Deduct warehouse stock
    if (order.branch_id && items.length > 0) {
      try {
        const { data: wh } = await supabase
          .from('warehouses')
          .select('id')
          .eq('branch_id', order.branch_id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle()
        if (wh) {
          for (const item of items) {
            if (!item.product_id) continue
            const { data: stock } = await supabase
              .from('stock_locations')
              .select('id, quantity')
              .eq('warehouse_id', wh.id)
              .eq('product_id', item.product_id)
              .maybeSingle()
            if (stock) {
              await supabase.from('stock_locations').update({
                quantity: Math.max(0, Number(stock.quantity || 0) - Number(item.quantity || 0)),
              }).eq('id', stock.id)
            }
          }
        }
      } catch (stockErr) {
        console.warn('[sync] stock deduction failed:', stockErr)
      }
    }

    // Mark staging entry as approved
    await (supabase as any).from('sync_staging').update({
      status: 'approved',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      synced_at: new Date().toISOString(),
    }).eq('id', stagingId)

    return true
  } catch (err) {
    console.error('[sync] approve failed:', err)
    return false
  }
}

/** Reject a staged action */
export async function rejectStaged(stagingId: string, reviewerId: string, notes?: string): Promise<boolean> {
  const { error } = await (supabase as any).from('sync_staging').update({
    status: 'rejected',
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString(),
    review_notes: notes || null,
  }).eq('id', stagingId)
  return !error
}

/** Full sync: pull products + categories, push pending orders */
export async function fullSync(): Promise<void> {
  await Promise.all([syncProductsDown(), syncCategoriesDown()])
  await syncPendingOrders()
}

/** Start background sync interval (every 30s) */
export function startSyncLoop(intervalMs = 30_000): void {
  if (syncInterval) return
  fullSync()
  syncInterval = setInterval(fullSync, intervalMs)
}

/** Stop background sync */
export function stopSyncLoop(): void {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
}

/** Get online status */
export function getOnlineStatus(): boolean {
  return isOnline
}

/** Get count of pending (unsynced) orders */
export async function getPendingSyncCount(): Promise<number> {
  return offlineDb.orders.where('synced').equals(0).count()
}
