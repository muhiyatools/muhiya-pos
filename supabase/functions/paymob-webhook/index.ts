import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getAuthToken(apiKey) {
  try {
    const res = await fetch("https://accept.paymob.com/api/auth/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey }),
    })
    if (!res.ok) return null
    return (await res.json()).token || null
  } catch { return null }
}

async function transactionInquiry(authToken, orderId, merchantOrderId) {
  const res = await fetch("https://accept.paymob.com/api/ecommerce/orders/transaction_inquiry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ auth_token: authToken, order_id: orderId, merchant_order_id: merchantOrderId }),
  })
  if (!res.ok) {
    console.warn("[paymob-webhook] transaction_inquiry failed:", res.status, await res.text())
    return null
  }
  return res.json()
}

async function markPaid(supabase, tx, txData, rawBody) {
  const rawOrder = txData?.order
  const paymobOrderId = String(
    (typeof rawOrder === "object" && rawOrder !== null ? rawOrder?.id : rawOrder) ||
    tx.paymob_order_id || ""
  )

  await supabase.from("paymob_transactions").update({
    status: "paid",
    paid_at: new Date().toISOString(),
    paymob_transaction_id: String(txData?.id || ""),
    ...(paymobOrderId ? { paymob_order_id: paymobOrderId } : {}),
    webhook_payload: rawBody,
  }).eq("id", tx.id)

  const orderId = tx.order_id || tx.offline_order_id
  if (orderId) {
    const { data: order } = await supabase
      .from("orders")
      .update({ payment_status: "paid" })
      .eq("id", orderId)
      .select("id, total, order_ref, tenant_id, branch_id, created_at")
      .single()

    if (order) {
      await supabase.from("income_entries").insert({
        source: "sales",
        amount: order.total,
        description: "طلب " + (order.order_ref || orderId),
        income_date: (order.created_at || new Date().toISOString()).split("T")[0],
        is_recurring: false,
        ...(order.tenant_id ? { tenant_id: order.tenant_id } : {}),
        ...(order.branch_id ? { branch_id: order.branch_id } : {}),
      })
    }
  }

  console.log("[paymob-webhook] ✅ MARKED PAID — tx_id:", tx.id, "| order:", orderId, "| paymob_order:", paymobOrderId)
}

// ── Main ──────────────────────────────────────────────────────────────────────

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const supabase = createClient(supabaseUrl, supabaseKey)

    let body = {}
    try { body = (await req.json()) || {} } catch { return new Response("OK", { status: 200 }) }

    // Paymob sends two event types to the same webhook URL:
    //   1. Intention events  -> body.intention.intention_detail exists
    //   2. Transaction events -> body.obj.success exists
    const isIntentionEvent = Boolean(body?.intention?.intention_detail)
    const isTransactionEvent = body?.obj?.success !== undefined

    // ── 1. INTENTION EVENT ───────────────────────────────────────────────────
    // Fires when a payment link is created or its status changes.
    // We call transaction_inquiry to check if payment has already completed.
    if (isIntentionEvent) {
      const items = body?.intention?.intention_detail?.items || []
      const description = items[0]?.description || ""

      // Our order ref is in the description: "طلب ORD-XXXX"
      const match = description.match(/ORD-[A-Z0-9]+/)
      const orderRef = match ? match[0] : null

      console.log("[paymob-webhook] 🔵 Intention event — orderRef:", orderRef ?? "not found in description")

      if (orderRef) {
        const { data: txRows } = await supabase
          .from("paymob_transactions")
          .select("id, paymob_order_id, order_id, offline_order_id, tenant_id, status, payload")
          .eq("payload->>order_ref", orderRef)
          .limit(1)

        const tx = txRows?.[0]

        if (!tx) {
          console.warn("[paymob-webhook] No transaction found for orderRef:", orderRef)
        } else if (tx.status === "paid") {
          console.log("[paymob-webhook] Already paid — skipping")
        } else {
          const { data: org } = await supabase
            .from("organization_profile")
            .select("electronic_payment_config")
            .limit(1)
            .maybeSingle()

          const apiKey = org?.electronic_payment_config?.gateways?.paymob?.public_key || ""

          if (!apiKey) {
            console.warn("[paymob-webhook] No Paymob API key in config")
          } else {
            const authToken = await getAuthToken(apiKey)
            if (!authToken) {
              console.warn("[paymob-webhook] Could not get auth token")
            } else {
              const txData = await transactionInquiry(authToken, tx.paymob_order_id || "", orderRef)
              if (txData) {
                const isSuccess = txData?.success === true || txData?.success === "true"
                const isPending = txData?.pending === true || txData?.pending === "true"
                console.log("[paymob-webhook] Inquiry — success:", isSuccess, "| pending:", isPending, "| trnx_id:", txData?.id)
                if (isSuccess && !isPending) {
                  await markPaid(supabase, tx, txData, body)
                } else {
                  console.log("[paymob-webhook] Payment not completed yet — will retry on next webhook event")
                }
              }
            }
          }
        }
      }

      return new Response("OK", { status: 200 })
    }

    // ── 2. TRANSACTION EVENT ─────────────────────────────────────────────────
    // Direct transaction webhook from "Transaction Processed Callback".
    if (isTransactionEvent) {
      const txObj = body.obj
      const rawOrder = txObj?.order

      const paymobOrderId = String(
        (typeof rawOrder === "object" && rawOrder !== null ? rawOrder?.id : rawOrder) ||
        txObj?.order_id || ""
      )
      const merchantOrderId = String(
        (typeof rawOrder === "object" && rawOrder !== null ? rawOrder?.merchant_order_id : null) ||
        txObj?.merchant_order_id || ""
      )

      const isSuccess = txObj?.success === true || txObj?.success === "true"
      const isPending = txObj?.pending === true || txObj?.pending === "true"

      console.log("[paymob-webhook] 🟢 Transaction event — order:", paymobOrderId, "| merchant:", merchantOrderId, "| success:", isSuccess, "| pending:", isPending)

      if (!isSuccess || isPending) {
        return new Response("OK", { status: 200 })
      }

      let tx = null

      if (paymobOrderId) {
        const { data: rows } = await supabase
          .from("paymob_transactions")
          .select("id, order_id, offline_order_id, tenant_id, payload")
          .eq("paymob_order_id", paymobOrderId)
          .limit(1)
        if (rows?.length) tx = rows[0]
      }

      if (!tx && merchantOrderId) {
        const { data: rows } = await supabase
          .from("paymob_transactions")
          .select("id, order_id, offline_order_id, tenant_id, payload")
          .eq("payload->>order_ref", merchantOrderId)
          .limit(1)
        if (rows?.length) tx = rows[0]
      }

      if (!tx) {
        console.warn("[paymob-webhook] ❌ Transaction not found — order:", paymobOrderId)
        return new Response("OK", { status: 200 })
      }

      await markPaid(supabase, tx, txObj, body)
      return new Response("OK", { status: 200 })
    }

    console.log("[paymob-webhook] Unknown event type — ignoring")
    return new Response("OK", { status: 200 })

  } catch (err) {
    console.error("[paymob-webhook] ERROR:", err instanceof Error ? err.message : String(err))
    return new Response("Internal error", { status: 500 })
  }
})
