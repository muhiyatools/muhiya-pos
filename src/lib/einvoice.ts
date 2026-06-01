/**
 * Egyptian Tax Authority (ETA) e-Invoice Integration
 * Based on: https://sdk.invoicing.eta.gov.eg/
 * 
 * OAuth 2.0 Client Credentials flow.
 * Production auth: https://id.invoicing.eta.gov.eg
 * Production API: https://api.invoicing.eta.gov.eg/api/v1
 * Preproduction auth: https://id.preprod.eta.gov.eg
 * Preproduction API: https://api.preprod.eta.gov.eg/api/v1
 */

export type EInvoiceEnv = 'production' | 'preproduction'

export interface EInvoiceConfig {
  clientId: string
  clientSecret: string
  env: EInvoiceEnv
  registrationNumber: string
}

const HOSTS = {
  production: {
    auth: 'https://id.invoicing.eta.gov.eg',
    api: 'https://api.invoicing.eta.gov.eg/api/v1',
  },
  preproduction: {
    auth: 'https://id.preprod.eta.gov.eg',
    api: 'https://api.preprod.eta.gov.eg/api/v1',
  },
}

interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

let cachedToken: { token: string; expiresAt: number } | null = null

export async function getETAToken(config: EInvoiceConfig): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token
  }

  const host = HOSTS[config.env].auth
  const credentials = btoa(`${config.clientId}:${config.clientSecret}`)

  const res = await fetch(`${host}/connect/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error_description || `ETA auth failed: ${res.status}`)
  }

  const data: TokenResponse = await res.json()
  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  }
  return data.access_token
}

export interface ETAInvoiceItem {
  description: string
  itemType: 'GS1' | 'EGS' | 'FREE_TEXT'
  itemCode: string
  unitType: string
  quantity: number
  internalCode: string
  salesTotal: number
  total: number
  valueDifference: number
  totalTaxableFees: number
  netTotal: number
  taxableItems: { taxType: string; amount: number; subType: string; rate: number }[]
  originalValue: number
  discount: { rate: number; amount: number }
  unitValue: { currencySold: string; amountEGP: number }
}

export interface ETAInvoice {
  issuer: {
    address: { branchID: string; country: string; governate: string; regionCity: string; street: string; buildingNumber: string; postalCode: string }
    type: 'B' | 'P'
    id: string
    name: string
  }
  receiver: {
    address?: { country: string; governate?: string; regionCity?: string; street?: string; buildingNumber?: string; postalCode?: string }
    type: 'B' | 'P' | 'F'
    id?: string
    name: string
  }
  documentType: 'I' | 'C' | 'D' // Invoice / Credit / Debit
  documentTypeVersion: '1.0'
  dateTimeIssued: string // ISO 8601
  taxpayerActivityCode: string
  internalID: string
  invoiceLines: ETAInvoiceItem[]
  taxTotals: { taxType: string; amount: number }[]
  totalDiscountAmount: number
  totalSalesAmount: number
  netAmount: number
  totalAmount: number
  extraDiscountAmount: number
  totalItemsDiscountAmount: number
}

export async function submitInvoices(config: EInvoiceConfig, documents: ETAInvoice[]) {
  const token = await getETAToken(config)
  const apiBase = HOSTS[config.env].api

  const res = await fetch(`${apiBase}/documentsubmissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ documents }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `ETA submission failed: ${res.status}`)
  }

  return res.json()
}

/** Build a minimal B2C receipt-style invoice from a POS order */
export function buildInvoiceFromOrder(
  order: { id: string; total: number; created_at: string; items: { name: string; quantity: number; unit_price: number; total: number }[] },
  config: EInvoiceConfig,
  orgInfo: { name: string; address: string; taxNumber: string; activityCode: string }
): ETAInvoice {
  const now = new Date(order.created_at).toISOString()

  const lines: ETAInvoiceItem[] = order.items.map((item, idx) => ({
    description: item.name,
    itemType: 'FREE_TEXT',
    itemCode: `ITEM-${idx + 1}`,
    unitType: 'EA',
    quantity: item.quantity,
    internalCode: `${idx + 1}`,
    salesTotal: item.total,
    total: item.total,
    valueDifference: 0,
    totalTaxableFees: 0,
    netTotal: item.total,
    taxableItems: [],
    originalValue: item.unit_price,
    discount: { rate: 0, amount: 0 },
    unitValue: { currencySold: 'EGP', amountEGP: item.unit_price },
  }))

  return {
    issuer: {
      type: 'B',
      id: orgInfo.taxNumber || config.registrationNumber,
      name: orgInfo.name,
      address: { branchID: '0', country: 'EG', governate: 'Cairo', regionCity: 'Cairo', street: orgInfo.address, buildingNumber: '1', postalCode: '11511' },
    },
    receiver: {
      type: 'P',
      name: 'مستهلك',
    },
    documentType: 'I',
    documentTypeVersion: '1.0',
    dateTimeIssued: now,
    taxpayerActivityCode: orgInfo.activityCode || '4711',
    internalID: order.id.substring(0, 8).toUpperCase(),
    invoiceLines: lines,
    taxTotals: [],
    totalDiscountAmount: 0,
    totalSalesAmount: order.total,
    netAmount: order.total,
    totalAmount: order.total,
    extraDiscountAmount: 0,
    totalItemsDiscountAmount: 0,
  }
}

/** Test connectivity to ETA */
export async function testETAConnection(config: EInvoiceConfig): Promise<{ ok: boolean; message: string }> {
  try {
    await getETAToken(config)
    return { ok: true, message: 'تم الاتصال بمنصة الفاتورة الإلكترونية بنجاح' }
  } catch (err) {
    return { ok: false, message: (err as Error).message }
  }
}
