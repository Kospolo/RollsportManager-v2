#!/usr/bin/env node
/**
 * gen-kotlin.mjs - generates kotlinx.serialization data classes for Android.
 *
 * Output: packages/contracts/generated/kotlin/RsmContracts.kt
 *
 * Wire format stays snake_case (Blueprint ADR-E7); Kotlin properties are
 * camelCase via @SerialName. Requires org.jetbrains.kotlinx:kotlinx-serialization-json
 * in the consuming app - the generated file itself has no other dependencies.
 * Template-based, zero dependencies in the generator (Blueprint ADR-E1).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  CONTRACTS_DIR,
  fileHeader,
  loadSpec,
  namedSchemas,
  hoistedTypes,
  camelCase,
  screamingSnakeCase,
} from "./lib/spec.mjs";

export const KOTLIN_OUT_DIR = join(CONTRACTS_DIR, "generated", "kotlin");
const PACKAGE = "de.rollsportmanager.contracts";

const KOTLIN_KEYWORDS = new Set([
  "as", "break", "class", "continue", "do", "else", "false", "for", "fun",
  "if", "in", "interface", "is", "null", "object", "package", "return",
  "super", "this", "throw", "true", "try", "typealias", "typeof", "val",
  "var", "when", "while",
]);

function ktIdent(name) {
  const id = camelCase(name);
  return KOTLIN_KEYWORDS.has(id) ? "`" + id + "`" : id;
}

/** Map an IR node to a Kotlin type (without nullability suffix). */
function ktType(ir, ctx) {
  switch (ir.kind) {
    case "ref":
      return ir.name;
    case "string": {
      if (ir.enumValues && ctx) {
        const hoisted = ctx.hoisted.enums.get(`${ctx.parent}.${ctx.prop}`);
        if (hoisted) return hoisted.name;
      }
      return "String";
    }
    case "integer":
      // Long on purpose: cents / milliseconds must never overflow Int.
      return "Long";
    case "number":
      return "Double";
    case "boolean":
      return "Boolean";
    case "array":
      return `List<${ktType(ir.items, ctx)}${ir.items.nullable ? "?" : ""}>`;
    case "object": {
      if (ctx) {
        const hoisted = ctx.hoisted.objects.get(`${ctx.parent}.${ctx.prop}`);
        if (hoisted) return hoisted.name;
      }
      return "JsonObject";
    }
    case "json":
    default:
      return "JsonObject";
  }
}

function ktDefault(ir, defaultValue, ctx) {
  if (defaultValue === undefined) return undefined;
  if (ir.kind === "array" && Array.isArray(defaultValue) && defaultValue.length === 0) return "emptyList()";
  if (ir.kind === "boolean") return defaultValue ? "true" : "false";
  if (ir.kind === "integer") return `${defaultValue}L`;
  if (ir.kind === "number") {
    // Kotlin kennt KEINE implizite Weitung: `val vatRate: Double = 0` ist ein
    // Uebersetzungsfehler ("expected Double?, actual Int"), und genau daran ist
    // der Android-Build nach der Contract-Regeneration zu 0072 gescheitert.
    // Ein Double-Default MUSS als Double-Literal herauskommen.
    const n = Number(defaultValue);
    if (!Number.isFinite(n)) return undefined;
    return Number.isInteger(n) ? `${n}.0` : String(n);
  }
  if (ir.kind === "ref") return `${ir.name}.${screamingSnakeCase(String(defaultValue))}`;
  if (ir.kind === "string") {
    if (ir.enumValues && ctx) {
      const hoisted = ctx.hoisted.enums.get(`${ctx.parent}.${ctx.prop}`);
      if (hoisted) return `${hoisted.name}.${screamingSnakeCase(String(defaultValue))}`;
    }
    return JSON.stringify(defaultValue);
  }
  return undefined;
}

function renderEnum(name, values, doc) {
  const out = [];
  if (doc) out.push(`/** ${doc.replace(/\n/g, " ")} */`);
  out.push("@Serializable", `enum class ${name} {`);
  values.forEach((v, i) => {
    out.push(`    @SerialName(${JSON.stringify(v)}) ${screamingSnakeCase(v)}${i < values.length - 1 ? "," : ";"}`);
  });
  out.push("}", "");
  return out;
}

/**
 * Benannte NICHT-Objekt-, NICHT-Enum-Schemas (Skalar-Aliase wie
 *   "Weekday": { "type": "integer", "minimum": 0, "maximum": 6 }
 * oder benannte Arrays). Vorher liess der Generator sie stillschweigend fallen:
 * die VERWEISE entstanden (`val weekday: Weekday`), die DEFINITION nie — die
 * Android-App uebersetzte nicht mehr und lebte von einem Hand-Shim.
 * gen-ts.mjs hatte diesen Zweig laengst; Swift/Kotlin fehlte er.
 */
function renderAlias(name, ir, doc) {
  const out = [];
  if (doc) out.push(`/** ${doc.replace(/\n/g, " ")} */`);
  out.push(`typealias ${name} = ${ktType(ir)}${ir.nullable ? "?" : ""}`, "");
  return out;
}

function renderDataClass(name, ir, hoisted, description) {
  const ctxFor = (prop) => ({ parent: name, prop, hoisted });
  const out = [];
  if (description) out.push(`/** ${description.replace(/\n/g, " ")} */`);
  out.push("@Serializable", `data class ${name}(`);
  ir.props.forEach((p, i) => {
    const nullable = !p.required || p.ir.nullable;
    const base = ktType(p.ir, ctxFor(p.name));
    const id = ktIdent(p.name);
    const plain = id.replace(/`/g, "");
    let line = "    ";
    if (plain !== p.name) line += `@SerialName(${JSON.stringify(p.name)}) `;
    line += `val ${id}: ${base}${nullable ? "?" : ""}`;
    const def = ktDefault(p.ir, p.defaultValue, ctxFor(p.name));
    if (def !== undefined) line += ` = ${def}`;
    else if (!p.required) line += " = null";
    out.push(line + (i < ir.props.length - 1 ? "," : ""));
  });
  out.push(")", "");
  return out;
}

function renderKotlin(spec) {
  const hoisted = hoistedTypes(spec);
  const out = [fileHeader(spec, "//"), "", `package ${PACKAGE}`, ""];
  out.push(
    "import kotlinx.serialization.SerialName",
    "import kotlinx.serialization.Serializable",
    "import kotlinx.serialization.json.JsonObject",
    ""
  );
  out.push(
    "// Timestamps and dates stay String on the wire (ISO 8601 / yyyy-MM-dd),",
    "// UUIDs stay String - convert at the edge, never in the contract types.",
    "// Integers map to Long on purpose (cents, milliseconds).",
    ""
  );

  const schemas = namedSchemas(spec);
  for (const { name, ir, description } of schemas) {
    if (ir.kind === "string" && ir.enumValues) out.push(...renderEnum(name, ir.enumValues, description));
  }
  // Skalar-/sonstige Aliase — JEDES benannte Schema bekommt eine Definition,
  // damit nie wieder ein Verweis ohne Typ im Ausgabefile steht.
  for (const { name, ir, description } of schemas) {
    if (ir.kind === "object") continue;
    if (ir.kind === "string" && ir.enumValues) continue;
    out.push(...renderAlias(name, ir, description));
  }
  for (const [source, e] of hoisted.enums) {
    out.push(...renderEnum(e.name, e.values, `Inline enum of ${source} (hoisted by codegen).`));
  }
  for (const [source, o] of hoisted.objects) {
    out.push(...renderDataClass(o.name, o.ir, hoisted, `Inline object of ${source} (hoisted by codegen).`));
  }
  for (const { name, ir, description } of schemas) {
    if (ir.kind === "object") out.push(...renderDataClass(name, ir, hoisted, description));
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n") + "";
}

/** Returns Map<absolutePath, content> - used by check.mjs for drift detection. */
export function generateFiles(spec = loadSpec()) {
  return new Map([[join(KOTLIN_OUT_DIR, "RsmContracts.kt"), renderKotlin(spec)]]);
}

export function writeFiles(files) {
  for (const [path, content] of files) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    console.log(`[gen-kotlin] wrote ${path}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFiles(generateFiles());
}
