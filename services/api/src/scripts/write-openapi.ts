// ============================================================================
// write-openapi.ts - `npm run openapi`
// Writes the OpenAPI spec to packages/contracts/openapi.json - the single
// codegen source for Swift/Kotlin/TS clients (Blueprint ADR-E1, CI gate).
// ============================================================================

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp, openApiConfig } from '../app.js';

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, '../../../../packages/contracts/openapi.json');

const app = createApp();
const doc = app.getOpenAPIDocument({ ...openApiConfig });

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');

const pathCount = Object.keys(doc.paths ?? {}).length;
console.info(`[openapi] wrote ${target} (${pathCount} paths)`);
