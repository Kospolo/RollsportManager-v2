import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, jsonContent } from '../lib/openapi.js';

const healthSchema = z
  .object({
    status: z.literal('ok'),
    service: z.string(),
    time: z.string(),
  })
  .openapi('Health');

export const healthRouter = createRouter();

healthRouter.openapi(
  createRoute({
    method: 'get',
    path: '/health',
    tags: ['system'],
    summary: 'Liveness probe (no auth, no DB)',
    responses: { 200: jsonContent(healthSchema, 'Service is up') },
  }),
  (c) => c.json({ status: 'ok' as const, service: 'rsm2-api', time: new Date().toISOString() }, 200),
);
