// ============================================================================
// index.ts - server entry. Dev port 3022 (3021 is the web portal).
// ============================================================================

import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { getConfig } from './config.js';
import { closePool } from './db.js';

const config = getConfig();
const app = createApp();

const server = serve({ fetch: app.fetch, port: config.port, hostname: '127.0.0.1' }, (info) => {
  console.info(`[api] rsm2-api listening on http://127.0.0.1:${info.port} (auth mode: ${config.auth.mode})`);
});

async function shutdown(signal: string): Promise<void> {
  console.info(`[api] ${signal} - shutting down`);
  server.close();
  await closePool();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
