import { create } from 'zustand'

/* ─── Lightweight cart item (no dependency on DB types) ─── */
export interface CartItem {
  id: string
  name: string
  price: number

  emoji: string
  quantity: number
}

export interface HeldOrder {
  id: string
  items: CartItem[]
  note: string
  heldAt: string
}

interface CartStore {
  items: CartItem[]
  discountValue: number
  discountType: 'flat' | 'percent'
  orderNotes: string
  showDiscount: boolean
  showNotes: boolean
  heldOrders: HeldOrder[]
  lastReceipt: CartItem[] | null

  addItem: (item: Omit<CartItem, 'quantity'>) => void
  decrementItem: (id: string) => void
  removeItem: (id: string) => void
  clearCart: () => void
  setDiscount: (value: number, type: 'flat' | 'percent') => void
  setNotes: (notes: string) => void
  toggleDiscount: () => void
  toggleNotes: () => void
  holdOrder: () => void
  recallOrder: (index: number) => void
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  discountValue: 0,
  discountType: 'flat',
  orderNotes: '',
  showDiscount: false,
  showNotes: false,
  heldOrders: [],
  lastReceipt: null,

  addItem: (item) => {
    set((state) => {
      const existing = state.items.find(i => i.id === item.id)
      if (existing) {
        return { items: state.items.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i) }
      }
      return { items: [...state.items, { ...item, quantity: 1 }] }
    })
  },

  decrementItem: (id) => {
    set((state) => {
      const item = state.items.find(i => i.id === id)
      if (!item) return state
      if (item.quantity <= 1) {
        return { items: state.items.filter(i => i.id !== id) }
      }
      return { items: state.items.map(i => i.id === id ? { ...i, quantity: i.quantity - 1 } : i) }
    })
  },

  removeItem: (id) => set((state) => ({ items: state.items.filter(i => i.id !== id) })),

  clearCart: () => set({ items: [], discountValue: 0, discountType: 'flat', orderNotes: '', showDiscount: false, showNotes: false }),

  setDiscount: (value, type) => set({ discountValue: value, discountType: type }),

  setNotes: (notes) => set({ orderNotes: notes }),

  toggleDiscount: () => set((state) => ({ showDiscount: !state.showDiscount })),

  toggleNotes: () => set((state) => ({ showNotes: !state.showNotes })),

  holdOrder: () => {
    const { items, orderNotes } = get()
    if (items.length === 0) return
    const held: HeldOrder = {
      id: `HOLD-${Date.now()}`,
      items: [...items],
      note: orderNotes,
      heldAt: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    }
    set((state) => ({
      heldOrders: [...state.heldOrders, held],
      items: [],
      discountValue: 0,
      discountType: 'flat',
      orderNotes: '',
      showDiscount: false,
      showNotes: false,
    }))
  },

  recallOrder: (index) => {
    const { heldOrders } = get()
    const order = heldOrders[index]
    if (!order) return
    set({
      items: [...order.items],
      orderNotes: order.note,
      heldOrders: heldOrders.filter((_, i) => i !== index),
    })
  },
}))
