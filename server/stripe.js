// Stripe (Checkout + Webhook) ohne SDK: nur fetch und crypto. Keine Schlüssel im Code – alles kommt aus Umgebungsvariablen:
//   STRIPE_SECRET_KEY      (sk_live_… oder sk_test_…)
//   STRIPE_WEBHOOK_SECRET  (whsec_… vom Webhook-Eintrag im Stripe-Dashboard)
//   PUBLIC_URL             (Standard https://cloudyclient.com, dorthin geht der Kunde nach der Zahlung zurück)
const crypto = require('crypto');
const PRICE_CENTS = 599, CURRENCY = 'eur', PRODUCT = 'Cloudy+';

const form = (o, pre = '', out = []) => { for (const [k, v] of Object.entries(o)) { const key = pre ? `${pre}[${k}]` : k; if (v && typeof v === 'object') form(v, key, out); else if (v !== undefined && v !== null) out.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v))); } return out; };

async function api(secret, path, body) {
  const r = await fetch('https://api.stripe.com/v1' + path, { method: 'POST', headers: { Authorization: 'Bearer ' + secret, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form(body).join('&'), signal: AbortSignal.timeout(15000) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error((j.error && j.error.message) || 'Stripe Fehler ' + r.status); return j;
}
const checkout = (secret, nameKey, base, existingCustomer) => api(secret, '/checkout/sessions', {
  mode: 'subscription', client_reference_id: nameKey, metadata: { name_key: nameKey },
  ...(existingCustomer ? { customer: existingCustomer } : {}),
  subscription_data: { metadata: { name_key: nameKey } },
  line_items: { 0: { quantity: 1, price_data: { currency: CURRENCY, unit_amount: PRICE_CENTS, recurring: { interval: 'month' }, product_data: { name: PRODUCT } } } },
  success_url: base + '/?plus=ok', cancel_url: base + '/?plus=cancel', allow_promotion_codes: 'true'
});
const portal = (secret, customer, base) => api(secret, '/billing_portal/sessions', { customer, return_url: base });

// Signatur prüfen: Header "t=…,v1=…", HMAC-SHA256 über "t.rohkörper", Toleranz 5 Minuten
function verify(raw, header, secret, now = Date.now(), tol = 300) {
  if (!Buffer.isBuffer(raw) || !header || !secret) return false;
  const p = {}; for (const kv of String(header).split(',')) { const i = kv.indexOf('='); if (i > 0) (p[kv.slice(0, i).trim()] = p[kv.slice(0, i).trim()] || []).push(kv.slice(i + 1).trim()); }
  const t = +(p.t && p.t[0]); if (!t || Math.abs(now / 1000 - t) > tol) return false;
  const want = crypto.createHmac('sha256', secret).update(t + '.').update(raw).digest();
  return (p.v1 || []).some(sig => { try { const b = Buffer.from(sig, 'hex'); return b.length === want.length && crypto.timingSafeEqual(b, want); } catch { return false; } });
}
module.exports = { checkout, portal, verify, PRICE_CENTS, CURRENCY };
