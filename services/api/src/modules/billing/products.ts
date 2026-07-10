// ============================================================================
// modules/billing/products.ts - the product catalog, READ-only.
//
// Blueprint ADR-E7: app.products is the single source of truth for pricing -
// website, apps, StoreKit and Stripe configuration render from THIS catalog
// (v1 had three contradicting price sources). Writes happen via admin
// tooling/seed only; the client API never mutates products.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../../lib/openapi.js';
import { productSchema } from '../../lib/validation.js';
import { withUser } from '../../db.js';

export const productsRouter = createRouter();

productsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/products',
    tags: ['products'],
    summary: 'Product catalog (single source of truth for pricing, read-only)',
    security: [{ bearerAuth: [] }],
    responses: {
      200: jsonContent(z.array(productSchema), 'Active products (club tiers + personal Pro)'),
      ...errorResponses,
    },
  }),
  async (c) => {
    // impersonated: the products_select RLS policy exposes active rows only
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.products where active order by kind, price_cents`,
    );
    return c.json(z.array(productSchema).parse(rows), 200);
  },
);
