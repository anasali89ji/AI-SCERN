/**
 * XPay Payment Gateway Integration
 * Works in Pakistan + internationally (Visa, Mastercard, JazzCash, EasyPaisa)
 * Docs: https://xpay.com.pk/docs
 */

import crypto from 'crypto'

export interface XPayOrder {
  amount:        number      // in PKR (paisa not required — full rupees)
  orderId:       string
  description:   string
  customerName:  string
  customerEmail: string
  customerPhone?: string
  successUrl:    string
  failureUrl:    string
  webhookUrl:    string
  currency?:     string     // PKR (default) or USD
  metadata?:     Record<string, string>
}

export interface XPayCheckoutResponse {
  success:    boolean
  paymentUrl: string
  orderId:    string
  token?:     string
  error?:     string
}

export interface XPayWebhookPayload {
  order_id:       string
  transaction_id: string
  status:         'SUCCESS' | 'FAILED' | 'PENDING' | 'REFUNDED'
  amount:         string
  currency:       string
  customer_email: string
  signature:      string
  timestamp:      string
  metadata?:      Record<string, string>
}

const XPAY_API_URL  = process.env.XPAY_API_URL   || 'https://api.xpay.com.pk/v2'
const XPAY_API_KEY  = process.env.XPAY_API_KEY   || ''
const XPAY_SECRET   = process.env.XPAY_SECRET_KEY || ''
const XPAY_MERCHANT = process.env.XPAY_MERCHANT_ID || ''

/**
 * Create a hosted checkout session with XPay.
 * Returns a redirect URL to the XPay payment page.
 */
export async function createXPayCheckout(order: XPayOrder): Promise<XPayCheckoutResponse> {
  if (!XPAY_API_KEY || !XPAY_SECRET || !XPAY_MERCHANT) {
    // Dev mode: return a simulated checkout URL
    console.warn('[XPay] Missing credentials — returning mock checkout URL for development')
    return {
      success:    true,
      paymentUrl: `/api/billing/mock-checkout?orderId=${order.orderId}&amount=${order.amount}`,
      orderId:    order.orderId,
    }
  }

  const timestamp = Math.floor(Date.now() / 1000).toString()
  const payload = {
    merchant_id:    XPAY_MERCHANT,
    order_id:       order.orderId,
    amount:         order.amount.toString(),
    currency:       order.currency || 'PKR',
    description:    order.description,
    customer_name:  order.customerName,
    customer_email: order.customerEmail,
    customer_phone: order.customerPhone || '',
    success_url:    order.successUrl,
    failure_url:    order.failureUrl,
    webhook_url:    order.webhookUrl,
    timestamp,
    metadata:       JSON.stringify(order.metadata || {}),
  }

  // HMAC-SHA256 signature: sort keys alphabetically, join values, sign
  const sigString = Object.keys(payload)
    .sort()
    .map(k => (payload as Record<string, string>)[k])
    .join('|')
  const signature = crypto.createHmac('sha256', XPAY_SECRET).update(sigString).digest('hex')

  try {
    const res = await fetch(`${XPAY_API_URL}/checkout/create`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'X-Api-Key':     XPAY_API_KEY,
        'X-Signature':   signature,
        'X-Merchant-Id': XPAY_MERCHANT,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return { success: false, paymentUrl: '', orderId: order.orderId, error: `XPay error ${res.status}: ${errText.slice(0, 200)}` }
    }

    const data = await res.json()
    return {
      success:    true,
      paymentUrl: data.payment_url || data.checkout_url,
      orderId:    order.orderId,
      token:      data.token,
    }
  } catch (err: any) {
    return { success: false, paymentUrl: '', orderId: order.orderId, error: err?.message || 'Checkout creation failed' }
  }
}

/**
 * Verify webhook signature from XPay.
 */
export function verifyXPayWebhook(payload: XPayWebhookPayload, rawBody: string): boolean {
  try {
    const { signature, ...rest } = payload
    const sigString = Object.keys(rest)
      .sort()
      .map(k => String((rest as Record<string, string>)[k] || ''))
      .join('|')
    const expected = crypto.createHmac('sha256', XPAY_SECRET).update(sigString).digest('hex')
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
  } catch { return false }
}

/**
 * PKR pricing for each plan (1 USD ≈ 278 PKR as of 2026)
 */
export const XPAY_PLANS = {
  starter_monthly: { priceUSD: 9.99,  pricePKR: 2799,  name: 'Starter Monthly', credits: 100, period: 'monthly' },
  starter_yearly:  { priceUSD: 99,    pricePKR: 27500, name: 'Starter Yearly',  credits: 100, period: 'yearly'  },
  pro_monthly:     { priceUSD: 29.99, pricePKR: 8399,  name: 'Pro Monthly',     credits: 500, period: 'monthly' },
  pro_yearly:      { priceUSD: 299,   pricePKR: 83000, name: 'Pro Yearly',      credits: 500, period: 'yearly'  },
  enterprise_monthly: { priceUSD: 99.99, pricePKR: 27999, name: 'Enterprise Monthly', credits: -1, period: 'monthly' },
  enterprise_yearly:  { priceUSD: 999,   pricePKR: 279000, name: 'Enterprise Yearly',  credits: -1, period: 'yearly'  },
} as const

export type XPayPlanId = keyof typeof XPAY_PLANS
