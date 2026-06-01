import Dexie, { type EntityTable } from 'dexie'

/* ── Offline-first IndexedDB schema for POS operations ── */

export interface OfflineProduct {
  id: string
  name: string
  barcode: string | null
  sku: string | null
  selling_price: number

  category_id: string | null
  category_name: string | null
  primary_image_url: string | null
  is_active: boolean
  track_stock: boolean
  stock: number | null
  low_stock_threshold: number | null
  tenant_id: string | null
  synced_at: number
}

export interface OfflineCategory {
  id: string
  name: string
  slug: string
  color_hex: string | null
  sort_order: number
  applies_to: string
  is_active: boolean
  tenant_id: string | null
  synced_at: number
}

export interface OfflineOrder {
  id: string
  order_ref: string
  status: string
  type: string
  customer_name: string | null
  customer_phone: string | null
  subtotal: number
  tax_amount: number
  discount_amount: number
  total: number
  payment_method: string | null
  split_payments: string | null // JSON string
  payment_status: string
  cashier_name: string | null
  cashier_id: string | null
  shift_id: string | null
  branch_id: string | null
  tenant_id: string | null
  notes: string | null
  created_at: string
  synced: 0 | 1 // 0 = pending sync, 1 = synced
}

export interface OfflineOrderItem {
  id: string
  order_id: string
  product_id: string | null
  product_name: string
  quantity: number
  unit_price: number
  line_total: number
  notes: string | null
  synced: 0 | 1
}

export interface OfflineHeldCart {
  id: string
  name: string
  items: string // JSON serialized cart items
  discount_value: number
  discount_type: string
  notes: string
  held_at: string
  tenant_id: string | null
}

class AppOfflineDB extends Dexie {
  products!: EntityTable<OfflineProduct, 'id'>
  categories!: EntityTable<OfflineCategory, 'id'>
  orders!: EntityTable<OfflineOrder, 'id'>
  orderItems!: EntityTable<OfflineOrderItem, 'id'>
  heldCarts!: EntityTable<OfflineHeldCart, 'id'>

  constructor() {
    super('app-pos-offline')

    this.version(1).stores({
      products: 'id, barcode, sku, category_id, tenant_id, is_active',
      categories: 'id, slug, tenant_id, applies_to, sort_order',
      orders: 'id, order_ref, synced, tenant_id, shift_id, created_at',
      orderItems: 'id, order_id, synced',
      heldCarts: 'id, tenant_id',
    })
  }
}

export const offlineDb = new AppOfflineDB()
