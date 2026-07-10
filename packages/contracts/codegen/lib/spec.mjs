/**
 * spec.mjs - shared OpenAPI loading + normalisation for the codegen pipeline.
 *
 * The generators (gen-ts / gen-swift / gen-kotlin) never read the raw OpenAPI
 * document directly. This module turns packages/contracts/openapi.json into a
 * small intermediate representation (IR) so every target language translates
 * the exact same shape. Blueprint ADR-E1: the OpenAPI spec of the API layer is
 * the single source of truth - types are generated, never hand-written.
 *
 * Zero runtime dependencies on purpose (plain Node >= 20).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
export const CONTRACTS_DIR = join(REPO_ROOT, "packages", "contracts");
export const SPEC_PATH = join(CONTRACTS_DIR, "openapi.json");

/** The mandatory first line of every generated file (user requirement). */
export const GENERATED_MARKER = "GENERIERT — NICHT VON HAND AENDERN";

/** Load and parse the checked-in OpenAPI document. */
export function loadSpec(path = SPEC_PATH) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Header block for generated files. `comment` is the line-comment prefix. */
export function fileHeader(spec, comment = "//") {
  const lines = [
    `${GENERATED_MARKER}`,
    ``,
    `Generated from packages/contracts/openapi.json (${spec.info.title} v${spec.info.version}).`,
    `Regenerate with: npm run generate   (in packages/contracts)`,
    `Source of truth is the API layer; the spec itself is produced by`,
    `"npm run openapi" in services/api - never edit either by hand.`,
  ];
  return lines.map((l) => (l ? `${comment} ${l}` : comment)).join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Type IR
// ---------------------------------------------------------------------------
// IR nodes ({ kind, nullable, ... }):
//   ref     { name }                      - reference to a named schema
//   string  { format?, enumValues? }      - enumValues => inline string enum
//   integer / number / boolean
//   array   { items: IR }
//   object  { props: [{ name, ir, required, defaultValue }] }
//   json                                  - free-form JSON (additionalProperties / unknown)
// ---------------------------------------------------------------------------

function refName(ref) {
  const m = /^#\/components\/schemas\/([A-Za-z0-9_]+)$/.exec(ref);
  if (!m) throw new Error(`Unsupported $ref target: ${ref}`);
  return m[1];
}

/** Normalise an OpenAPI schema node into the IR described above. */
export function normalize(schema) {
  if (schema == null) return { kind: "json", nullable: false };

  if (schema.$ref) return { kind: "ref", name: refName(schema.$ref), nullable: false };

  // anyOf: the spec only ever emits unions of identical primitives, optionally
  // plus a bare { nullable: true } marker (zod .union([...]).nullable()).
  if (Array.isArray(schema.anyOf)) {
    let nullable = schema.nullable === true;
    const variants = [];
    for (const v of schema.anyOf) {
      if (v && v.nullable === true && v.type === undefined && !v.$ref) {
        nullable = true;
        continue;
      }
      variants.push(normalize(v));
    }
    if (variants.length === 0) return { kind: "json", nullable: true };
    const first = variants[0];
    const uniform = variants.every((v) => v.kind === first.kind && v.name === first.name);
    if (uniform) return { ...first, nullable: nullable || first.nullable };
    return { kind: "json", nullable };
  }

  // allOf: only "$ref decorated with a default" occurs (zod .default() on an enum).
  if (Array.isArray(schema.allOf)) {
    const refPart = schema.allOf.find((p) => p && p.$ref);
    const rest = schema.allOf.filter((p) => p !== refPart);
    if (refPart && rest.every((p) => p && p.type === undefined && !p.properties)) {
      const defaultValue = rest.find((p) => "default" in p)?.default;
      return {
        kind: "ref",
        name: refName(refPart.$ref),
        nullable: schema.nullable === true,
        defaultValue,
      };
    }
    throw new Error(`Unsupported allOf shape: ${JSON.stringify(schema)}`);
  }

  const nullable = schema.nullable === true;
  switch (schema.type) {
    case "string":
      return {
        kind: "string",
        nullable,
        format: schema.format,
        enumValues: Array.isArray(schema.enum) ? [...schema.enum] : undefined,
      };
    case "integer":
      return { kind: "integer", nullable };
    case "number":
      return { kind: "number", nullable };
    case "boolean":
      return { kind: "boolean", nullable };
    case "array":
      return {
        kind: "array",
        nullable,
        items: normalize(schema.items),
        defaultValue: schema.default,
      };
    case "object": {
      const propNames = Object.keys(schema.properties ?? {});
      if (propNames.length === 0) return { kind: "json", nullable };
      const required = new Set(schema.required ?? []);
      const props = propNames.map((name) => {
        const raw = schema.properties[name];
        const ir = normalize(raw);
        return {
          name,
          ir,
          required: required.has(name),
          defaultValue: ir.defaultValue !== undefined ? ir.defaultValue : raw.default,
        };
      });
      return { kind: "object", nullable, props };
    }
    default:
      return { kind: "json", nullable };
  }
}

/**
 * Named schemas from components.schemas, normalised.
 * Returns [{ name, ir, description }] in spec order (stable output).
 */
export function namedSchemas(spec) {
  const out = [];
  for (const [name, schema] of Object.entries(spec.components?.schemas ?? {})) {
    out.push({ name, ir: normalize(schema), description: schema.description });
  }
  return out;
}

/**
 * Inline types (defined directly on an object property instead of as a named
 * schema) hoisted to synthetic named types for Swift/Kotlin:
 *   - string enums:   Entitlement.subject_type -> EntitlementSubjectType
 *   - nested objects: DunningRunResult.summary -> DunningRunResultSummary
 * Works recursively (nested objects may hoist their own children) and looks
 * through arrays (Parent.prop keys an array's item type).
 * Returns { enums: Map<"Owner.prop", {name, values}>,
 *           objects: Map<"Owner.prop", {name, ir}> } where Owner may itself
 * be a synthetic hoisted name.
 */
export function hoistedTypes(spec) {
  const enums = new Map();
  const objects = new Map();

  function visitObject(ownerName, ir) {
    for (const prop of ir.props) {
      const key = `${ownerName}.${prop.name}`;
      const childName = `${ownerName}${pascalCase(prop.name)}`;
      const target = prop.ir.kind === "array" ? prop.ir.items : prop.ir;
      if (target.kind === "string" && target.enumValues) {
        enums.set(key, { name: childName, values: target.enumValues });
      } else if (target.kind === "object") {
        objects.set(key, { name: childName, ir: target });
        visitObject(childName, target);
      }
    }
  }

  for (const { name, ir } of namedSchemas(spec)) {
    if (ir.kind === "object") visitObject(name, ir);
  }
  return { enums, objects };
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/**
 * Flatten spec.paths into a stable operation list:
 * [{ method, path, name, summary, description, tags, secured,
 *    pathParams: [{ name, ir }], queryParams: [{ name, required, ir }],
 *    body: { schemaRef, required } | null,
 *    success: { code, ir } | null }]
 */
export function operations(spec) {
  const ops = [];
  for (const [path, methods] of Object.entries(spec.paths ?? {})) {
    for (const [method, op] of Object.entries(methods)) {
      if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
      const params = op.parameters ?? [];
      const pathParams = params
        .filter((p) => p.in === "path")
        .map((p) => ({ name: p.name, ir: normalize(p.schema) }));
      const queryParams = params
        .filter((p) => p.in === "query")
        .map((p) => ({ name: p.name, required: p.required === true, ir: normalize(p.schema) }));

      let body = null;
      const bodySchema = op.requestBody?.content?.["application/json"]?.schema;
      if (bodySchema) {
        body = {
          required: op.requestBody.required !== false,
          ir: normalize(bodySchema),
        };
      }

      let success = null;
      const codes = Object.keys(op.responses ?? {})
        .filter((c) => /^2\d\d$/.test(c))
        .sort();
      if (codes.length > 0) {
        const code = codes[0];
        const schema = op.responses[code]?.content?.["application/json"]?.schema;
        success = { code: Number(code), ir: schema ? normalize(schema) : null };
      }

      ops.push({
        method,
        path,
        name: operationName(method, path),
        summary: op.summary,
        description: op.description,
        tags: op.tags ?? [],
        secured: Array.isArray(op.security) && op.security.length > 0,
        pathParams,
        queryParams,
        body,
        success,
      });
    }
  }
  return ops;
}

/**
 * Deterministic operation name derived from method + path (the spec carries
 * no operationIds): GET /clubs/{clubId}/members -> getClubsByClubIdMembers.
 */
export function operationName(method, path) {
  const parts = path.split("/").filter(Boolean).map((seg) => {
    const m = /^\{(.+)\}$/.exec(seg);
    if (m) return "By" + pascalCase(m[1]);
    return pascalCase(seg);
  });
  return method.toLowerCase() + parts.join("");
}

// ---------------------------------------------------------------------------
// Casing helpers
// ---------------------------------------------------------------------------

export function pascalCase(s) {
  return s
    .replace(/[-_\s]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toUpperCase());
}

export function camelCase(s) {
  const p = pascalCase(s);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

/** SCREAMING_SNAKE_CASE for Kotlin enum constants. */
export function screamingSnakeCase(s) {
  return s.replace(/[-\s]+/g, "_").toUpperCase();
}
