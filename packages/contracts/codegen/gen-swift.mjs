#!/usr/bin/env node
/**
 * gen-swift.mjs - generates Codable structs/enums for the iOS app.
 *
 * Output: packages/contracts/generated/swift/RSMContracts.swift
 *
 * Wire format stays snake_case (Blueprint ADR-E7); Swift properties are
 * camelCase via explicit CodingKeys, so no decoder keyStrategy is required.
 * Template-based, zero dependencies (Blueprint ADR-E1: codegen gate).
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
} from "./lib/spec.mjs";

export const SWIFT_OUT_DIR = join(CONTRACTS_DIR, "generated", "swift");

const SWIFT_KEYWORDS = new Set([
  "class", "struct", "enum", "protocol", "extension", "func", "var", "let",
  "in", "for", "while", "return", "default", "case", "switch", "import",
  "public", "private", "internal", "static", "self", "Self", "Type", "true",
  "false", "nil", "operator", "where", "is", "as", "try", "throw", "throws",
]);

function swiftIdent(name) {
  const id = camelCase(name);
  return SWIFT_KEYWORDS.has(id) ? "`" + id + "`" : id;
}

/** Map an IR node to a Swift type (without optionality). ctx resolves hoisted inline types. */
function swiftType(ir, ctx) {
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
      return "Int";
    case "number":
      return "Double";
    case "boolean":
      return "Bool";
    case "array":
      return `[${swiftType(ir.items, ctx)}${ir.items.nullable ? "?" : ""}]`;
    case "object": {
      if (ctx) {
        const hoisted = ctx.hoisted.objects.get(`${ctx.parent}.${ctx.prop}`);
        if (hoisted) return hoisted.name;
      }
      return "[String: JSONValue]";
    }
    case "json":
    default:
      return "[String: JSONValue]";
  }
}

function swiftDefault(ir, defaultValue, ctx) {
  if (defaultValue === undefined) return undefined;
  if (ir.kind === "array" && Array.isArray(defaultValue) && defaultValue.length === 0) return "[]";
  if (ir.kind === "boolean") return defaultValue ? "true" : "false";
  if (ir.kind === "integer" || ir.kind === "number") return String(defaultValue);
  if (ir.kind === "ref") return `.${swiftIdent(String(defaultValue))}`;
  if (ir.kind === "string") {
    if (ir.enumValues && ctx) {
      const hoisted = ctx.hoisted.enums.get(`${ctx.parent}.${ctx.prop}`);
      if (hoisted) return `.${swiftIdent(String(defaultValue))}`;
    }
    return JSON.stringify(defaultValue);
  }
  return undefined;
}

function renderEnum(name, values, doc) {
  const out = [];
  if (doc) out.push(`/// ${doc.replace(/\n/g, " ")}`);
  out.push(`public enum ${name}: String, Codable, CaseIterable, Sendable, Equatable {`);
  for (const v of values) out.push(`    case ${swiftIdent(v)} = ${JSON.stringify(v)}`);
  out.push("}", "");
  return out;
}

function renderStruct(name, ir, hoisted, description) {
  const ctxFor = (prop) => ({ parent: name, prop, hoisted });
  const out = [];
  if (description) out.push(`/// ${description.replace(/\n/g, " ")}`);
  out.push(`public struct ${name}: Codable, Equatable, Sendable {`);

  // Stored properties (wire snake_case -> Swift camelCase).
  for (const p of ir.props) {
    const optional = !p.required || p.ir.nullable;
    const base = swiftType(p.ir, ctxFor(p.name));
    const hints = [];
    if (p.ir.kind === "string" && p.ir.format && !p.ir.enumValues) hints.push(p.ir.format);
    if (p.ir.kind === "array" && p.ir.items.format) hints.push(`[${p.ir.items.format}]`);
    if (hints.length > 0) out.push(`    /// Format: ${hints.join(", ")}`);
    out.push(`    public var ${swiftIdent(p.name)}: ${base}${optional ? "?" : ""}`);
  }

  // CodingKeys - explicit so no keyDecodingStrategy is ever needed.
  out.push("", "    enum CodingKeys: String, CodingKey {");
  for (const p of ir.props) {
    const id = swiftIdent(p.name);
    const plain = id.replace(/`/g, "");
    out.push(
      plain === p.name
        ? `        case ${id}`
        : `        case ${id} = ${JSON.stringify(p.name)}`
    );
  }
  out.push("    }");

  // Memberwise init (optionals and spec defaults get default arguments).
  out.push("", `    public init(`);
  const inits = ir.props.map((p, i) => {
    const optional = !p.required || p.ir.nullable;
    const base = swiftType(p.ir, ctxFor(p.name));
    const def = swiftDefault(p.ir, p.defaultValue, ctxFor(p.name));
    let line = `        ${swiftIdent(p.name)}: ${base}${optional ? "?" : ""}`;
    if (def !== undefined) line += ` = ${def}`;
    else if (optional) line += " = nil";
    return line + (i < ir.props.length - 1 ? "," : "");
  });
  out.push(...inits, "    ) {");
  for (const p of ir.props) {
    const id = swiftIdent(p.name);
    out.push(`        self.${id} = ${id}`);
  }
  out.push("    }", "}", "");
  return out;
}

const JSON_VALUE_HELPER = `/// Minimal JSON value for free-form columns (e.g. club settings JSONB).
public enum JSONValue: Codable, Equatable, Sendable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported JSON value")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }
}
`;

function renderSwift(spec) {
  const hoisted = hoistedTypes(spec);
  const out = [fileHeader(spec, "//"), "", "import Foundation", ""];
  out.push(
    "// Timestamps and dates stay String on the wire (ISO 8601 / yyyy-MM-dd),",
    "// UUIDs stay String - decode without custom strategies, convert at the edge.",
    ""
  );
  out.push(JSON_VALUE_HELPER);

  // Named enums first, then hoisted inline types, then structs (spec order).
  const schemas = namedSchemas(spec);
  for (const { name, ir, description } of schemas) {
    if (ir.kind === "string" && ir.enumValues) out.push(...renderEnum(name, ir.enumValues, description));
  }
  for (const [source, e] of hoisted.enums) {
    out.push(...renderEnum(e.name, e.values, `Inline enum of ${source} (hoisted by codegen).`));
  }
  for (const [source, o] of hoisted.objects) {
    out.push(...renderStruct(o.name, o.ir, hoisted, `Inline object of ${source} (hoisted by codegen).`));
  }
  for (const { name, ir, description } of schemas) {
    if (ir.kind === "object") out.push(...renderStruct(name, ir, hoisted, description));
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n") + "";
}

/** Returns Map<absolutePath, content> - used by check.mjs for drift detection. */
export function generateFiles(spec = loadSpec()) {
  return new Map([[join(SWIFT_OUT_DIR, "RSMContracts.swift"), renderSwift(spec)]]);
}

export function writeFiles(files) {
  for (const [path, content] of files) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    console.log(`[gen-swift] wrote ${path}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFiles(generateFiles());
}
