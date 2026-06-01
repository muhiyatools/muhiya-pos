import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { offlineDb } from '../lib/offlineDb'
import type { OfflineOrder, OfflineOrderItem, OfflineHeldCart } from '../lib/offlineDb'

export interface POSCartItem {
  id: string
  product_id: string
  name: string
  price: number

  quantity: number
  image_url: string | null
  addOns: { id: string; name: string; extra_price: number }[]
  item_discount: number
  item_discount_type: 'flat' | 'percent'
  notes: string
}

export interface SplitPayment {
  method: string
  amount: number
}

export interface HeldCart {
  id: string
  name: string
  items: POSCartItem[]
  discount_value: number
  discount_type: 'flat' | 'percent'
  promo_code: string | null
  notes: string
  held_at: string
}

interface POSCartStore {
  items: POSCartItem[]
  discountValue: number
  discountType: 'flat' | 'percent'
  promoCode: string | null
  promoDiscount: { type: string; value: number } | null
  orderNotes: string
  paymentMethod: string
  splitPayments: SplitPayment[]
  heldCarts: HeldCart[]

  // Actions
  addItem: (item: Omit<POSCartItem, 'quantity' | 'item_discount' | 'item_discount_type' | 'notes'>) => void
  updateItemQty: (productId: string, addOnKey: string, delta: number) => void
  removeItem: (productId: string, addOnKey: string) => void
  setItemDiscount: (productId: string, addOnKey: string, value: number, type: 'flat' | 'percent') => void
  setItemNotes: (productId: string, addOnKey: string, notes: string) => void
  clearCart: () => void
  setDiscount: (value: number, type: 'flat' | 'percent') => void
  setPromoCode: (code: string | null, discount?: { type: string; value: number }) => void
  setNotes: (notes: string) => void
  setPaymentMethod: (method: string) => void
  addSplitPayment: (payment: SplitPayment) => void
  removeSplitPayment: (index: number) => void
  clearSplitPayments: () => void

  // Hold / Resume
  holdCart: (name?: string) => void
  resumeCart: (id: string) => void
  removeHeldCart: (id: string) => void
  loadHeldCarts: () => Promise<void>

  // Offline checkout
  checkoutOffline: (params: {
    taxRate: number
    cashierName: string | null
    cashierId: string | null
    shiftId: string | null
    branchId: string | null
    tenantId: string | null
    paymentMethod?: string
    paymentStatus?: string
  }) => Promise<{ order: OfflineOrder; items: OfflineOrderItem[] }>

  // Computed
  getSubtotal: () => number
  getItemDiscountTotal: () => number
  getOrderDiscountAmount: () => number
  getPromoDiscountAmount: () => number
  getTaxAmount: (taxRate: number) => number
  getTotal: (taxRate: number) => number
}

function addOnKey(addOns: { id: string }[]): string {
  return addOns.map(a => a.id).sort().join(',')
}

export const usePOSCartStore = create<POSCartStore>((set, get) => ({
  items: [],
  discountValue: 0,
  discountType: 'flat',
  promoCode: null,
  promoDiscount: null,
  orderNotes: '',
  paymentMethod: 'cash',
  splitPayments: [],
  heldCarts: [],

  addItem: (item) => {
    set((state) => {
      const key = addOnKey(item.addOns)
      const existing = state.items.find(i => i.product_id === item.product_id && addOnKey(i.addOns) === key)
      if (existing) {
        return { items: state.items.map(i => (i.product_id === item.product_id && addOnKey(i.addOns) === key) ? { ...i, quantity: i.quantity + 1 } : i) }
      }
      return { items: [...state.items, { ...item, id: uuidv4(), quantity: 1, item_discount: 0, item_discount_type: 'flat' as const, notes: '' }] }
    })
  },

  updateItemQty: (productId, aoKey, delta) => {
    set((state) => {
      const updated = state.items.map(i => {
        if (i.product_id === productId && addOnKey(i.addOns) === aoKey) {
          return { ...i, quantity: Math.max(0, i.quantity + delta) }
        }
        return i
      }).filter(i => i.quantity > 0)
      return { items: updated }
    })
  },

  removeItem: (productId, aoKey) => {
    set(state => ({ items: state.items.filter(i => !(i.product_id === productId && addOnKey(i.addOns) === aoKey)) }))
  },

  setItemDiscount: (productId, aoKey, value, type) => {
    set(state => ({
      items: state.items.map(i => (i.product_id === productId && addOnKey(i.addOns) === aoKey) ? { ...i, item_discount: value, item_discount_type: type } : i)
    }))
  },

  setItemNotes: (productId, aoKey, notes) => {
    set(state => ({
      items: state.items.map(i => (i.product_id === productId && addOnKey(i.addOns) === aoKey) ? { ...i, notes } : i)
    }))
  },

  clearCart: () => set({ items: [], discountValue: 0, discountType: 'flat', promoCode: null, promoDiscount: null, orderNotes: '', paymentMethod: 'cash', splitPayments: [] }),

  setDiscount: (value, type) => set({ discountValue: value, discountType: type }),
  setPromoCode: (code, discount) => set({ promoCode: code, promoDiscount: discount || null }),
  setNotes: (notes) => set({ orderNotes: notes }),
  setPaymentMethod: (method) => set({ paymentMethod: method }),

  addSplitPayment: (payment) => set(state => ({ splitPayments: [...state.splitPayments, payment] })),
  removeSplitPayment: (index) => set(state => ({ splitPayments: state.splitPayments.filter((_, i) => i !== index) })),
  clearSplitPayments: () => set({ splitPayments: [] }),

  holdCart: (name) => {
    const { items, discountValue, discountType, promoCode, orderNotes } = get()
    if (items.length === 0) return
    const held: HeldCart = {
      id: uuidv4(),
      name: name || `طلب معلق ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`,
      items: [...items],
      discount_value: discountValue,
      discount_type: discountType,
      promo_code: promoCode,
      notes: orderNotes,
      held_at: new Date().toISOString(),
    }

    // Save to IndexedDB
    const offlineHeld: OfflineHeldCart = {
      id: held.id,
      name: held.name,
      items: JSON.stringify(held.items),
      discount_value: held.discount_value,
      discount_type: held.discount_type,
      notes: held.notes,
      held_at: held.held_at,
      tenant_id: null,
    }
    offlineDb.heldCarts.put(offlineHeld)

    set(state => ({
      heldCarts: [...state.heldCarts, held],
      items: [], discountValue: 0, discountType: 'flat', promoCode: null, promoDiscount: null, orderNotes: '', paymentMethod: 'cash', splitPayments: [],
    }))
  },

  resumeCart: (id) => {
    const { heldCarts } = get()
    const cart = heldCarts.find(h => h.id === id)
    if (!cart) return
    offlineDb.heldCarts.delete(id)
    set({
      items: [...cart.items],
      discountValue: cart.discount_value,
      discountType: cart.discount_type,
      promoCode: cart.promo_code,
      orderNotes: cart.notes,
      heldCarts: heldCarts.filter(h => h.id !== id),
    })
  },

  removeHeldCart: (id) => {
    offlineDb.heldCarts.delete(id)
    set(state => ({ heldCarts: state.heldCarts.filter(h => h.id !== id) }))
  },

  loadHeldCarts: async () => {
    const held = await offlineDb.heldCarts.toArray()
    const carts: HeldCart[] = held.map(h => ({
      id: h.id,
      name: h.name,
      items: JSON.parse(h.items),
      discount_value: h.discount_value,
      discount_type: h.discount_type as 'flat' | 'percent',
      promo_code: null,
      notes: h.notes,
      held_at: h.held_at,
    }))
    set({ heldCarts: carts })
  },

  // Checkout: create order locally in IndexedDB (works offline)
  checkoutOffline: async (params) => {
    const state = get()
    const subtotal = state.getSubtotal()
    const itemDiscountTotal = state.getItemDiscountTotal()
    const orderDiscount = state.getOrderDiscountAmount()
    const promoDiscount = state.getPromoDiscountAmount()
    const totalDiscount = itemDiscountTotal + orderDiscount + promoDiscount
    const afterDiscount = Math.max(0, subtotal - totalDiscount)
    const taxAmount = afterDiscount * (params.taxRate / 100)
    const total = afterDiscount + taxAmount

    const orderId = uuidv4()
    const orderRef = `ORD-${Date.now().toString(36).toUpperCase()}`

    const order: OfflineOrder = {
      id: orderId,
      order_ref: orderRef,
      status: 'completed',
      type: 'sale',
      customer_name: null,
      customer_phone: null,
      subtotal,
      tax_amount: taxAmount,
      discount_amount: totalDiscount,
      total,
      payment_method: params.paymentMethod || (state.splitPayments.length > 0 ? 'split' : state.paymentMethod),
      split_payments: state.splitPayments.length > 0 ? JSON.stringify(state.splitPayments) : null,
      payment_status: params.paymentStatus || 'paid',
      cashier_name: params.cashierName,
      cashier_id: params.cashierId,
      shift_id: params.shiftId,
      branch_id: params.branchId,
      tenant_id: params.tenantId,
      notes: state.orderNotes || null,
      created_at: new Date().toISOString(),
      synced: 0,
    }

    const orderItems: OfflineOrderItem[] = state.items.map(item => {
      const addOnsTotal = item.addOns.reduce((a, ao) => a + ao.extra_price, 0)
      const basePrice = item.price + addOnsTotal
      let itemDisc = 0
      if (item.item_discount > 0) {
        itemDisc = item.item_discount_type === 'percent' ? basePrice * (item.item_discount / 100) : item.item_discount
      }
      const lineTotal = (basePrice - itemDisc) * item.quantity

      return {
        id: uuidv4(),
        order_id: orderId,
        product_id: item.product_id,
        product_name: item.name + (item.addOns.length > 0 ? ` + ${item.addOns.map(a => a.name).join(', ')}` : ''),
        quantity: item.quantity,
        unit_price: item.price,
        line_total: lineTotal,
        notes: item.notes || (item.addOns.length > 0 ? `إضافات: ${item.addOns.map(a => a.name).join(', ')}` : null),
        synced: 0,
      }
    })

    // Write to IndexedDB
    await offlineDb.orders.put(order)
    await offlineDb.orderItems.bulkPut(orderItems)

    // Clear cart
    set({ items: [], discountValue: 0, discountType: 'flat', promoCode: null, promoDiscount: null, orderNotes: '', paymentMethod: 'cash', splitPayments: [] })

    return { order, items: orderItems }
  },

  // Computed
  getSubtotal: () => {
    return get().items.reduce((sum, item) => {
      const addOnsTotal = item.addOns.reduce((a, ao) => a + ao.extra_price, 0)
      return sum + (item.price + addOnsTotal) * item.quantity
    }, 0)
  },

  getItemDiscountTotal: () => {
    return get().items.reduce((sum, item) => {
      if (item.item_discount <= 0) return sum
      const addOnsTotal = item.addOns.reduce((a, ao) => a + ao.extra_price, 0)
      const basePrice = item.price + addOnsTotal
      const disc = item.item_discount_type === 'percent' ? basePrice * (item.item_discount / 100) : item.item_discount
      return sum + disc * item.quantity
    }, 0)
  },

  getOrderDiscountAmount: () => {
    const { discountValue, discountType } = get()
    if (discountValue <= 0) return 0
    const subtotal = get().getSubtotal() - get().getItemDiscountTotal()
    return discountType === 'percent' ? subtotal * (discountValue / 100) : discountValue
  },

  getPromoDiscountAmount: () => {
    const { promoDiscount } = get()
    if (!promoDiscount) return 0
    const subtotal = get().getSubtotal() - get().getItemDiscountTotal() - get().getOrderDiscountAmount()
    return promoDiscount.type === 'percent' ? subtotal * (promoDiscount.value / 100) : promoDiscount.value
  },

  getTaxAmount: (taxRate) => {
    const subtotal = get().getSubtotal()
    const totalDiscount = get().getItemDiscountTotal() + get().getOrderDiscountAmount() + get().getPromoDiscountAmount()
    return Math.max(0, subtotal - totalDiscount) * (taxRate / 100)
  },

  getTotal: (taxRate) => {
    const subtotal = get().getSubtotal()
    const totalDiscount = get().getItemDiscountTotal() + get().getOrderDiscountAmount() + get().getPromoDiscountAmount()
    const afterDiscount = Math.max(0, subtotal - totalDiscount)
    return afterDiscount + afterDiscount * (taxRate / 100)
  },
}))
