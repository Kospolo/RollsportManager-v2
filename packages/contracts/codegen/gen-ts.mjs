#!/usr/bin/env node
/**
 * gen-ts.mjs - generates the typed TypeScript API client for the web app.
 *
 * Output: apps/web/lib/api/generated/{types.ts, client.ts, index.ts}
 * The web app currently runs on mocks - this client is only PROVIDED here,
 * nothing in the existing web code is rewired.
 *
 * Template-based, zero dependencies (Blueprint ADR-E1: codegen gate).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  REPO_ROOT,
  fileHeader,
  loadSpec,
  namedSchemas,
  operations,
  camelCase,
} from "./lib/spec.mjs";

export const TS_OUT_DIR = join(REPO_ROOT, "apps", "web", "lib", "api", "generated");

// --------------------------------------------------------------------------
// Type rendering
// --------------------------------------------------------------------------

function tsType(ir) {
  let t;
  switch (ir.kind) {
    case "ref":
      t = ir.name;
      break;
    case "string":
      t = ir.enumValues ? ir.enumValues.map((v) => JSON.stringify(v)).join(" | ") : "string";
      break;
    case "integer":
    case "number":
      t = "number";
      break;
    case "boolean":
      t = "boolean";
      break;
    case "array": {
      const inner = tsType({ ...ir.items, nullable: false });
      const needsParens = ir.items.nullable || (ir.items.kind === "string" && ir.items.enumValues);
      t = (needsParens ? `(${tsType(ir.items)})` : inner) + "[]";
      break;
    }
    case "object":
      t =
        "{ " +
        ir.props
          .map((p) => `${JSON.stringify(p.name)}${p.required ? "" : "?"}: ${tsType(p.ir)}`)
          .join("; ") +
        " }";
      break;
    case "json":
    default:
      t = "Record<string, unknown>";
      break;
  }
  if (ir.nullable) t = `${t} | null`;
  return t;
}

function docComment(text, indent = "") {
  if (!text) return "";
  const lines = String(text).trim().split("\n");
  return `${indent}/**\n${lines.map((l) => `${indent} * ${l}`).join("\n")}\n${indent} */\n`;
}

// --------------------------------------------------------------------------
// types.ts
// --------------------------------------------------------------------------

function renderTypes(spec) {
  const out = [fileHeader(spec, "//"), "", "/* eslint-disable */", ""];
  out.push(
    "// Wire format note: all property names are snake_case on purpose - they",
    "// mirror the DB/API wire format 1:1 (Blueprint ADR-E7). Do not camelCase.",
    ""
  );
  for (const { name, ir, description } of namedSchemas(spec)) {
    if (ir.kind === "string" && ir.enumValues) {
      out.push(docComment(description));
      out.push(`export type ${name} = ${ir.enumValues.map((v) => JSON.stringify(v)).join(" | ")};`);
      out.push(
        `export const ${name}Values: readonly ${name}[] = [${ir.enumValues
          .map((v) => JSON.stringify(v))
          .join(", ")}] as const;`,
        ""
      );
      continue;
    }
    if (ir.kind === "object") {
      out.push(docComment(description));
      out.push(`export interface ${name} {`);
      for (const p of ir.props) {
        out.push(`  ${JSON.stringify(p.name)}${p.required ? "" : "?"}: ${tsType(p.ir)};`);
      }
      out.push("}", "");
      continue;
    }
    // Fallback for any other named shape.
    out.push(`export type ${name} = ${tsType(ir)};`, "");
  }
  return out.filter((l) => l !== undefined).join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

// --------------------------------------------------------------------------
// client.ts
// --------------------------------------------------------------------------

function methodSignature(op) {
  const args = [];
  for (const p of op.pathParams) args.push(`${camelCase(p.name)}: ${tsType(p.ir)}`);
  if (op.queryParams.length > 0) {
    const fields = op.queryParams
      .map((q) => `${JSON.stringify(q.name)}${q.required ? "" : "?"}: ${tsType(q.ir)}`)
      .join("; ");
    const allOptional = op.queryParams.every((q) => !q.required);
    args.push(`query${allOptional ? "?" : ""}: { ${fields} }`);
  }
  if (op.body) args.push(`body${op.body.required ? "" : "?"}: ${qualify(tsType(op.body.ir))}`);
  args.push("options?: RequestOptions");
  return args.join(", ");
}

/** Prefix named schema references with the M. namespace import. */
function qualify(t) {
  return t.replace(/\b([A-Z][A-Za-z0-9]*)\b/g, (m) => {
    if (["Record", "Promise", "Array"].includes(m)) return m;
    return `M.${m}`;
  });
}

function returnType(op) {
  if (!op.success || !op.success.ir) return "void";
  return qualify(tsType(op.success.ir));
}

function pathExpression(op) {
  if (op.pathParams.length === 0) return JSON.stringify(op.path);
  let expr = op.path;
  for (const p of op.pathParams) {
    expr = expr.replace(`{${p.name}}`, `\${encodeURIComponent(${camelCase(p.name)})}`);
  }
  return "`" + expr + "`";
}

function renderClient(spec) {
  const ops = operations(spec);
  const out = [fileHeader(spec, "//"), "", "/* eslint-disable */", ""];
  out.push(`import type * as M from "./types";`, "");
  out.push(`export interface RequestOptions {
  signal?: AbortSignal;
  /** Extra headers for this single request (e.g. x-request-id). */
  headers?: Record<string, string>;
}

export interface ApiClientOptions {
  /** Base URL of the API, e.g. "http://localhost:3022" - no trailing slash needed. */
  baseUrl: string;
  /** Returns the current GoTrue access token (or null for anonymous calls). */
  getAccessToken?: () => string | null | Promise<string | null>;
  /** Custom fetch implementation (tests, Node polyfills). Defaults to globalThis.fetch. */
  fetch?: typeof fetch;
  /** Headers applied to every request. */
  defaultHeaders?: Record<string, string>;
}

/** RFC 7807 error thrown for every non-2xx response. */
export class ApiError extends Error {
  readonly status: number;
  readonly problem: M.Problem | null;

  constructor(status: number, problem: M.Problem | null, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

export class ApiClient {
  private readonly opts: ApiClientOptions;

  constructor(opts: ApiClientOptions) {
    this.opts = opts;
  }

  private async request<T>(
    method: string,
    path: string,
    init: { query?: Query; body?: unknown; auth: boolean; options?: RequestOptions }
  ): Promise<T> {
    const base = this.opts.baseUrl.replace(/\\/+$/, "");
    const url = new URL(base + path);
    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = {
      accept: "application/json",
      ...this.opts.defaultHeaders,
      ...init.options?.headers,
    };
    if (init.body !== undefined) headers["content-type"] = "application/json";
    if (init.auth && this.opts.getAccessToken) {
      const token = await this.opts.getAccessToken();
      if (token) headers["authorization"] = \`Bearer \${token}\`;
    }

    const doFetch = this.opts.fetch ?? globalThis.fetch;
    const res = await doFetch(url.toString(), {
      method: method.toUpperCase(),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init.options?.signal,
    });

    if (!res.ok) {
      let problem: M.Problem | null = null;
      try {
        problem = (await res.json()) as M.Problem;
      } catch {
        // non-JSON error body - keep problem null
      }
      const detail = problem?.detail ?? problem?.title ?? res.statusText;
      throw new ApiError(res.status, problem, \`\${method.toUpperCase()} \${path} -> \${res.status}: \${detail}\`);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }`);

  for (const op of ops) {
    const summaryLines = [op.summary, op.description].filter(Boolean).join("\n");
    if (summaryLines) out.push(docComment(`${summaryLines}\n\n\`${op.method.toUpperCase()} ${op.path}\``, "  ").trimEnd());
    const ret = returnType(op);
    out.push(`  async ${op.name}(${methodSignature(op)}): Promise<${ret}> {`);
    const parts = [];
    if (op.queryParams.length > 0) parts.push("query");
    if (op.body) parts.push("body");
    parts.push(`auth: ${op.secured}`);
    parts.push("options");
    out.push(
      `    return this.request<${ret}>(${JSON.stringify(op.method.toUpperCase())}, ${pathExpression(op)}, { ${parts.join(", ")} });`
    );
    out.push("  }", "");
  }
  out.push("}", "");
  return out.join("\n").replace(/\n{3,}/g, "\n\n") + "";
}

function renderIndex(spec) {
  return (
    fileHeader(spec, "//") +
    `
export * from "./types";
export * from "./client";
`
  );
}

// --------------------------------------------------------------------------
// Entry
// --------------------------------------------------------------------------

/** Returns Map<absolutePath, content> - used by check.mjs for drift detection. */
export function generateFiles(spec = loadSpec()) {
  return new Map([
    [join(TS_OUT_DIR, "types.ts"), renderTypes(spec)],
    [join(TS_OUT_DIR, "client.ts"), renderClient(spec)],
    [join(TS_OUT_DIR, "index.ts"), renderIndex(spec)],
  ]);
}

export function writeFiles(files) {
  for (const [path, content] of files) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    console.log(`[gen-ts] wrote ${path}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFiles(generateFiles());
}
