/**
 * Bekannte Prüfvektoren (Known-Answer-Tests) für den QR-Encoder.
 *
 * Das Portal hat (noch) keinen Test-Runner in apps/web; diese Vektoren machen
 * die Kernkodierung dennoch verifizierbar — assertQrVectors() wirft bei jeder
 * Abweichung und kann aus einem künftigen vitest/Skript aufgerufen werden. Die
 * Werte sind gegen die ISO/IEC-18004-Referenz bzw. eine unabhängige
 * Encoder-Implementierung (segno) abgeglichen.
 */

import { encodeData } from "./encode";
import { encodeQr } from "./index";

interface CodewordVector {
  value: string;
  version: number;
  /** Interleavte Daten- + ECC-Codewörter (hex), exakt wie platziert. */
  codewordsHex: string;
}

/** Kanonischer Spec-Vektor: numerisch „01234567", Version 1, Stufe M. */
export const QR_CODEWORD_VECTORS: CodewordVector[] = [
  {
    value: "01234567",
    version: 1,
    codewordsHex:
      "10 20 0c 56 61 80 ec 11 ec 11 ec 11 ec 11 ec 11 a5 24 d4 c1 ed 36 c7 87 2c 55",
  },
];

/** Erwartete gewählte Version je Modus (Kapazitätsgrenzen Stufe M). */
export const QR_VERSION_VECTORS: { value: string; version: number }[] = [
  { value: "A", version: 1 },
  { value: "HELLO WORLD", version: 1 },
  { value: "8675309", version: 1 },
  { value: "THE QUICK BROWN FOX 0123456789 ABCDEFGHIJ", version: 3 },
];

/** Hex-Darstellung einer Codewort-Liste (Kleinbuchstaben, space-getrennt). */
function toHex(codewords: number[]): string {
  return codewords.map((b) => b.toString(16).padStart(2, "0")).join(" ");
}

/**
 * Alle Prüfvektoren ausführen; wirft mit sprechender Meldung bei Abweichung.
 * Prüft Codewörter, Versionswahl sowie strukturelle Invarianten der Matrix
 * (quadratisch, Finder-Muster in drei Ecken).
 */
export function assertQrVectors(): void {
  for (const v of QR_CODEWORD_VECTORS) {
    const encoded = encodeData(v.value);
    if (encoded.version.version !== v.version) {
      throw new Error(`QR ${v.value}: Version ${encoded.version.version} ≠ ${v.version}`);
    }
    const got = toHex(encoded.codewords);
    if (got !== v.codewordsHex) {
      throw new Error(`QR ${v.value}: Codewörter\n  got ${got}\n  exp ${v.codewordsHex}`);
    }
  }

  for (const v of QR_VERSION_VECTORS) {
    const version = encodeData(v.value).version.version;
    if (version !== v.version) {
      throw new Error(`QR ${v.value}: Version ${version} ≠ ${v.version}`);
    }
  }

  // Strukturelle Invariante: quadratische Matrix + drei Finder-Ecken (7×7).
  const { size, modules } = encodeQr("RSM-CHECKIN-STRUCTURE-TEST");
  const finderDark = (r0: number, c0: number): boolean =>
    modules[r0][c0] && modules[r0][c0 + 6] && modules[r0 + 6][c0] && !modules[r0 + 1][c0 + 1];
  if (modules.length !== size || !finderDark(0, 0) || !finderDark(0, size - 7) || !finderDark(size - 7, 0)) {
    throw new Error("QR-Struktur: Finder-Muster fehlen oder Matrix ist nicht quadratisch");
  }
}
