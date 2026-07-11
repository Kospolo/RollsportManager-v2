/**
 * Segment-Kodierung + Codewort-Aufbau des QR-Encoders.
 *
 * Wählt automatisch den kompaktesten Modus (numerisch → alphanumerisch → Byte,
 * UTF-8), die kleinste passende Version (1–10, Stufe M), baut den Bitstrom mit
 * Terminator/Padding und interleavt Daten-/ECC-Codewörter blockweise.
 */

import { reedSolomon } from "./gf";
import { totalDataCodewords, VERSION_SPECS, type VersionSpec } from "./tables";

type Mode = "numeric" | "alphanumeric" | "byte";

const ALPHANUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
const MODE_INDICATOR: Record<Mode, number> = { numeric: 0b0001, alphanumeric: 0b0010, byte: 0b0100 };

/** Kleinsten Modus bestimmen, der ALLE Zeichen abdeckt. */
function detectMode(text: string): Mode {
  if (/^[0-9]+$/.test(text)) return "numeric";
  for (const ch of text) if (!ALPHANUM.includes(ch)) return "byte";
  return "alphanumeric";
}

/** UTF-8-Bytes eines Strings (für den Byte-Modus). */
function utf8Bytes(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

/** Bits des Zeichenanzahl-Indikators (Versionen 1–9 vs. 10 unterscheiden sich). */
function charCountBits(mode: Mode, version: number): number {
  const small = version <= 9;
  if (mode === "numeric") return small ? 10 : 12;
  if (mode === "alphanumeric") return small ? 9 : 11;
  return small ? 8 : 16; // byte
}

/** Reine Nutzlast-Bits (ohne Modus-/Zähler-Overhead) für die Versionswahl. */
function payloadBits(mode: Mode, text: string, byteLen: number): number {
  if (mode === "numeric") {
    const groups = Math.floor(text.length / 3);
    const rest = text.length % 3;
    return groups * 10 + (rest === 2 ? 7 : rest === 1 ? 4 : 0);
  }
  if (mode === "alphanumeric") {
    return Math.floor(text.length / 2) * 11 + (text.length % 2) * 6;
  }
  return byteLen * 8;
}

class BitBuffer {
  readonly bits: number[] = [];
  push(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >> i) & 1);
  }
}

/** Nutzlast-Bits eines Segments in den Puffer schreiben. */
function writePayload(buf: BitBuffer, mode: Mode, text: string, bytes: number[]): void {
  if (mode === "numeric") {
    for (let i = 0; i < text.length; i += 3) {
      const chunk = text.slice(i, i + 3);
      buf.push(parseInt(chunk, 10), chunk.length === 3 ? 10 : chunk.length === 2 ? 7 : 4);
    }
  } else if (mode === "alphanumeric") {
    for (let i = 0; i < text.length; i += 2) {
      if (i + 1 < text.length) {
        buf.push(ALPHANUM.indexOf(text[i]) * 45 + ALPHANUM.indexOf(text[i + 1]), 11);
      } else {
        buf.push(ALPHANUM.indexOf(text[i]), 6);
      }
    }
  } else {
    for (const byte of bytes) buf.push(byte, 8);
  }
}

/** Ergebnis der Kodierung: finale Codewörter + gewählte Version. */
export interface EncodedData {
  version: VersionSpec;
  /** Interleavte Daten- + ECC-Codewörter in Platzierungsreihenfolge. */
  codewords: number[];
}

/**
 * Text zu QR-Codewörtern kodieren (Stufe M). Wirft, wenn die Nutzlast Version
 * 10-M übersteigt — der Aufrufer soll den Inhalt kürzen.
 */
export function encodeData(text: string): EncodedData {
  const mode = detectMode(text);
  const bytes = mode === "byte" ? utf8Bytes(text) : [];
  const charCount = mode === "byte" ? bytes.length : text.length;
  const dataBits = payloadBits(mode, text, bytes.length);

  const spec = VERSION_SPECS.find(
    (s) => 4 + charCountBits(mode, s.version) + dataBits <= totalDataCodewords(s) * 8,
  );
  if (!spec) {
    throw new Error("QR-Inhalt zu lang für Version 10-M — bitte kürzen.");
  }

  const capacityCodewords = totalDataCodewords(spec);
  const buf = new BitBuffer();
  buf.push(MODE_INDICATOR[mode], 4);
  buf.push(charCount, charCountBits(mode, spec.version));
  writePayload(buf, mode, text, bytes);

  // Terminator (bis zu 4 Bit) + Byte-Auffüllung mit Nullen.
  const capacityBits = capacityCodewords * 8;
  const terminator = Math.min(4, capacityBits - buf.bits.length);
  for (let i = 0; i < terminator; i++) buf.bits.push(0);
  while (buf.bits.length % 8 !== 0) buf.bits.push(0);

  // In Codewörter packen, dann mit 0xEC/0x11 alternierend auffüllen.
  const dataCodewords: number[] = [];
  for (let i = 0; i < buf.bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | buf.bits[i + j];
    dataCodewords.push(byte);
  }
  const PAD = [0xec, 0x11];
  for (let i = 0; dataCodewords.length < capacityCodewords; i++) {
    dataCodewords.push(PAD[i % 2]);
  }

  return { version: spec, codewords: interleave(spec, dataCodewords) };
}

/**
 * Daten in Blöcke aufteilen, je Block ECC rechnen und Daten-/ECC-Codewörter
 * spaltenweise verschränken (ISO/IEC 18004 §8.6).
 */
function interleave(spec: VersionSpec, data: number[]): number[] {
  const blocks: { data: number[]; ecc: number[] }[] = [];
  let offset = 0;
  for (const group of spec.groups) {
    for (let b = 0; b < group.count; b++) {
      const chunk = data.slice(offset, offset + group.dataCodewords);
      offset += group.dataCodewords;
      blocks.push({ data: chunk, ecc: reedSolomon(chunk, spec.eccPerBlock) });
    }
  }

  const result: number[] = [];
  const maxData = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < maxData; i++) {
    for (const block of blocks) if (i < block.data.length) result.push(block.data[i]);
  }
  for (let i = 0; i < spec.eccPerBlock; i++) {
    for (const block of blocks) result.push(block.ecc[i]);
  }
  return result;
}
