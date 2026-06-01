import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    // Verify the JWT token
    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { order_id, amount_cents, tenant_id } = await req.json()

    if (!order_id || !amount_cents || !tenant_id) {
      return new Response(JSON.stringify({ error: "order_id, amount_cents, and tenant_id are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Get tenant's Paymob config
    const { data: org } = await supabase
      .from("organizations")
      .select("electronic_payment_config")
      .eq("tenant_id", tenant_id)
      .maybeSingle()

    const paymobConfig = org?.electronic_payment_config?.gateways?.paymob
    if (!paymobConfig?.public_key) {
      return new Response(JSON.stringify({ error: "Paymob not configured for this tenant" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Lookup paymob_transaction for this order
    const { data: tx } = await supabase
      .from("paymob_transactions")
      .select("id, paymob_transaction_id, paymob_order_id, amount_cents, status")
      .eq("offline_order_id", order_id)
      .eq("status", "paid")
      .maybeSingle()

    if (!tx?.paymob_transaction_id) {
      return new Response(JSON.stringify({ error: "No paid Paymob transaction found for this order" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Call Paymob Refund API
    const refundRes = await fetch("https://accept.paymob.com/api/acceptance/void_refund/refund", {
      method: "POST",
      headers: {
        "Authorization": `Token ${paymobConfig.public_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transaction_id: String(tx.paymob_transaction_id),
        amount_cents: String(amount_cents),
      }),
    })

    const refundData = await refundRes.json()
    console.log("[refund-paymob] Paymob response:", JSON.stringify(refundData))

    if (!refundRes.ok || refundData?.success === false) {
      return new Response(JSON.stringify({
        error: "Paymob refund failed",
        details: refundData?.message || refundData,
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Update paymob_transactions status
    await supabase
      .from("paymob_transactions")
      .update({
        status: amount_cents >= tx.amount_cents ? "refunded" : "partially_refunded",
        refund_amount_cents: amount_cents,
        refunded_at: new Date().toISOString(),
      })
      .eq("id", tx.id)

    return new Response(JSON.stringify({
      success: true,
      refund_id: refundData?.id || null,
      transaction_id: tx.paymob_transaction_id,
      refund_amount_cents: amount_cents,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (err) {
    console.error("[refund-paymob] Error:", err)
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
