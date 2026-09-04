// ============================================================================
// routes/billing-checkout.ts — Stripe-Checkout AUSLÖSEN (Web-Portal, ADR-E6).
//
// Die Gegen-Seite (Stripe-Webhook → app.entitlements) liegt bereits in
// modules/billing (providers.ts/webhooks.ts, applyEntitlementChange). Hier
// fehlte nur der AUSLÖSER: der „Jetzt abonnieren"-Klick eines Vereins erzeugt
// eine Stripe-Checkout-Session (mode=subscription) und bekommt deren URL zurück.
//
// KEIN Stripe-SDK (bewusst keine neue Abhängigkeit): ein schlichter
// form-encodeter POST an https://api.stripe.com/v1/checkout/sessions mit dem
// Secret-Key als Bearer. Der Key kommt aus der Config (deploy/.env,
// STRIPE_SECRET_KEY) — NIE aus dem Repo. Ohne Key/Produkt antwortet der
// Endpoint sauber (501), der Rest der App läuft weiter.
//
// RECHTE: nur Finanz-berechtigte Rollen (owner/admin/moderator/treasurer). Der
// Preis (Stripe price_…) steht in app.products.metadata.stripe_price_id.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import { requireClubRole, FINANCE_ROLES } from '../lib/guards.js';
import { withUser } from '../db.js';
import { getConfig } from '../config.js';
import { problem } from '../middleware/error.js';
import { uuid } from '../lib/validation.js';

export const billingCheckoutRouter = createRouter();

const clubIdParam = z.object({
  clubId: uuid.openapi({ param: { name: 'clubId', in: 'path' } }),
});

const checkoutBodySchema = z
  .object({
    /** Optionaler Produktcode; Default = das aktive club_license-Produkt. */
    product_code: z.string().min(1).optional(),
  })
  .openapi('BillingCheckoutRequest');

const checkoutResultSchema = z
  .object({
    /** Stripe-Checkout-URL — der Client leitet dorthin weiter. */
    url: z.string().url(),
  })
  .openapi('BillingCheckoutResult');

billingCheckoutRouter.openapi(
  createRoute({
    method: 'post',
    path: '/clubs/{clubId}/billing/checkout',
    tags: ['billing'],
    summary: 'Stripe-Checkout starten / Start a Stripe checkout (finance roles)',
    description:
      'Erzeugt eine Stripe-Checkout-Session (Abo) für die Vereinslizenz und liefert die Weiterleitungs-URL. ' +
      'Nur Finanz-Rollen. 501, wenn Stripe/Produkt nicht konfiguriert ist.',
    security: [{ bearerAuth: [] }],
    request: {
      params: clubIdParam,
      body: { content: { 'application/json': { schema: checkoutBodySchema } }, required: false },
    },
    responses: {
      200: jsonContent(checkoutResultSchema, 'Checkout session URL'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    const body = c.req.valid('json') ?? {};
    const claims = c.get('claims');
    requireClubRole(claims, clubId, FINANCE_ROLES);

    const cfg = getConfig();
    const secret = cfg.billing.stripeSecretKey;
    if (!secret) {
      throw problem(501, 'Not Implemented', 'Stripe ist nicht konfiguriert (STRIPE_SECRET_KEY fehlt).');
    }

    // Produkt + Stripe-Preis lesen (RLS: authenticated darf aktive Produkte lesen).
    const product = await withUser(claims, async (tx) => {
      const rows = await tx<{ code: string; metadata: Record<string, unknown> }[]>`
        select code, metadata
          from app.products
         where kind = 'club_license' and active
           and (${body.product_code ?? null}::text is null or code = ${body.product_code ?? null})
         order by price_cents
         limit 1`;
      return rows[0];
    });

    const priceId =
      product && typeof product.metadata['stripe_price_id'] === 'string'
        ? (product.metadata['stripe_price_id'] as string)
        : undefined;
    if (!product || !priceId) {
      throw problem(
        501,
        'Not Implemented',
        'Kein Vereinslizenz-Produkt mit Stripe-Preis konfiguriert (app.products.metadata.stripe_price_id).',
      );
    }

    const base = cfg.billing.webAppUrl.replace(/\/$/, '');
    const form = new URLSearchParams();
    form.set('mode', 'subscription');
    form.set('line_items[0][price]', priceId);
    form.set('line_items[0][quantity]', '1');
    form.set('client_reference_id', clubId);
    form.set('metadata[club_id]', clubId);
    form.set('metadata[product_code]', product.code);
    // Der Webhook liest NUR die Subscription-Metadaten (customer.subscription.*),
    // NICHT die der Checkout-Session — daher club_id UND product_code/tier dort
    // ablegen, sonst landet jede bezahlte Lizenz faelschlich als tier='basic'.
    const tier = typeof product.metadata['tier'] === 'string' ? (product.metadata['tier'] as string) : 'pro';
    form.set('subscription_data[metadata][club_id]', clubId);
    form.set('subscription_data[metadata][product_code]', product.code);
    form.set('subscription_data[metadata][tier]', tier);
    form.set('success_url', `${base}/einstellungen?checkout=success`);
    form.set('cancel_url', `${base}/einstellungen?checkout=cancel`);

    let session: { url?: string; error?: { message?: string } };
    try {
      const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      });
      session = (await res.json()) as typeof session;
      if (!res.ok) {
        throw problem(502, 'Bad Gateway', `Stripe: ${session.error?.message ?? `HTTP ${res.status}`}`);
      }
    } catch (err) {
      if (err && typeof err === 'object' && 'status' in err) throw err; // schon ein Problem
      throw problem(502, 'Bad Gateway', 'Stripe-Checkout konnte nicht erstellt werden.');
    }

    if (!session.url) {
      throw problem(502, 'Bad Gateway', 'Stripe lieferte keine Checkout-URL.');
    }
    return c.json({ url: session.url }, 200);
  },
);
