import { useState, useEffect, useRef, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useThemeStore } from '../store/useThemeStore'
import { usePOSCartStore } from '../store/usePOSCartStore'
import type { SplitPayment } from '../store/usePOSCartStore'
import { useCompanyProfile, useOrganization } from '../hooks/useData'
import { useShifts, usePromoCodes, logActivity } from '../hooks/useSaasData'
import { useTenant } from '../context/TenantContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { formatEGP, playBeep, playErrorBeep } from '../lib/utils'
import { offlineDb } from '../lib/offlineDb'
import { syncPendingOrders, startSyncLoop, stopSyncLoop, getOnlineStatus, getPendingSyncCount, fullSync } from '../lib/syncEngine'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import {
  Trash2, Plus, Minus, Search, LayoutDashboard, ShoppingCart,
  Percent, StickyNote, Clock, Banknote, Check, Loader2, Image as ImageIcon,
  X, Package, Pause, Play, Wifi, WifiOff, Tag,
  Split, Printer, Link as LinkIcon, Phone,
} from 'lucide-react'

export default function POS() {
  const { companyName, applyToDOM } = useThemeStore()
  const { org } = useOrganization()
  const orgAny = org as any
  const taxRate = orgAny?.tax_rate ?? 14
  const { tenant, currentBranch } = useTenant()
  const { company } = useCompanyProfile(tenant?.id)
  const { user } = useAuth()
  const toast = useToast()
  const { activeShift, openShift, closeShift, updateShiftTotals } = useShifts(tenant?.id, currentBranch?.id)
  const { validate: validatePromo, use: usePromoCode } = usePromoCodes(tenant?.id)

  const cart = usePOSCartStore()
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [lastOrder, setLastOrder] = useState<any>(null)
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [showCloseShift, setShowCloseShift] = useState(false)
  const [showSplitPay, setShowSplitPay] = useState(false)
  const [showHeldOrders, setShowHeldOrders] = useState(false)
  const [showPromoInput, setShowPromoInput] = useState(false)
  const [promoInput, setPromoInput] = useState('')
  const [promoError, setPromoError] = useState('')
  const [shiftCash, setShiftCash] = useState(0)
  const [closeCash, setCloseCash] = useState(0)
  const [isOnline, setIsOnline] = useState(getOnlineStatus())
  const [pendingSync, setPendingSync] = useState(0)
  const [showDiscount, setShowDiscount] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [branchWarehouseId, setBranchWarehouseId] = useState<string | null>(null)
  const [branchStock, setBranchStock] = useState<Record<string, number>>({})
  const searchRef = useRef<HTMLInputElement>(null)
  const barcodeBuffer = useRef('')
  const barcodeTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [productSalesRank, setProductSalesRank] = useState<Record<string, number>>({})
  // Per-device printer preference (localStorage)
  const [printerName, setPrinterName] = useState(() => localStorage.getItem('pos_printer_name') || '')
  const [showPrinterModal, setShowPrinterModal] = useState(false)
  // Electronic payment link
  const [showPaymentLinkModal, setShowPaymentLinkModal] = useState(false)
  const [linkPhone, setLinkPhone] = useState('')
  const [linkCustomerName, setLinkCustomerName] = useState('')
  const [linkLoading, setLinkLoading] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkDeliveryChoice, setLinkDeliveryChoice] = useState<'manual' | 'sms' | 'whatsapp'>('manual')
  const [pendingLinkOrderId, setPendingLinkOrderId] = useState<string | null>(null)
  const [hasNewLinkPayment, setHasNewLinkPayment] = useState(false)
  const [showLinkOrders, setShowLinkOrders] = useState(false)
  const [linkOrders, setLinkOrders] = useState<any[]>([])
  const [linkOrdersLoading, setLinkOrdersLoading] = useState(false)
  // آجل (deferred payment)
  const [showDeferredModal, setShowDeferredModal] = useState(false)
  const [deferredOrderRef, setDeferredOrderRef] = useState('')
  const [deferredDone, setDeferredDone] = useState(false)

  // Offline data from IndexedDB
  const products = useLiveQuery(() => offlineDb.products.toArray(), []) || []
  const categories = useLiveQuery(() => offlineDb.categories.orderBy('sort_order').toArray(), []) || []

  useEffect(() => { applyToDOM() }, [applyToDOM])

  // Load product sales ranking (company-wide most sold)
  useEffect(() => {
    const loadSalesRank = async () => {
      try {
        const { data } = await supabase
          .from('order_items')
          .select('product_id, quantity')
        if (data) {
          const rank: Record<string, number> = {}
          data.forEach((item: any) => {
            if (item.product_id) rank[item.product_id] = (rank[item.product_id] || 0) + Number(item.quantity || 1)
          })
          setProductSalesRank(rank)
        }
      } catch {}
    }
    loadSalesRank()
  }, [])

  // Start sync loop
  useEffect(() => {
    startSyncLoop()
    cart.loadHeldCarts()
    return () => stopSyncLoop()
  }, [])

  // Sync linkDeliveryChoice from org config
  useEffect(() => {
    const method = (org as any)?.electronic_payment_config?.link_delivery?.method
    if (method === 'sms' || method === 'whatsapp') setLinkDeliveryChoice(method)
    else setLinkDeliveryChoice('manual')
  }, [org])

  // Supabase Realtime: auto-detect payment confirmation
  useEffect(() => {
    if (!pendingLinkOrderId) return
    const channel = supabase
      .channel('epay-paid-' + pendingLinkOrderId)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'paymob_transactions',
        filter: `offline_order_id=eq.${pendingLinkOrderId}`,
      }, (payload: any) => {
        if (payload.new?.status === 'paid') {
          setHasNewLinkPayment(true)
          setPendingLinkOrderId(null)
          setShowPaymentLinkModal(false)
          setLinkUrl('')
          setLinkPhone('')
          setLinkCustomerName('')
          toast.success('تم الدفع الإلكتروني بنجاح! 🎉', 5000)
          if ((org as any)?.print_invoices_enabled !== false) {
            setTimeout(() => printReceipt(), 500)
          }
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [pendingLinkOrderId])

  // Online status monitor
  useEffect(() => {
    const onOnline = () => { setIsOnline(true); syncPendingOrders() }
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    // Fast connectivity check: ping Supabase every 3s (not 5s), immediate on mount
    const checkConnectivity = async () => {
      try {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 2500)
        await fetch(`${window.location.origin}/favicon.ico?_=${Date.now()}`, { method: 'HEAD', signal: ctrl.signal, cache: 'no-store' })
        clearTimeout(timer)
        setIsOnline(true)
      } catch {
        setIsOnline(navigator.onLine)
      }
      setPendingSync(await getPendingSyncCount())
    }
    checkConnectivity()
    const interval = setInterval(checkConnectivity, 3000)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); clearInterval(interval) }
  }, [])

  // Filter and sort products by most sold
  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode && p.barcode.includes(search)) || (p.sku && p.sku.includes(search))
    const matchCat = !activeCat || p.category_id === activeCat
    return matchSearch && matchCat
  }).sort((a, b) => (productSalesRank[b.id] || 0) - (productSalesRank[a.id] || 0))

  const companyDisplayName = company?.name || org?.name || companyName
  const companyAddress = company?.address || org?.address || ''
  const companyPhone = company?.phone || org?.phone || ''

  useEffect(() => {
    const loadBranchStock = async () => {
      if (!currentBranch?.id) return

      const { data: warehouse } = await supabase
        .from('warehouses')
        .select('id')
        .eq('branch_id', currentBranch.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (!warehouse?.id) {
        setBranchWarehouseId(null)
        setBranchStock({})
        return
      }

      setBranchWarehouseId(warehouse.id)

      const { data: stockRows } = await supabase
        .from('stock_locations')
        .select('product_id, quantity')
        .eq('warehouse_id', warehouse.id)

      const stockMap: Record<string, number> = {}
      ;(stockRows || []).forEach((row: any) => {
        stockMap[row.product_id] = Number(row.quantity || 0)
      })
      setBranchStock(stockMap)
    }

    void loadBranchStock()
  }, [currentBranch?.id])

  // Computations
  const subtotal = cart.getSubtotal()
  const itemDiscountTotal = cart.getItemDiscountTotal()
  const orderDiscount = cart.getOrderDiscountAmount()
  const promoDiscount = cart.getPromoDiscountAmount()
  const totalDiscount = itemDiscountTotal + orderDiscount + promoDiscount
  const afterDiscount = Math.max(0, subtotal - totalDiscount)
  const tax = afterDiscount * (taxRate / 100)
  const total = afterDiscount + tax
  const splitTotal = cart.splitPayments.reduce((s, p) => s + p.amount, 0)
  const splitRemaining = total - splitTotal

  // Barcode scanner (HID wedge)
  const handleBarcode = useCallback((char: string) => {
    barcodeBuffer.current += char
    clearTimeout(barcodeTimeout.current)
    barcodeTimeout.current = setTimeout(() => {
      const barcode = barcodeBuffer.current.trim()
      if (barcode.length >= 3) {
        const product = products.find(p => p.barcode === barcode || p.sku === barcode)
        if (product) {
          playBeep(800, 150, 0.3)
          cart.addItem({
            id: product.id,
            product_id: product.id,
            name: product.name,
            price: product.selling_price,
            image_url: product.primary_image_url,
            addOns: [],
          })
        } else {
          playErrorBeep()
        }
      }
      barcodeBuffer.current = ''
    }, 300)
  }, [products, cart])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // POS keyboard shortcuts (work even when in input fields for function keys)
      switch (e.key) {
        case 'F1':
          e.preventDefault()
          searchRef.current?.focus()
          return
        case 'F2':
          e.preventDefault()
          setShowDiscount(v => !v)
          return
        case 'F3':
          e.preventDefault()
          cart.holdCart()
          return
        case 'F4':
          e.preventDefault()
          handleCheckout()
          return
        case 'F5':
          e.preventDefault()
          setShowHeldOrders(v => !v)
          return
        case 'F8':
          e.preventDefault()
          cart.clearCart()
          return
        case 'Escape':
          e.preventDefault()
          if (showReceipt) { setShowReceipt(false); setLastOrder(null) }
          else if (showShiftModal) setShowShiftModal(false)
          else if (showCloseShift) setShowCloseShift(false)
          else if (showHeldOrders) setShowHeldOrders(false)
          else if (showSplitPay) setShowSplitPay(false)
          else if (showDiscount) setShowDiscount(false)
          else if (showNotes) setShowNotes(false)
          else if (showPromoInput) setShowPromoInput(false)
          else if (search) setSearch('')
          return
      }
      // Barcode scanner handler
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) handleBarcode(e.key)
      else if (e.key === 'Enter' && barcodeBuffer.current.length > 0) handleBarcode('')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleBarcode, showReceipt, showShiftModal, showCloseShift, showHeldOrders, showSplitPay, showDiscount, showNotes, showPromoInput, search])

  // Add product to cart
  const addItem = async (product: any) => {
    const branchQty = branchStock[product.id] ?? 0
    // Block if stock tracking is on and branch stock is 0
    if (product.track_stock && branchQty <= 0) {
      toast.warning(`"${product.name}" نفذ من المخزون`)
      return
    }
    cart.addItem({
      id: product.id,
      product_id: product.id,
      name: product.name,
      price: product.selling_price,
      image_url: product.primary_image_url,
      addOns: [],
    })
  }

  // Promo code handler
  const applyPromo = async () => {
    setPromoError('')
    const result = await validatePromo(promoInput, subtotal)
    if (!result.valid) {
      setPromoError(result.error || 'كود غير صالح')
      return
    }
    cart.setPromoCode(promoInput.toUpperCase(), { type: result.discount_type!, value: result.discount_value! })
    setShowPromoInput(false)
    setPromoInput('')
  }

  // Checkout
  const handleCheckout = async () => {
    if (cart.items.length === 0 || processing) return
    if (!activeShift) {
      setShowShiftModal(true)
      return
    }

    setProcessing(true)
    try {
      const { order, items } = await cart.checkoutOffline({
        taxRate,
        cashierName: user?.email?.split('@')[0] || 'كاشير',
        cashierId: user?.id || null,
        shiftId: activeShift.id,
        branchId: currentBranch?.id || null,
        tenantId: tenant?.id || null,
      })

      setLastOrder(order)
      setShowReceipt(true)

      // Deduct sold quantity from this branch warehouse stock.
      if (branchWarehouseId) {
        for (const line of items) {
          if (!line.product_id) continue
          const productId = line.product_id

          const { data: currentStock } = await supabase
            .from('stock_locations')
            .select('id, quantity')
            .eq('warehouse_id', branchWarehouseId)
            .eq('product_id', productId)
            .maybeSingle()

          if (!currentStock?.id) continue

          const nextQty = Math.max(0, Number(currentStock.quantity || 0) - Number(line.quantity || 0))
          await supabase.from('stock_locations').update({ quantity: nextQty }).eq('id', currentStock.id)
          setBranchStock((prev) => ({ ...prev, [productId]: nextQty }))
        }
      }

      // Auto-print if enabled in settings
      if ((org as any)?.print_invoices_enabled !== false) {
        setTimeout(() => printReceipt(), 300)
      }

      // Update shift totals
      await updateShiftTotals(activeShift.id, order.total)

      // Use promo code if applied
      if (cart.promoCode) {
        const promoData = (await supabase.from('promo_codes').select('id').eq('code', cart.promoCode).maybeSingle()).data
        if (promoData) await usePromoCode(promoData.id)
      }

      // Log activity
      await logActivity({
        tenant_id: tenant?.id,
        user_id: user?.id,
        user_name: user?.email?.split('@')[0],
        action: 'create',
        entity_type: 'order',
        entity_id: order.id,
        details: { order_ref: order.order_ref, total: order.total },
      })

      // Try immediate sync
      if (isOnline) syncPendingOrders()
    } catch (err) {
      console.error('Checkout error:', err)
      alert('حدث خطأ أثناء تسجيل الطلب')
    }
    setProcessing(false)
  }

  // Open shift
  const handleOpenShift = async () => {
    if (!tenant || !currentBranch) return
    await openShift({
      tenant_id: tenant.id,
      branch_id: currentBranch.id,
      cashier_id: user?.id || '',
      cashier_name: user?.email?.split('@')[0] || 'كاشير',
      starting_cash: shiftCash,
    })
    setShowShiftModal(false)
    setShiftCash(0)
  }

  // Close shift
  const handleCloseShift = async () => {
    if (!activeShift) return
    await closeShift(activeShift.id, closeCash)
    setShowCloseShift(false)
    setCloseCash(0)
  }

  // Initiate electronic payment link (QuickLink)
  const handlePaymentLinkCheckout = async () => {
    if (cart.items.length === 0 || linkLoading) return
    if (!activeShift) { setShowShiftModal(true); return }
    const epConfig = orgAny?.electronic_payment_config || {}
    const paymob = epConfig?.gateways?.paymob || {}
    if (!epConfig.enabled || !paymob.enabled || !paymob.public_key) {
      toast.error('لم يتم تفعيل الدفع الإلكتروني — يرجى الضبط في الإعدادات')
      return
    }
    if (!linkPhone.trim() || linkPhone.replace(/\D/g, '').length < 8) {
      toast.warning('أدخل رقم هاتف العميل أولاً')
      return
    }
    setLinkLoading(true)
    try {
      // Create offline order with payment method 'link'
      setProcessing(true)
      const { order } = await cart.checkoutOffline({
        taxRate,
        cashierName: user?.email?.split('@')[0] || 'كاشير',
        cashierId: user?.id || null,
        shiftId: activeShift.id,
        branchId: currentBranch?.id || null,
        tenantId: tenant?.id || null,
        paymentMethod: 'link',
        paymentStatus: 'pending',
      })
      setProcessing(false)
      setLastOrder(order)
      setPendingLinkOrderId(order.id)

      const amountCents = Math.round((order.total || 0) * 100)
      const deliveryConfig = epConfig?.link_delivery || {}
      const { data, error } = await supabase.functions.invoke('create-paymob-payment', {
        body: {
          tenant_id: tenant?.id,
          offline_order_id: order.id,
          order_ref: order.order_ref,
          amount_cents: amountCents,
          customer_phone: linkPhone.trim(),
          customer_name: linkCustomerName.trim() || 'عميل',
          items: cart.items.map(i => ({ name: i.name, amount_cents: Math.round(i.price * 100), quantity: i.quantity })),
          link_delivery: { method: linkDeliveryChoice, ...deliveryConfig },
        },
      })
      if (error || data?.error) throw new Error(data?.error || error?.message)
      setLinkUrl(data.payment_link)
      const sentVia = data.delivery_method
      if (sentVia === 'sms') toast.success('تم إنشاء الرابط وإرساله عبر SMS')
      else if (sentVia === 'whatsapp') toast.success('تم إنشاء الرابط وإرساله عبر WhatsApp')
      else toast.success('تم إنشاء رابط الدفع بنجاح')
    } catch (err: any) {
      console.error('Payment link error:', err)
      toast.error(`فشل إنشاء رابط الدفع: ${err.message || 'خطأ غير معروف'}`)
      setProcessing(false)
    }
    setLinkLoading(false)
  }

  // Fetch payment link orders — webhook handles status updates via transaction_inquiry
  const fetchLinkOrders = async () => {
    setLinkOrdersLoading(true)
    try {
      const { data } = await supabase
        .from('paymob_transactions')
        .select('id, offline_order_id, paymob_order_id, amount_cents, status, payment_link, customer_phone, created_at, paid_at, payload')
        .order('created_at', { ascending: false })
        .limit(30)
      setLinkOrders(data || [])
    } catch {}
    setLinkOrdersLoading(false)
  }

  // Handle آجل (deferred) payment
  const handleDeferredCheckout = async () => {
    if (cart.items.length === 0 || processing) return
    if (!activeShift) { setShowShiftModal(true); return }
    setProcessing(true)
    try {
      const { order, items } = await cart.checkoutOffline({
        taxRate,
        cashierName: user?.email?.split('@')[0] || 'كاشير',
        cashierId: user?.id || null,
        shiftId: activeShift.id,
        branchId: currentBranch?.id || null,
        tenantId: tenant?.id || null,
        paymentMethod: 'deferred',
        paymentStatus: 'deferred',
      })
      setLastOrder(order)
      setDeferredOrderRef(order.order_ref)
      setDeferredDone(true)
      setShowDeferredModal(true)

      // Deduct stock
      if (branchWarehouseId) {
        for (const line of items) {
          if (!line.product_id) continue
          const { data: currentStock } = await supabase
            .from('stock_locations')
            .select('id, quantity')
            .eq('warehouse_id', branchWarehouseId)
            .eq('product_id', line.product_id)
            .maybeSingle()
          if (!currentStock?.id) continue
          const nextQty = Math.max(0, Number(currentStock.quantity || 0) - Number(line.quantity || 0))
          await supabase.from('stock_locations').update({ quantity: nextQty }).eq('id', currentStock.id)
          setBranchStock((prev) => ({ ...prev, [line.product_id!]: nextQty }))
        }
      }

      await updateShiftTotals(activeShift.id, order.total)
      if (isOnline) syncPendingOrders()
    } catch (err) {
      console.error('Deferred checkout error:', err)
      toast.error('حدث خطأ أثناء تسجيل الطلب')
    }
    setProcessing(false)
  }
  const printReceipt = (overrideOrder?: any) => {
    const order = overrideOrder || lastOrder
    if (!order) return

    const inv: Record<string, any> = (orgAny?.invoice_settings) || {}
    const showLogo = inv.show_logo !== false
    const logoBw = inv.logo_bw !== false
    const showAddress = inv.show_address !== false
    const showPhone = inv.show_phone !== false
    const showTaxNum = inv.show_tax_number !== false
    const showTaxId = inv.show_tax_id === true
    const showBranch = inv.show_branch !== false
    const showCashier = inv.show_cashier !== false
    const showSubtotal = inv.show_subtotal !== false
    const showDiscountLine = inv.show_discount !== false
    const showTaxLine = inv.show_tax !== false
    const showPayMethod = inv.show_payment_method !== false
    const footerText = inv.footer_text || orgAny?.receipt_footer || 'شكراً لزيارتكم ❤'
    const footerText2 = inv.footer_text2 || ''

    const fmt = (n: number) => `${Number(n || 0).toFixed(2)} ج.م`

    const logoUrl = (company?.logo_url || org?.logo_url || orgAny?.logo_url || '').split('?')[0]

    const logoHtml = (showLogo && logoUrl)
      ? `<div class="center" style="margin-bottom:6px"><img src="${logoUrl}" alt="" style="max-width:70px;max-height:50px;object-fit:contain;${logoBw ? 'filter:grayscale(100%) contrast(1.2);' : ''}" /></div>`
      : ''

    const payMethod = order.payment_method === 'cash' ? 'نقدي' : order.payment_method === 'card' ? 'بطاقة' : order.payment_method === 'split' ? 'تقسيم' : order.payment_method === 'link' ? 'رابط دفع إلكتروني' : order.payment_method === 'deferred' ? 'آجل' : order.payment_method || ''

    const itemRows = (order._items || []).map((item: any) => {
      return `<div class="row"><span>${item.product_name} &times;${item.quantity}</span><span>${fmt(item.line_total)}</span></div>`
    }).join('')

    // Fix date: use order.created_at properly
    const orderDate = order.created_at ? new Date(order.created_at) : new Date()
    const dateStr = isNaN(orderDate.getTime()) ? new Date().toLocaleString('ar-EG') : orderDate.toLocaleString('ar-EG')

    const receiptWindow = window.open('', '_blank', 'width=302,height=800')
    if (!receiptWindow) return

    receiptWindow.document.write(
      `<html dir="rtl"><head><meta charset="utf-8"><style>
@page{margin:0;size:80mm auto}
body{font-family:"Courier New",monospace;font-size:12px;width:72mm;margin:0 auto;padding:4mm 0;line-height:1.5;color:#000;background:#fff}
.center{text-align:center}.line{border-top:1px dashed #000;margin:6px 0}
.row{display:flex;justify-content:space-between;padding:1.5px 0;gap:4px}.row span:first-child{flex:1}.bold{font-weight:bold}
.total-row{font-size:15px;font-weight:bold;padding:4px 0}.ltr{direction:ltr;display:inline-block}
.footer{font-size:11px;text-align:center;margin-top:10px;line-height:1.8}
@media print{body{margin:0;padding:2mm 0}}
</style></head><body>
${logoHtml}
<div class="center bold" style="font-size:17px;margin-bottom:2px">${companyDisplayName}</div>
${showAddress && companyAddress ? `<div class="center" style="font-size:10px">${companyAddress}</div>` : ''}
${showBranch && currentBranch?.name ? `<div class="center" style="font-size:10px">${currentBranch.name}</div>` : ''}
${showPhone && companyPhone ? `<div class="center" style="font-size:10px">هاتف: <span class="ltr">${companyPhone}</span></div>` : ''}
${showTaxNum && orgAny?.tax_number ? `<div class="center" style="font-size:10px">الرقم الضريبي: <span class="ltr">${orgAny.tax_number}</span></div>` : ''}
<div class="line"></div>
<div class="row"><span>رقم الفاتورة:</span><span class="bold ltr">${order.order_ref || ''}</span></div>
<div class="row"><span>التاريخ:</span><span class="ltr">${dateStr}</span></div>
${showCashier && order.cashier_name ? `<div class="row"><span>الكاشير:</span><span>${order.cashier_name}</span></div>` : ''}
${showTaxId && orgAny?.tax_number ? `<div class="row"><span>الرقم الضريبي:</span><span class="ltr">${orgAny.tax_number}</span></div>` : ''}
<div class="line"></div>
<div class="row bold" style="border-bottom:1px solid #000;padding-bottom:3px;margin-bottom:3px"><span>المنتج</span><span>الإجمالي</span></div>
${itemRows}
<div class="line"></div>
${showSubtotal ? `<div class="row"><span>المجموع الفرعي</span><span>${fmt(order.subtotal)}</span></div>` : ''}
${showDiscountLine && order.discount_amount > 0 ? `<div class="row" style="color:#000"><span>الخصم</span><span>-${fmt(order.discount_amount)}</span></div>` : ''}
${showTaxLine ? `<div class="row"><span>الضريبة (${taxRate}%)</span><span>${fmt(order.tax_amount)}</span></div>` : ''}
<div class="line"></div>
<div class="row total-row"><span>الإجمالي</span><span>${fmt(order.total)}</span></div>
<div class="row"><span>المدفوع</span><span>${fmt(order.total)}</span></div>
${showPayMethod ? `<div class="row"><span>طريقة الدفع</span><span>${payMethod}</span></div>` : ''}
<div class="line"></div>
<div class="footer">${footerText}${footerText2 ? '<br>' + footerText2 : ''}</div>
<script>
  window.onload = function() {
    var pn = localStorage.getItem('pos_printer_name') || ''
    window.print()
    setTimeout(function(){window.close()},800)
  }
<\/script>
</body></html>`
    )
    receiptWindow.document.close()
  }

  const currentTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="h-screen flex flex-col overflow-hidden" dir="rtl" style={{ background: 'var(--bg-main)' }}>
      <div className="flex-1 flex overflow-hidden pos-mobile-stack">
        {/* Cart Sidebar */}
        <div className="w-[380px] flex flex-col flex-shrink-0 border-l pos-cart-sidebar" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          {/* Cart header with inline status */}
          <div className="p-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Link to="/" className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }} title="لوحة التحكم"><LayoutDashboard className="w-4 h-4" /></Link>
                <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>{companyDisplayName}</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: isOnline ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: isOnline ? '#10b981' : '#ef4444' }}>
                  {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  {pendingSync > 0 ? `${pendingSync} معلق` : (isOnline ? 'متصل' : 'غير متصل')}
                </span>
                {activeShift ? (
                  <button onClick={() => setShowCloseShift(true)} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                    <Play className="w-3 h-3" />وردية
                  </button>
                ) : (
                  <button onClick={() => setShowShiftModal(true)} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                    <Pause className="w-3 h-3" />بدء وردية
                  </button>
                )}
                <button onClick={() => setShowPrinterModal(true)} title="إعداد الطابعة" className="p-1 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                  <Printer className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{currentTime}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>الفاتورة</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setShowHeldOrders(true)} className="p-2 rounded-lg hover:opacity-80 relative" style={{ color: 'var(--text-muted)' }} title="طلبات معلقة">
                  <Pause className="w-4 h-4" />
                  {cart.heldCarts.length > 0 && <span className="absolute -top-0.5 -left-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white" style={{ background: 'var(--accent)' }}>{cart.heldCarts.length}</span>}
                </button>
                <button onClick={() => { setShowLinkOrders(true); fetchLinkOrders(); setHasNewLinkPayment(false) }} className="p-2 rounded-lg hover:opacity-80 relative" style={{ color: 'var(--text-muted)' }} title="طلبات الدفع الإلكتروني">
                  <LinkIcon className="w-4 h-4" />
                  {hasNewLinkPayment && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full animate-pulse" style={{ background: '#ef4444' }} />}
                </button>
                <button onClick={() => cart.holdCart()} className="p-2 rounded-lg hover:opacity-80" style={{ color: cart.items.length > 0 ? 'var(--accent)' : 'var(--text-muted)' }} title="تعليق الطلب">
                  <ShoppingCart className="w-4 h-4" />
                </button>
                <button onClick={() => setShowDiscount(!showDiscount)} className="p-2 rounded-lg hover:opacity-80" style={{ color: cart.discountValue > 0 ? 'var(--success)' : 'var(--text-muted)' }} title="خصم"><Percent className="w-4 h-4" /></button>
                <button onClick={() => setShowPromoInput(!showPromoInput)} className="p-2 rounded-lg hover:opacity-80" style={{ color: cart.promoCode ? 'var(--primary)' : 'var(--text-muted)' }} title="كود خصم"><Tag className="w-4 h-4" /></button>
                <button onClick={() => setShowNotes(!showNotes)} className="p-2 rounded-lg hover:opacity-80" style={{ color: cart.orderNotes ? 'var(--primary)' : 'var(--text-muted)' }} title="ملاحظات"><StickyNote className="w-4 h-4" /></button>
                <button onClick={() => cart.clearCart()} className="p-2 rounded-lg hover:opacity-80" style={{ color: 'var(--danger)' }} title="إفراغ"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>

          {showDiscount && (
            <div className="px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-light)', background: 'var(--bg-input)' }}>
              <input type="number" value={cart.discountValue || ''} onChange={e => cart.setDiscount(Math.max(0, Number(e.target.value)), cart.discountType)} placeholder="قيمة الخصم" className="flex-1 px-2 py-1.5 rounded-md border text-sm text-left" dir="ltr" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
              <button onClick={() => cart.setDiscount(cart.discountValue, cart.discountType === 'flat' ? 'percent' : 'flat')} className="px-2 py-1.5 rounded-md text-xs font-bold" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>{cart.discountType === 'flat' ? 'ج.م' : '%'}</button>
            </div>
          )}

          {showPromoInput && !cart.promoCode && (
            <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-light)', background: 'var(--bg-input)' }}>
              <div className="flex items-center gap-2">
                <input value={promoInput} onChange={e => setPromoInput(e.target.value.toUpperCase())} placeholder="أدخل كود الخصم" className="flex-1 px-2 py-1.5 rounded-md border text-sm text-left" dir="ltr" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }} onKeyDown={e => e.key === 'Enter' && applyPromo()} />
                <button onClick={applyPromo} className="px-3 py-1.5 rounded-md text-xs font-bold" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>تطبيق</button>
              </div>
              {promoError && <p className="text-[10px] mt-1" style={{ color: 'var(--danger)' }}>{promoError}</p>}
            </div>
          )}
          {cart.promoCode && (
            <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-light)', background: 'rgba(16,185,129,0.05)' }}>
              <span className="text-xs font-bold" style={{ color: 'var(--success)' }}>كود: {cart.promoCode}</span>
              <button onClick={() => cart.setPromoCode(null)} className="text-xs" style={{ color: 'var(--danger)' }}>إزالة</button>
            </div>
          )}

          {showNotes && (
            <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
              <textarea value={cart.orderNotes} onChange={e => cart.setNotes(e.target.value)} placeholder="ملاحظات على الطلب..." rows={2} className="w-full px-2 py-1.5 rounded-md border text-sm resize-none" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-3 py-2">
            {cart.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-30">
                <ShoppingCart className="w-16 h-16 mb-3" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>السلة فارغة</p>
              </div>
            ) : (
              <div className="space-y-2">{cart.items.map((item) => {
                const aoKey = item.addOns.map(a => a.id).sort().join(',')
                const addOnsTotal = item.addOns.reduce((a, ao) => a + ao.extra_price, 0)
                const basePrice = item.price + addOnsTotal
                let itemDisc = 0
                if (item.item_discount > 0) {
                  itemDisc = item.item_discount_type === 'percent' ? basePrice * (item.item_discount / 100) : item.item_discount
                }
                const itemTotal = (basePrice - itemDisc) * item.quantity
                return (
                  <div key={item.id} className="p-2 rounded-xl border relative group" style={{ borderColor: 'var(--border-light)' }}>
                    <div className="flex items-start gap-2">
                      {item.image_url ? <img src={item.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" /> : <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-input)' }}><ImageIcon className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></div>}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate" style={{ color: 'var(--text-heading)' }}>{item.name}</p>
                        {item.addOns.length > 0 && <p className="text-[10px]" style={{ color: 'var(--primary)' }}>{item.addOns.map(ao => ao.name).join(' + ')}</p>}
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatEGP(basePrice)}</p>
                        {itemDisc > 0 && <p className="text-[10px]" style={{ color: 'var(--success)' }}>خصم: -{formatEGP(itemDisc)}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => cart.updateItemQty(item.product_id, aoKey, -1)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}><Minus className="w-3 h-3" /></button>
                        <span className="w-6 text-center text-xs font-bold" style={{ color: 'var(--text-heading)' }}>{item.quantity}</span>
                        <button onClick={() => cart.updateItemQty(item.product_id, aoKey, 1)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}><Plus className="w-3 h-3" /></button>
                      </div>
                      <span className="text-xs font-bold w-16 text-left flex-shrink-0" dir="ltr" style={{ color: 'var(--text-heading)' }}>{formatEGP(itemTotal)}</span>
                    </div>
                    <button onClick={() => cart.removeItem(item.product_id, aoKey)} className="absolute top-1 left-1 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--danger)' }}><Trash2 className="w-3 h-3" /></button>
                  </div>
                )
              })}</div>
            )}
          </div>

          <div className="p-3 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
            <div className="flex justify-between text-sm" style={{ color: 'var(--text-muted)' }}><span>المجموع</span><span>{formatEGP(subtotal)}</span></div>
            {totalDiscount > 0 && <div className="flex justify-between text-sm" style={{ color: 'var(--success)' }}><span>الخصم</span><span>-{formatEGP(totalDiscount)}</span></div>}
            <div className="flex justify-between text-sm" style={{ color: 'var(--text-muted)' }}><span>ضريبة ({taxRate.toFixed(0)}%)</span><span>{formatEGP(tax)}</span></div>
            <div className="flex justify-between text-lg font-black pt-1 border-t" style={{ borderColor: 'var(--border-light)', color: 'var(--text-heading)' }}><span>الإجمالي</span><span>{formatEGP(total)}</span></div>

            <div className="grid grid-cols-3 gap-1.5">
              {(['cash', 'split'] as const).map(method => {
                const icons: Record<string, any> = { cash: Banknote, split: Split }
                const labels: Record<string, string> = { cash: 'كاش', split: 'تقسيم' }
                const Icon = icons[method]
                const isActive = method === 'split' ? showSplitPay : cart.paymentMethod === method
                return (
                  <button key={method} onClick={() => {
                    if (method === 'split') { setShowSplitPay(!showSplitPay); return }
                    cart.setPaymentMethod(method)
                    cart.clearSplitPayments()
                    setShowSplitPay(false)
                  }} className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-bold border-2 transition-all" style={{
                    borderColor: isActive ? 'var(--primary)' : 'var(--border)',
                    background: isActive ? 'rgba(37,99,235,0.08)' : 'transparent',
                    color: 'var(--text-main)',
                  }}>
                    <Icon className="w-3.5 h-3.5" />{labels[method]}
                  </button>
                )
              })}
              {/* آجل (Deferred) payment button */}
              <button onClick={() => setShowDeferredModal(true)}
                className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-bold border-2 transition-all"
                style={{ borderColor: 'var(--border)', background: 'transparent', color: 'var(--text-main)' }}>
                <Clock className="w-3.5 h-3.5" />آجل
              </button>
            </div>
            {/* Electronic payment link button — shown only when enabled */}
            {orgAny?.electronic_payment_config?.enabled && (
              <button onClick={() => setShowPaymentLinkModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border-2 transition-all"
                style={{ borderColor: 'var(--border)', background: 'transparent', color: 'var(--text-main)' }}>
                <img src="/paymob.svg" alt="Paymob" className="w-4 h-4 object-contain" />رابط دفع إلكتروني
              </button>
            )}

            {showSplitPay && <SplitPaymentPanel splitPayments={cart.splitPayments} remaining={splitRemaining} onAdd={(p) => cart.addSplitPayment(p)} onRemove={(i) => cart.removeSplitPayment(i)} />}

            <button onClick={handleCheckout} disabled={cart.items.length === 0 || processing || (showSplitPay && splitRemaining > 0.01)} className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-50 flex items-center justify-center gap-2 transition-all hover:opacity-90" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
              {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              {processing ? 'جاري التسجيل...' : `دفع — ${formatEGP(total)}`}
            </button>
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 flex flex-col overflow-hidden pos-products-area">
          <div className="p-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-muted)' }} />
              <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الباركود أو SKU..." className="w-full pr-11 pl-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
            </div>
          </div>

          <div className="px-3 py-2 flex items-center gap-2 overflow-x-auto flex-shrink-0 border-b" style={{ borderColor: 'var(--border-light)' }}>
            <button onClick={() => setActiveCat(null)} className="px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all" style={{ background: !activeCat ? 'var(--primary)' : 'var(--bg-card)', color: !activeCat ? 'var(--text-on-primary)' : 'var(--text-muted)' }}>الكل</button>
            {categories.filter(c => c.applies_to === 'product' || c.applies_to === 'all').map(cat => (
              <button key={cat.id} onClick={() => setActiveCat(cat.id === activeCat ? null : cat.id)} className="px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all" style={{ background: activeCat === cat.id ? 'var(--primary)' : 'var(--bg-card)', color: activeCat === cat.id ? 'var(--text-on-primary)' : 'var(--text-muted)' }}>{cat.name}</button>
            ))}
          </div>

          {/* Keyboard shortcuts hint — desktop only */}
          <div className="px-3 py-1 hidden lg:flex items-center gap-3 overflow-x-auto flex-shrink-0 border-b" style={{ borderColor: 'var(--border-light)', background: 'var(--bg-input)' }}>
            {[
              { key: 'F1', label: 'بحث' },
              { key: 'F2', label: 'خصم' },
              { key: 'F3', label: 'تعليق' },
              { key: 'F4', label: 'دفع' },
              { key: 'F5', label: 'معلقة' },
              { key: 'F8', label: 'إفراغ' },
              { key: 'Esc', label: 'إغلاق' },
            ].map(s => (
              <span key={s.key} className="flex items-center gap-1 text-[10px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                <kbd className="px-1 py-0.5 rounded text-[9px] font-mono font-bold" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-heading)' }}>{s.key}</kbd>
                {s.label}
              </span>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {products.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-40">
                <Package className="w-16 h-16 mb-3" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>جاري تحميل المنتجات...</p>
                <button onClick={() => fullSync()} className="mt-3 px-4 py-2 rounded-lg text-xs font-bold" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>تحديث</button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-40">
                <Package className="w-16 h-16 mb-3" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>لا توجد منتجات</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 lg:gap-3">{filtered.map(product => {
                const branchQty = Number(branchStock[product.id] ?? 0)
                const outOfStock = !!product.track_stock && branchQty <= 0
                const lowStock = !!product.track_stock && !outOfStock && product.low_stock_threshold && branchQty <= product.low_stock_threshold
                return (
                  <button key={product.id} onClick={() => addItem(product)} className="relative flex flex-col items-center p-3 lg:p-4 rounded-2xl border transition-all active:scale-95 hover:border-[var(--primary)]/30" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)', opacity: outOfStock ? 0.5 : 1, cursor: outOfStock ? 'not-allowed' : 'pointer' }}>
                    {product.primary_image_url ? <img src={product.primary_image_url} alt="" className="w-10 h-10 lg:w-12 lg:h-12 rounded-lg object-cover mb-1.5" /> : <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-lg flex items-center justify-center mb-1.5" style={{ background: 'var(--bg-input)' }}><ImageIcon className="w-5 h-5 lg:w-6 lg:h-6" style={{ color: 'var(--text-muted)' }} /></div>}
                    <p className="text-[11px] lg:text-xs font-bold text-center leading-tight" style={{ color: 'var(--text-heading)' }}>{product.name}</p>
                    <p className="text-[11px] lg:text-xs font-bold mt-0.5" style={{ color: 'var(--primary)' }}>{formatEGP(product.selling_price)}</p>
                    <p className="text-[9px] lg:text-[10px] mt-0.5" style={{ color: outOfStock ? '#ef4444' : 'var(--text-muted)' }}>المخزون: {branchQty}</p>
                    {outOfStock && (
                      <span className="absolute top-1 left-1 text-[8px] px-1 py-0.5 rounded font-bold" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>نفذ</span>
                    )}
                    {lowStock && (
                      <span className="absolute top-1 left-1 text-[8px] px-1 py-0.5 rounded font-bold" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>مخزون منخفض</span>
                    )}
                  </button>
                )
              })}</div>
            )}
          </div>
        </div>
      </div>

      {/* Receipt Confirmation */}
      {showReceipt && lastOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="p-8 rounded-2xl shadow-2xl text-center max-w-sm w-full" style={{ background: 'var(--bg-card)' }}>
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--success)' }}><Check className="w-8 h-8 text-white" /></div>
            <h3 className="text-xl font-black mb-2" style={{ color: 'var(--text-heading)' }}>تم الدفع بنجاح!</h3>
            <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>رقم الطلب: {lastOrder.order_ref}</p>
            <p className="text-lg font-bold mb-4" style={{ color: 'var(--success)' }}>{formatEGP(lastOrder.total)}</p>
            {!isOnline && <p className="text-xs mb-4 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>سيتم المزامنة عند عودة الاتصال</p>}
            <div className="flex flex-col gap-2">
              <button onClick={printReceipt} className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2" style={{ background: 'var(--bg-input)', color: 'var(--text-main)' }}>
                <Printer className="w-4 h-4" />طباعة الإيصال
              </button>
              <button onClick={() => { setShowReceipt(false); setLastOrder(null) }} className="w-full py-3 rounded-xl font-bold text-sm" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>عملية جديدة</button>
            </div>
          </div>
        </div>
      )}

      {/* Open Shift Modal */}
      {showShiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="p-6 rounded-2xl shadow-2xl max-w-sm w-full" style={{ background: 'var(--bg-card)' }}>
            <h3 className="text-lg font-black mb-4" style={{ color: 'var(--text-heading)' }}>فتح وردية جديدة</h3>
            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>أدخل مبلغ الكاش في الدرج عند بداية الوردية</p>
            <input type="number" value={shiftCash || ''} onChange={e => setShiftCash(Number(e.target.value))} placeholder="المبلغ الابتدائي" className="w-full px-3 py-3 rounded-xl border text-sm mb-4" dir="ltr" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
            <div className="flex gap-2">
              <button onClick={() => setShowShiftModal(false)} className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>إلغاء</button>
              <button onClick={handleOpenShift} className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>فتح الوردية</button>
            </div>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {showCloseShift && activeShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="p-6 rounded-2xl shadow-2xl max-w-md w-full" style={{ background: 'var(--bg-card)' }}>
            <h3 className="text-lg font-black mb-4" style={{ color: 'var(--text-heading)' }}>إغلاق الوردية</h3>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm"><span style={{ color: 'var(--text-muted)' }}>كاش البداية</span><span style={{ color: 'var(--text-heading)' }}>{formatEGP(activeShift.starting_cash)}</span></div>
              <div className="flex justify-between text-sm"><span style={{ color: 'var(--text-muted)' }}>إجمالي المبيعات</span><span style={{ color: 'var(--success)' }}>{formatEGP(activeShift.total_sales)}</span></div>
              <div className="flex justify-between text-sm"><span style={{ color: 'var(--text-muted)' }}>عدد الطلبات</span><span style={{ color: 'var(--text-heading)' }}>{activeShift.total_orders}</span></div>
              <div className="flex justify-between text-sm font-bold"><span style={{ color: 'var(--text-muted)' }}>المتوقع في الدرج</span><span style={{ color: 'var(--text-heading)' }}>{formatEGP(activeShift.starting_cash + activeShift.total_sales - activeShift.total_refunds)}</span></div>
            </div>
            <input type="number" value={closeCash || ''} onChange={e => setCloseCash(Number(e.target.value))} placeholder="الكاش الفعلي في الدرج" className="w-full px-3 py-3 rounded-xl border text-sm mb-4" dir="ltr" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
            <div className="flex gap-2">
              <button onClick={() => setShowCloseShift(false)} className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>إلغاء</button>
              <button onClick={handleCloseShift} className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: 'var(--danger)', color: '#fff' }}>إغلاق الوردية</button>
            </div>
          </div>
        </div>
      )}

      {/* Held Orders Modal */}
      {showHeldOrders && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="p-6 rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black" style={{ color: 'var(--text-heading)' }}>طلبات معلقة ({cart.heldCarts.length})</h3>
              <button onClick={() => setShowHeldOrders(false)} style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
            </div>
            {cart.heldCarts.length === 0 ? (
              <p className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>لا توجد طلبات معلقة</p>
            ) : (
              <div className="space-y-3">
                {cart.heldCarts.map(held => (
                  <div key={held.id} className="p-3 rounded-xl border" style={{ borderColor: 'var(--border-light)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{held.name}</span>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{new Date(held.held_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{held.items.length} منتجات — {formatEGP(held.items.reduce((s, i) => s + i.price * i.quantity, 0))}</p>
                    <div className="flex gap-2">
                      <button onClick={() => { cart.resumeCart(held.id); setShowHeldOrders(false) }} className="flex-1 py-2 rounded-lg text-xs font-bold" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>استرجاع</button>
                      <button onClick={() => cart.removeHeldCart(held.id)} className="py-2 px-3 rounded-lg text-xs font-bold" style={{ background: 'var(--bg-input)', color: 'var(--danger)' }}>حذف</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Link Orders Panel */}
      {showLinkOrders && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="p-5 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                <h3 className="text-base font-black" style={{ color: 'var(--text-heading)' }}>طلبات الدفع الإلكتروني</h3>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={fetchLinkOrders} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }} title="تحديث">
                  <Loader2 className={`w-4 h-4 ${linkOrdersLoading ? 'animate-spin' : ''}`} />
                </button>
                <button onClick={() => setShowLinkOrders(false)} style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2">
              {linkOrders.length === 0 && !linkOrdersLoading && (
                <p className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>لا توجد طلبات دفع إلكتروني</p>
              )}
              {linkOrders.map(tx => (
                <div key={tx.id} className="p-3 rounded-xl border" style={{ borderColor: 'var(--border-light)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${tx.status === 'paid' ? 'text-green-700' : 'text-amber-700'}`}
                        style={{ background: tx.status === 'paid' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)' }}>
                        {tx.status === 'paid' ? '✅ مدفوع' : '⏳ معلق'}
                      </span>
                      <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>#{tx.paymob_order_id}</span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{formatEGP((tx.amount_cents || 0) / 100)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {tx.customer_phone} — {new Date(tx.created_at).toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {tx.payment_link && (
                      <a href={tx.payment_link} target="_blank" rel="noopener noreferrer" className="text-xs underline" style={{ color: 'var(--primary)' }}>فتح الرابط</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Printer Preference Modal */}
      {showPrinterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="p-6 rounded-2xl shadow-2xl max-w-sm w-full" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                <h3 className="text-base font-black" style={{ color: 'var(--text-heading)' }}>إعداد الطابعة (لهذا الجهاز)</h3>
              </div>
              <button onClick={() => setShowPrinterModal(false)} style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              أدخل اسم الطابعة المفضلة لهذا الجهاز. يُحفظ محلياً ولا يؤثر على الأجهزة الأخرى.
              عند الطباعة سيتم فتح نافذة الطباعة واختيار الطابعة يدوياً منها.
            </p>
            <div className="mb-4">
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>اسم الطابعة (تذكر)</label>
              <input value={printerName} onChange={e => setPrinterName(e.target.value)} placeholder="مثال: Epson TM-T88, POS-80" className="w-full px-3 py-2.5 rounded-xl border text-sm" dir="ltr" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
            </div>
            <div className="p-3 rounded-xl text-xs mb-4" style={{ background: 'rgba(16,185,129,0.07)', color: 'var(--text-muted)' }}>
              💡 المتصفح هو من يتحكم في اختيار الطابعة الفعلية. ستظهر هنا كتذكير عند الطباعة.
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowPrinterModal(false)} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>إلغاء</button>
              <button onClick={() => { localStorage.setItem('pos_printer_name', printerName); setShowPrinterModal(false); toast.success(`تم حفظ الطابعة: ${printerName || 'افتراضي'}`); }} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>حفظ</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Link Modal */}
      {showPaymentLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="p-6 rounded-2xl shadow-2xl max-w-sm w-full" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                <h3 className="text-base font-black" style={{ color: 'var(--text-heading)' }}>دفع إلكتروني — رابط دفع</h3>
              </div>
              <button onClick={() => { setShowPaymentLinkModal(false); setLinkUrl(''); setLinkPhone(''); setLinkCustomerName('') }} style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
            </div>

            {!linkUrl ? (
              <>
                <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                  أدخل بيانات العميل لإنشاء رابط الدفع
                </p>
                <div className="mb-3">
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>اسم العميل</label>
                  <input value={linkCustomerName} onChange={e => setLinkCustomerName(e.target.value)} placeholder="اسم العميل" className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>رقم الهاتف <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(01x أو +201x)</span></label>
                  <div className="relative">
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <input value={linkPhone} onChange={e => setLinkPhone(e.target.value)}
                      onBlur={e => {
                        let v = e.target.value.replace(/[\s\-()]/g, '')
                        if (v.startsWith('00')) v = '+' + v.slice(2)
                        else if (v.startsWith('0')) v = '+2' + v
                        else if (v.length > 4 && !v.startsWith('+')) v = '+20' + v
                        setLinkPhone(v)
                      }}
                      placeholder="01xxxxxxxxx" className="w-full pr-10 px-3 py-2.5 rounded-xl border text-sm" dir="ltr" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                  </div>
                </div>
                {(() => {
                  const delivery = orgAny?.electronic_payment_config?.link_delivery?.method || 'manual'
                  if (delivery === 'manual') return null
                  return (
                    <div className="mb-3 p-2.5 rounded-xl text-xs" style={{ background: 'rgba(37,99,235,0.06)', color: 'var(--primary)' }}>
                      {delivery === 'sms' ? '📱 سيتم إرسال الرابط عبر SMS تلقائياً' : '💬 سيتم إرسال الرابط عبر WhatsApp تلقائياً'}
                    </div>
                  )
                })()}
                <div className="p-3 rounded-xl mb-4 text-sm font-bold flex justify-between" style={{ background: 'var(--bg-input)', color: 'var(--text-heading)' }}>
                  <span>الإجمالي</span><span>{formatEGP(total)}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowPaymentLinkModal(false)} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>إلغاء</button>
                  <button onClick={handlePaymentLinkCheckout} disabled={linkLoading || processing} className="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
                    {linkLoading || processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                    إنشاء رابط الدفع
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-3">
                  <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)' }}>
                    <Check className="w-6 h-6" style={{ color: 'var(--success)' }} />
                  </div>
                  <p className="font-bold text-sm" style={{ color: 'var(--text-heading)' }}>تم إنشاء رابط الدفع!</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {linkDeliveryChoice === 'whatsapp' ? '💬 تم الإرسال عبر WhatsApp' : linkDeliveryChoice === 'sms' ? '📱 تم الإرسال عبر SMS' : 'وجّه العميل للمسح أو شارك الرابط'}
                  </p>
                </div>
                {/* QR Code — only shown for manual delivery: customer scans on screen */}
                {linkDeliveryChoice === 'manual' && (
                  <div className="flex justify-center mb-3">
                    <div className="p-2 rounded-xl" style={{ background: '#fff' }}>
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(linkUrl)}&bgcolor=ffffff&color=000000&margin=4`}
                        alt="QR Code"
                        className="w-40 h-40"
                      />
                    </div>
                  </div>
                )}
                <div className="p-2.5 rounded-xl mb-3 break-all text-xs font-mono border" dir="ltr" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  {linkUrl}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { navigator.clipboard.writeText(linkUrl); toast.success('تم نسخ الرابط') }} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: 'var(--bg-input)', color: 'var(--text-heading)' }}>
                    نسخ
                  </button>
                  <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="flex-1 py-2.5 rounded-xl font-bold text-sm text-center" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
                    فتح الرابط
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Deferred (آجل) Confirmation Modal */}
      {showDeferredModal && !deferredDone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="p-6 rounded-2xl shadow-2xl max-w-sm w-full" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" style={{ color: '#f59e0b' }} />
                <h3 className="text-base font-black" style={{ color: 'var(--text-heading)' }}>دفع آجل</h3>
              </div>
              <button onClick={() => setShowDeferredModal(false)} style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              سيتم تسجيل الطلب كدفع آجل. سيحصل العميل على رقم الطلب لاستخدامه عند السداد لاحقاً.
            </p>
            <div className="p-3 rounded-xl mb-4 text-sm font-bold flex justify-between" style={{ background: 'var(--bg-input)', color: 'var(--text-heading)' }}>
              <span>الإجمالي المستحق</span><span>{formatEGP(total)}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowDeferredModal(false)} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>إلغاء</button>
              <button onClick={handleDeferredCheckout} disabled={processing || cart.items.length === 0} className="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2" style={{ background: '#f59e0b', color: '#fff' }}>
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                تأكيد الطلب الآجل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deferred Success Modal */}
      {deferredDone && deferredOrderRef && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="p-8 rounded-2xl shadow-2xl text-center max-w-sm w-full" style={{ background: 'var(--bg-card)' }}>
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: '#f59e0b' }}>
              <Clock className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-black mb-2" style={{ color: 'var(--text-heading)' }}>تم تسجيل الطلب الآجل</h3>
            <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>رقم الطلب للعميل:</p>
            <div className="p-4 rounded-xl mb-4 text-2xl font-black tracking-widest" dir="ltr" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '2px dashed #f59e0b' }}>
              {deferredOrderRef}
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              يرجى إعطاء هذا الرقم للعميل. يمكن تسديد الطلب لاحقاً من صفحة الطلبات.
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={() => { navigator.clipboard.writeText(deferredOrderRef); toast.success('تم نسخ رقم الطلب') }} className="w-full py-3 rounded-xl font-bold text-sm" style={{ background: 'var(--bg-input)', color: 'var(--text-heading)' }}>
                نسخ رقم الطلب
              </button>
              <button onClick={() => printReceipt()} className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2" style={{ background: 'var(--bg-input)', color: 'var(--text-main)' }}>
                <Printer className="w-4 h-4" />طباعة إيصال
              </button>
              <button onClick={() => { setDeferredDone(false); setDeferredOrderRef(''); setShowDeferredModal(false); setLastOrder(null) }} className="w-full py-3 rounded-xl font-bold text-sm" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>عملية جديدة</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* Split Payment Panel */
function SplitPaymentPanel({ splitPayments, remaining, onAdd, onRemove }: { splitPayments: SplitPayment[]; remaining: number; onAdd: (p: SplitPayment) => void; onRemove: (i: number) => void }) {
  const [method, setMethod] = useState('cash')
  const [amount, setAmount] = useState(0)

  return (
    <div className="p-2 rounded-xl border space-y-2" style={{ borderColor: 'var(--border-light)', background: 'var(--bg-input)' }}>
      <p className="text-xs font-bold" style={{ color: 'var(--text-heading)' }}>تقسيم الدفع — المتبقي: {formatEGP(remaining)}</p>
      {splitPayments.map((p, i) => (
        <div key={i} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg" style={{ background: 'var(--bg-card)' }}>
          <span style={{ color: 'var(--text-main)' }}>{p.method === 'cash' ? 'كاش' : 'فيزا'}: {formatEGP(p.amount)}</span>
          <button onClick={() => onRemove(i)} style={{ color: 'var(--danger)' }}><X className="w-3 h-3" /></button>
        </div>
      ))}
      {remaining > 0.01 && (
        <div className="flex items-center gap-1.5">
          <select value={method} onChange={e => setMethod(e.target.value)} className="px-2 py-1.5 rounded-md border text-xs" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
            <option value="cash">كاش</option>
            <option value="card">فيزا</option>
          </select>
          <input type="number" value={amount || ''} onChange={e => setAmount(Number(e.target.value))} placeholder="المبلغ" className="flex-1 px-2 py-1.5 rounded-md border text-xs text-left" dir="ltr" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
          <button onClick={() => { if (amount > 0) { onAdd({ method, amount: Math.min(amount, remaining) }); setAmount(0) } }} className="px-2 py-1.5 rounded-md text-xs font-bold" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>+</button>
        </div>
      )}
    </div>
  )
}

