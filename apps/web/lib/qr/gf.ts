/**
 * GF(256)-Arithmetik + Reed-Solomon-Fehlerkorrektur für den QR-Encoder.
 *
 * Selbst-enthaltene Implementierung (Policy: keine externen Laufzeit-Deps) —
 * das QR-Standardpolynom ist x^8 + x^4 + x^3 + x^2 + 1 (0x11D), primitives
 * Element α = 2. Exp-/Log-Tabellen werden einmalig beim Modul-Load aufgebaut.
 */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  // Verdopplung des Exp-Rings erspart die Modulo-Rechnung beim Multiplizieren.
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

/** Produkt zweier GF(256)-Elemente (0 absorbiert). */
function mul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

/**
 * Generatorpolynom für `degree` ECC-Codewörter — Koeffizienten in absteigender
 * Ordnung, Produkt der Faktoren (x − α^i). Cache pro Grad, da versionsstabil.
 */
const GEN_CACHE = new Map<number, number[]>();
function generatorPoly(degree: number): number[] {
  const cached = GEN_CACHE.get(degree);
  if (cached) return cached;
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  GEN_CACHE.set(degree, poly);
  return poly;
}

/**
 * Reed-Solomon-ECC-Codewörter zu einem Datenblock (Polynomdivision durch das
 * Generatorpolynom). Liefert genau `eccCount` Codewörter.
 */
export function reedSolomon(data: number[], eccCount: number): number[] {
  const gen = generatorPoly(eccCount);
  const rem = new Array<number>(eccCount).fill(0);
  for (const byte of data) {
    const factor = byte ^ rem[0];
    rem.shift();
    rem.push(0);
    if (factor !== 0) {
      for (let i = 0; i < gen.length - 1; i++) {
        rem[i] ^= mul(gen[i + 1], factor);
      }
    }
  }
  return rem;
}
