import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const supabase = createClient(supabaseUrl, supabaseKey)

    const body = await req.json()
    const { tenant_id, offline_order_id, order_ref, amount_cents, customer_phone, customer_name, link_delivery } = body

    if (!amount_cents || amount_cents <= 0) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } })
    }

    const { data: org, error: orgError } = await supabase
      .from("organization_profile")
      .select("electronic_payment_config")
      .limit(1)
      .maybeSingle()

    if (orgError || !org) {
      return new Response(JSON.stringify({ error: "Organization not found" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } })
    }

    const epConfig = org.electronic_payment_config || {}
    const paymob = epConfig?.gateways?.paymob || {}

    if (!epConfig.enabled || !paymob.enabled) {
      return new Response(JSON.stringify({ error: "الدفع الإلكتروني غير مفعّل — فعّله من الإعدادات" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } })
    }

    if (!paymob.public_key?.trim()) {
      return new Response(JSON.stringify({ error: "API Key غير مُضاف — أضفه من الإعدادات" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } })
    }

    const integrationIds = []
    if (paymob.allow_card && paymob.card_integration_id) integrationIds.push(String(paymob.card_integration_id).trim())
    if (paymob.allow_wallet && paymob.wallet_integration_id) integrationIds.push(String(paymob.wallet_integration_id).trim())

    if (integrationIds.length === 0) {
      return new Response(JSON.stringify({ error: "لم يتم تفعيل أي طريقة دفع — فعّل البطاقة أو المحفظة وأضف Integration ID من الإعدادات" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } })
    }

    const authRes = await fetch("https://accept.paymob.com/api/auth/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: paymob.public_key.trim() }),
    })

    if (!authRes.ok) {
      const authErr = await authRes.text()
      console.error("[create-paymob-payment] Auth failed:", authRes.status, authErr)
      throw new Error(authRes.status === 401
        ? "API Key غير صحيح — تحقق من Paymob Dashboard → API Keys"
        : "Paymob auth error (" + authRes.status + "): " + authErr)
    }

    const authData = await authRes.json()
    const authToken = authData.token
    if (!authToken) throw new Error("Paymob auth did not return a token")

    let phone = (customer_phone || "").replace(/[\s\-()]/g, "")
    if (phone.startsWith("00")) phone = "+" + phone.slice(2)
    else if (phone.startsWith("0")) phone = "+2" + phone
    else if (!phone.startsWith("+")) phone = "+20" + phone
    phone = "+" + phone.replace(/[^0-9]/g, "")
    if (phone.length < 8) phone = "+201000000000"

    const refId = order_ref || offline_order_id || "pos_" + Date.now()
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19)
    const isLive = paymob.is_live === true ? "true" : "false"

    const formData = new FormData()
    formData.append("amount_cents", String(amount_cents))
    for (const id of integrationIds) {
      formData.append("payment_methods", id)
    }
    formData.append("reference_id", refId)
    formData.append("phone_number", phone)
    formData.append("full_name", customer_name || "عميل")
    formData.append("email", "pos_" + Date.now() + "@checkout.local")
    formData.append("is_live", isLive)
    formData.append("description", "طلب " + refId)
    formData.append("expires_at", expires)

    console.log("[create-paymob-payment] Creating link — integrations:", integrationIds.join(","), "| is_live:", isLive)

    const linkRes = await fetch("https://accept.paymob.com/api/ecommerce/payment-links", {
      method: "POST",
      headers: { "Authorization": "Bearer " + authToken },
      body: formData,
    })

    if (!linkRes.ok) {
      const errText = await linkRes.text()
      console.error("[create-paymob-payment] QuickLink failed:", linkRes.status, errText)
      if (linkRes.status === 404) {
        throw new Error("Integration ID غير موجود (" + integrationIds.join(",") + ") — تحقق من Paymob Dashboard → Settings → Payment Integrations")
      }
      throw new Error("Paymob QuickLink (" + linkRes.status + "): " + errText)
    }

    const linkData = await linkRes.json()
    const paymentLink = linkData.shorten_url || linkData.client_url || ""

    // linkData.order is the Paymob ORDER ID (a plain number like 453331462)
    // linkData.id is the payment LINK record ID — webhook uses order ID to match
    const rawOrder = linkData.order
    const paymobOrderId = String(
      (typeof rawOrder === "object" && rawOrder !== null ? rawOrder.id : rawOrder) || linkData.id || ""
    )

    if (!paymentLink) throw new Error("Paymob did not return a payment URL")

    console.log("[create-paymob-payment] Done — paymob_order_id:", paymobOrderId, "| link:", paymentLink)

    await supabase.from("paymob_transactions").insert({
      tenant_id: tenant_id || null,
      offline_order_id: offline_order_id || null,
      paymob_order_id: paymobOrderId,
      amount_cents,
      currency: "EGP",
      status: "pending",
      payment_link: paymentLink,
      shorten_url: paymentLink,
      customer_phone: customer_phone || null,
      sending_method: link_delivery?.method || "manual",
      payload: { order_ref, paymob_link_id: linkData.id, paymob_order_id: paymobOrderId },
    })

    const sendMethod = link_delivery?.method || "manual"
    const smsConfig = epConfig?.link_delivery?.sms || {}
    const waConfig = epConfig?.link_delivery?.whatsapp || {}
    const msg = "رابط دفع طلبك: " + paymentLink

    if (sendMethod === "sms" && phone && smsConfig.api_url && smsConfig.api_key) {
      try {
        const provider = smsConfig.provider || "generic"
        let smsBody
        const smsHeaders = { "Content-Type": "application/json" }

        if (provider === "smsmisr") {
          smsBody = JSON.stringify({ username: smsConfig.username || "", password: smsConfig.password || smsConfig.api_key, language: "2", sender: smsConfig.sender_id || "Notify", mobile: phone.replace("+", ""), message: msg })
        } else if (provider === "vodafone") {
          smsHeaders["Authorization"] = "Bearer " + smsConfig.api_key
          smsBody = JSON.stringify({ from: smsConfig.sender_id || "POS", to: [phone], sms: msg })
        } else {
          smsHeaders["Authorization"] = "Bearer " + smsConfig.api_key
          smsBody = JSON.stringify({ to: phone, message: msg, sender_id: smsConfig.sender_id || "POS" })
        }

        const smsRes = await fetch(smsConfig.api_url, { method: "POST", headers: smsHeaders, body: smsBody })
        if (!smsRes.ok) console.error("[create-paymob-payment] SMS failed:", smsRes.status)
        else console.log("[create-paymob-payment] SMS sent to:", phone)
      } catch (smsErr) {
        console.error("[create-paymob-payment] SMS error:", smsErr)
      }
    } else if (sendMethod === "whatsapp" && phone && waConfig.phone_number_id && waConfig.access_token) {
      try {
        const waRes = await fetch(
          "https://graph.facebook.com/v18.0/" + waConfig.phone_number_id + "/messages",
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + waConfig.access_token },
            body: JSON.stringify({ messaging_product: "whatsapp", to: phone.replace("+", ""), type: "text", text: { body: msg } }),
          }
        )
        if (!waRes.ok) console.error("[create-paymob-payment] WhatsApp failed:", waRes.status, await waRes.text())
        else console.log("[create-paymob-payment] WhatsApp sent to:", phone)
      } catch (waErr) {
        console.error("[create-paymob-payment] WhatsApp error:", waErr)
      }
    }

    return new Response(
      JSON.stringify({ payment_link: paymentLink, paymob_order_id: paymobOrderId, delivery_method: sendMethod }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    )

  } catch (err) {
    console.error("[create-paymob-payment] Error:", err.message)
    return new Response(
      JSON.stringify({ error: err.message || "خطأ داخلي" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    )
  }
})
