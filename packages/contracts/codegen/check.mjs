#!/usr/bin/env node
/**
 * check.mjs - the contracts CI gate (Blueprint ADR-E1, Auflage 1).
 *
 * Fails (exit 1) when:
 *   1. openapi.json is stale - "npm run openapi" in services/api produces a
 *      different document than the checked-in one (skipped when the API
 *      workspace has no node_modules, unless --require-spec-regen).
 *   2. Schema sanity is violated - an operation is missing a 2xx JSON
 *      response schema, a mutation is missing a requestBody, a $ref does not
 *      resolve, a parameter has no schema, or a non-public route is missing
 *      bearerAuth security.
 *   3. Any generated file (TS client, Swift, Kotlin) differs from what the
 *      generators produce from the current spec ("regenerate everything and
 *      diff against the checked-in state").
 *
 * Usage: node packages/contracts/codegen/check.mjs [--skip-spec-regen] [--require-spec-regen]
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { REPO_ROOT, SPEC_PATH, loadSpec } from "./lib/spec.mjs";
import { generateFiles as generateTs } from "./gen-ts.mjs";
import { generateFiles as generateSwift } from "./gen-swift.mjs";
import { generateFiles as generateKotlin } from "./gen-kotlin.mjs";

const args = new Set(process.argv.slice(2));
const API_DIR = join(REPO_ROOT, "services", "api");

/** Mutations that intentionally take no request body (action endpoints). */
const BODYLESS_MUTATIONS = new Set([
  "POST /invoices/{invoiceId}/send-reminder",
  "PATCH /lockers/{lockerId}/release",
  // Registrierung (0034). Alle drei sind reine Aktionen: WAS passiert, steht
  // vollstaendig im Pfad (welcher Verein, welches Mitglied). Ein Rumpf haette
  // hier nichts zu transportieren — er waere ein Feld, das der Server ignoriert,
  // und damit eine Einladung, ihm spaeter doch Bedeutung zu geben.
  "POST /clubs/{clubId}/members/{memberId}/approve",
  "POST /clubs/{clubId}/members/{memberId}/reject",
  "POST /clubs/{clubId}/join-code/revoke",
]);
/** Routes that are public by design (no bearerAuth). */
const PUBLIC_ROUTES = new Set([
  "GET /health",
  // Login-free Kür token view: opaque token in, minimal non-personal data out.
  // Handler resolves the token in service mode (routes/public-routines.ts).
  "GET /public/routines/{token}",
]);

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`  FAIL  ${msg}`);
};
const ok = (msg) => console.log(`  ok    ${msg}`);
const section = (msg) => console.log(`\n[contracts-check] ${msg}`);

// ---------------------------------------------------------------------------
// 1. Spec freshness: regenerate openapi.json from the API and compare.
// ---------------------------------------------------------------------------
section("1/3 spec freshness (services/api -> openapi.json)");
if (args.has("--skip-spec-regen")) {
  console.log("  skip  --skip-spec-regen given");
} else if (!existsSync(join(API_DIR, "node_modules"))) {
  if (args.has("--require-spec-regen")) {
    fail("services/api/node_modules missing - run npm ci there first (CI must not skip this)");
  } else {
    console.log("  skip  services/api has no node_modules (run npm ci there to enable)");
  }
} else {
  const before = readFileSync(SPEC_PATH, "utf8");
  execFileSync("npm", ["run", "openapi"], { cwd: API_DIR, stdio: "pipe" });
  const after = readFileSync(SPEC_PATH, "utf8");
  if (before === after) {
    ok("openapi.json matches what the API emits");
  } else {
    fail("openapi.json was stale - it has been regenerated, commit the new version");
  }
}

// ---------------------------------------------------------------------------
// 2. Schema sanity.
// ---------------------------------------------------------------------------
section("2/3 schema sanity");
const spec = loadSpec();
const schemaNames = new Set(Object.keys(spec.components?.schemas ?? {}));

// Collect every $ref in the document and verify it resolves.
const badRefs = [];
(function walk(node) {
  if (Array.isArray(node)) return node.forEach(walk);
  if (node && typeof node === "object") {
    if (typeof node.$ref === "string") {
      const m = /^#\/components\/schemas\/(.+)$/.exec(node.$ref);
      if (!m || !schemaNames.has(m[1])) badRefs.push(node.$ref);
    }
    Object.values(node).forEach(walk);
  }
})(spec);
if (badRefs.length === 0) ok("all $refs resolve to components.schemas");
else fail(`unresolvable $refs: ${[...new Set(badRefs)].join(", ")}`);

if (spec.components?.securitySchemes?.bearerAuth) ok("bearerAuth security scheme present");
else fail("components.securitySchemes.bearerAuth is missing");

let opCount = 0;
for (const [path, methods] of Object.entries(spec.paths ?? {})) {
  for (const [method, op] of Object.entries(methods)) {
    if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
    opCount += 1;
    const label = `${method.toUpperCase()} ${path}`;

    const success = Object.entries(op.responses ?? {}).filter(([c]) => /^2\d\d$/.test(c));
    if (success.length === 0) {
      fail(`${label}: no 2xx response declared`);
    } else if (!success.some(([, r]) => r?.content?.["application/json"]?.schema)) {
      fail(`${label}: 2xx response has no application/json schema`);
    }

    for (const [code, resp] of Object.entries(op.responses ?? {})) {
      if (resp?.content && !resp.content["application/json"]?.schema) {
        fail(`${label}: response ${code} declares content without a JSON schema`);
      }
    }

    if (["post", "put", "patch"].includes(method)) {
      const hasBody = !!op.requestBody?.content?.["application/json"]?.schema;
      if (!hasBody && !BODYLESS_MUTATIONS.has(label)) {
        fail(`${label}: mutation without requestBody schema (add it or allowlist in check.mjs)`);
      }
      if (hasBody && BODYLESS_MUTATIONS.has(label)) {
        fail(`${label}: gained a requestBody - remove it from BODYLESS_MUTATIONS`);
      }
    }

    for (const p of op.parameters ?? []) {
      if (!p.schema) fail(`${label}: parameter "${p.name}" has no schema`);
    }

    const secured = Array.isArray(op.security) && op.security.length > 0;
    if (!secured && !PUBLIC_ROUTES.has(label)) {
      fail(`${label}: route is not secured with bearerAuth and not allowlisted as public`);
    }
    if (secured && PUBLIC_ROUTES.has(label)) {
      fail(`${label}: is allowlisted public but declares security - update PUBLIC_ROUTES`);
    }
  }
}
ok(`${opCount} operations checked (2xx schema, requestBody, params, security)`);

// ---------------------------------------------------------------------------
// 3. Generated files must match the generators' output (drift gate).
// ---------------------------------------------------------------------------
section("3/3 generated files vs. generator output");
const expected = new Map([
  ...generateTs(spec),
  ...generateSwift(spec),
  ...generateKotlin(spec),
]);
const stale = [];
for (const [path, content] of expected) {
  const rel = relative(REPO_ROOT, path);
  if (!existsSync(path)) {
    stale.push(rel + " (missing)");
  } else if (readFileSync(path, "utf8") !== content) {
    stale.push(rel + " (differs)");
  }
}
if (stale.length === 0) {
  ok(`${expected.size} generated files are in sync`);
} else {
  for (const s of stale) fail(`out of date: ${s}`);
  console.error('        -> run "npm run generate" in packages/contracts and commit the result');
}

// ---------------------------------------------------------------------------
console.log("");
if (failures > 0) {
  console.error(`[contracts-check] FAILED with ${failures} finding(s)`);
  process.exit(1);
}
console.log("[contracts-check] all green");
