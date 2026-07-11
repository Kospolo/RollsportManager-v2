/**
 * Matrix-Aufbau, Maskierung und Formatinfo des QR-Encoders.
 *
 * Setzt die Funktionsmuster (Finder, Separatoren, Timing, Alignment, Dark
 * Module), platziert den Codewort-Bitstrom im Zickzack, testet alle acht
 * Masken per Straf-Score und brennt die passende Format-/Versionsinformation.
 */

import type { EncodedData } from "./encode";
import { ALIGNMENT_CENTERS, formatBits, moduleSize, versionBits } from "./tables";

/** −1 = noch frei, sonst 0/1. Reserved markiert Funktionsmuster (nie maskiert). */
interface Grid {
  size: number;
  cells: Int8Array;
  reserved: Uint8Array;
}

function idx(size: number, r: number, c: number): number {
  return r * size + c;
}

function newGrid(size: number): Grid {
  return { size, cells: new Int8Array(size * size).fill(-1), reserved: new Uint8Array(size * size) };
}

function place(g: Grid, r: number, c: number, dark: boolean, reserved = true): void {
  g.cells[idx(g.size, r, c)] = dark ? 1 : 0;
  if (reserved) g.reserved[idx(g.size, r, c)] = 1;
}

/** Finder-Muster (7×7) inkl. hellem Separator (8. Reihe/Spalte) setzen. */
function drawFinder(g: Grid, top: number, left: number): void {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = top + r;
      const cc = left + c;
      if (rr < 0 || rr >= g.size || cc < 0 || cc >= g.size) continue;
      const inFinder = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      // Separator-Ring (r/c = −1 oder 7) ist immer hell; nur echte
      // Finder-Module bilden den 7×7-Rahmen mit 3×3-Kern.
      const onBorder = inFinder && (r === 0 || r === 6 || c === 0 || c === 6);
      const inCore = inFinder && r >= 2 && r <= 4 && c >= 2 && c <= 4;
      place(g, rr, cc, onBorder || inCore);
    }
  }
}

/** Alignment-Muster (5×5) mit Zentrum (r,c) setzen. */
function drawAlignment(g: Grid, r: number, c: number): void {
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const ring = Math.max(Math.abs(dr), Math.abs(dc));
      place(g, r + dr, c + dc, ring !== 1);
    }
  }
}

/** Alle Funktionsmuster einer Version zeichnen (ohne Format-/Versionsbits). */
function drawFunctionPatterns(g: Grid, version: number): void {
  const n = g.size;
  drawFinder(g, 0, 0);
  drawFinder(g, 0, n - 7);
  drawFinder(g, n - 7, 0);

  // Timing-Muster (Zeile/Spalte 6), abwechselnd dunkel.
  for (let i = 8; i < n - 8; i++) {
    place(g, 6, i, i % 2 === 0);
    place(g, i, 6, i % 2 === 0);
  }

  // Alignment-Muster an allen Zentrenpaaren außer über Findern.
  const centers = ALIGNMENT_CENTERS[version - 1];
  for (const r of centers) {
    for (const c of centers) {
      const nearFinder =
        (r <= 7 && c <= 7) || (r <= 7 && c >= n - 8) || (r >= n - 8 && c <= 7);
      if (!nearFinder) drawAlignment(g, r, c);
    }
  }

  // Dark Module (immer dunkel) + Format-/Versionsfelder reservieren.
  place(g, n - 8, 8, true);
  reserveFormatAndVersion(g, version);
}

/** Format- (immer) und Versionsfelder (v ≥ 7) als reserviert markieren. */
function reserveFormatAndVersion(g: Grid, version: number): void {
  const n = g.size;
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      g.reserved[idx(n, 8, i)] = 1;
      g.reserved[idx(n, i, 8)] = 1;
    }
  }
  for (let i = 0; i < 8; i++) {
    g.reserved[idx(n, 8, n - 1 - i)] = 1;
    g.reserved[idx(n, n - 1 - i, 8)] = 1;
  }
  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        g.reserved[idx(n, i, n - 11 + j)] = 1;
        g.reserved[idx(n, n - 11 + j, i)] = 1;
      }
    }
  }
}

/** Codewort-Bitstrom im Zickzack von rechts unten nach oben platzieren. */
function placeData(g: Grid, codewords: number[]): void {
  const n = g.size;
  let bitIndex = 0;
  const totalBits = codewords.length * 8;
  const bitAt = (i: number): number => (codewords[i >> 3] >> (7 - (i & 7))) & 1;

  let upward = true;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--; // vertikale Timing-Spalte 6 komplett überspringen
    for (let step = 0; step < n; step++) {
      const row = upward ? n - 1 - step : step;
      for (let k = 0; k < 2; k++) {
        const cc = col - k;
        if (g.reserved[idx(n, row, cc)]) continue;
        const bit = bitIndex < totalBits ? bitAt(bitIndex) : 0;
        g.cells[idx(n, row, cc)] = bit;
        bitIndex++;
      }
    }
    upward = !upward;
  }
}

/** Maskenbedingung 0–7 (ISO/IEC 18004 Tabelle 10). */
function maskCondition(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0: return (r + c) % 2 === 0;
    case 1: return r % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    default: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  }
}

/**
 * Format-Bits (15) für Maske `mask` in beide Kopien brennen. k=0 ist das MSB
 * (Bit 14); die Positionslisten bilden die ISO-Reihenfolge exakt ab.
 */
function drawFormat(g: Grid, mask: number): void {
  const n = g.size;
  const bits = formatBits(mask);
  // Kopie 1 um das linke obere Finder-Muster (MSB → LSB).
  const copy1: [number, number][] = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  // Kopie 2: unter dem linken unteren (Spalte 8) + neben dem rechten oberen (Zeile 8).
  const copy2: [number, number][] = [
    [n - 1, 8], [n - 2, 8], [n - 3, 8], [n - 4, 8], [n - 5, 8], [n - 6, 8], [n - 7, 8],
    [8, n - 8], [8, n - 7], [8, n - 6], [8, n - 5], [8, n - 4], [8, n - 3], [8, n - 2], [8, n - 1],
  ];
  for (let k = 0; k < 15; k++) {
    const dark = ((bits >> (14 - k)) & 1) === 1 ? 1 : 0;
    g.cells[idx(n, copy1[k][0], copy1[k][1])] = dark;
    g.cells[idx(n, copy2[k][0], copy2[k][1])] = dark;
  }
}

/** Versionsinfo (18 Bit) für Versionen ≥ 7 in beide Blöcke brennen. */
function drawVersion(g: Grid, version: number): void {
  if (version < 7) return;
  const n = g.size;
  const bits = versionBits(version);
  for (let i = 0; i < 18; i++) {
    const dark = ((bits >> i) & 1) === 1;
    const r = Math.floor(i / 3);
    const c = i % 3;
    g.cells[idx(n, r, n - 11 + c)] = dark ? 1 : 0;
    g.cells[idx(n, n - 11 + c, r)] = dark ? 1 : 0;
  }
}

/** Strafpunkte einer maskierten Matrix (vier Regeln, kleiner ist besser). */
function penalty(g: Grid): number {
  const n = g.size;
  const at = (r: number, c: number): number => g.cells[idx(n, r, c)];
  let score = 0;

  // Regel 1: Läufe ≥ 5 gleicher Module (zeilen- und spaltenweise).
  for (let r = 0; r < n; r++) {
    for (let dir = 0; dir < 2; dir++) {
      let run = 1;
      let prev = dir === 0 ? at(r, 0) : at(0, r);
      for (let i = 1; i < n; i++) {
        const cur = dir === 0 ? at(r, i) : at(i, r);
        if (cur === prev) {
          run++;
          if (run === 5) score += 3;
          else if (run > 5) score += 1;
        } else {
          run = 1;
          prev = cur;
        }
      }
    }
  }

  // Regel 2: gleichfarbige 2×2-Blöcke.
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = at(r, c);
      if (v === at(r, c + 1) && v === at(r + 1, c) && v === at(r + 1, c + 1)) score += 3;
    }
  }

  // Regel 3: Finder-ähnliches Muster 1:1:3:1:1 mit vier hellen Modulen.
  const pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const matches = (get: (i: number) => number, pat: number[]): boolean =>
    pat.every((p, i) => get(i) === p);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (c + 11 <= n) {
        const get = (i: number): number => at(r, c + i);
        if (matches(get, pat1) || matches(get, pat2)) score += 40;
      }
      if (r + 11 <= n) {
        const get = (i: number): number => at(r + i, c);
        if (matches(get, pat1) || matches(get, pat2)) score += 40;
      }
    }
  }

  // Regel 4: Abweichung vom 50%-Dunkelanteil.
  let dark = 0;
  for (let i = 0; i < g.cells.length; i++) if (g.cells[i] === 1) dark++;
  const ratio = (dark * 100) / g.cells.length;
  score += Math.floor(Math.abs(ratio - 50) / 5) * 10;
  return score;
}

/**
 * Finale QR-Matrix aus kodierten Daten bauen: Funktionsmuster, Datenplatzierung,
 * beste der acht Masken, Format-/Versionsinfo. Liefert die Modul-Matrix (true =
 * dunkel) plus Kantenlänge.
 */
export function buildMatrix(encoded: EncodedData): { size: number; modules: boolean[][] } {
  const version = encoded.version.version;
  const size = moduleSize(version);

  const base = newGrid(size);
  drawFunctionPatterns(base, version);
  placeData(base, encoded.codewords);

  let best: Grid | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const g = newGrid(size);
    g.cells.set(base.cells);
    g.reserved.set(base.reserved);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!g.reserved[idx(size, r, c)] && maskCondition(mask, r, c)) {
          g.cells[idx(size, r, c)] ^= 1;
        }
      }
    }
    drawFormat(g, mask);
    drawVersion(g, version);
    const score = penalty(g);
    if (score < bestScore) {
      bestScore = score;
      best = g;
    }
  }

  const chosen = best as Grid;
  const modules: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) row.push(chosen.cells[idx(size, r, c)] === 1);
    modules.push(row);
  }
  return { size, modules };
}
