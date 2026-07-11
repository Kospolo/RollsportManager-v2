/**
 * Statische QR-Tabellen für Fehlerkorrektur-Stufe M (Versionen 1–10).
 *
 * Der Konfigurator/Check-in kodiert kurze URLs und IDs — Version 10-M fasst
 * bereits 271 Byte / 513 numerische Zeichen, mehr als genug. Bewusst auf 1–10
 * begrenzt, damit die Tabellen kompakt bleiben (größere Nutzlast → sprechender
 * Fehler statt stiller Fehlfunktion).
 *
 * Quelle: ISO/IEC 18004, Tabellen 9 (Blocklayout) und E.1 (Alignment).
 */

/** Ein Blockschema: `count` Blöcke mit je `dataCodewords` Daten-Codewörtern. */
interface BlockGroup {
  count: number;
  dataCodewords: number;
}

/** Fehlerkorrektur-Layout einer Version (Stufe M). */
export interface VersionSpec {
  version: number;
  /** ECC-Codewörter pro Block (für alle Blöcke gleich). */
  eccPerBlock: number;
  /** Ein oder zwei Blockgruppen (Gruppe 2 hat ggf. ein Datenwort mehr). */
  groups: BlockGroup[];
}

/** Blocklayout Stufe M, Versionen 1–10 (ISO/IEC 18004 Tabelle 9). */
export const VERSION_SPECS: VersionSpec[] = [
  { version: 1, eccPerBlock: 10, groups: [{ count: 1, dataCodewords: 16 }] },
  { version: 2, eccPerBlock: 16, groups: [{ count: 1, dataCodewords: 28 }] },
  { version: 3, eccPerBlock: 26, groups: [{ count: 1, dataCodewords: 44 }] },
  { version: 4, eccPerBlock: 18, groups: [{ count: 2, dataCodewords: 32 }] },
  { version: 5, eccPerBlock: 24, groups: [{ count: 2, dataCodewords: 43 }] },
  { version: 6, eccPerBlock: 16, groups: [{ count: 4, dataCodewords: 27 }] },
  { version: 7, eccPerBlock: 18, groups: [{ count: 4, dataCodewords: 31 }] },
  {
    version: 8,
    eccPerBlock: 22,
    groups: [
      { count: 2, dataCodewords: 38 },
      { count: 2, dataCodewords: 39 },
    ],
  },
  {
    version: 9,
    eccPerBlock: 22,
    groups: [
      { count: 3, dataCodewords: 36 },
      { count: 2, dataCodewords: 37 },
    ],
  },
  {
    version: 10,
    eccPerBlock: 26,
    groups: [
      { count: 4, dataCodewords: 43 },
      { count: 1, dataCodewords: 44 },
    ],
  },
];

/** Gesamtzahl der Daten-Codewörter einer Version (Summe über alle Blöcke). */
export function totalDataCodewords(spec: VersionSpec): number {
  return spec.groups.reduce((sum, g) => sum + g.count * g.dataCodewords, 0);
}

/** Modul-Kantenlänge einer Version (21 + 4·(v−1)). */
export function moduleSize(version: number): number {
  return 21 + 4 * (version - 1);
}

/**
 * Zentren der Alignment-Muster je Version (leer bei Version 1). Das QR-Raster
 * setzt an jedem Paar (r,c) ein Muster, außer es überlappt ein Finder-Feld.
 */
export const ALIGNMENT_CENTERS: number[][] = [
  [], // v1
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

/**
 * 15-Bit-Formatinformation (Stufe M = 0b00) mit BCH-Fehlerkorrektur und der
 * festen Maske 0x5412 — indiziert über die 3-Bit-Maskennummer (0–7).
 */
export function formatBits(mask: number): number {
  const data = (0b00 << 3) | mask; // EC-Level M (00) + Maske
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) {
    if (rem & (1 << i)) rem ^= 0x537 << (i - 10); // Generator x^10+x^8+x^5+x^4+x^2+x+1
  }
  return ((data << 10) | rem) ^ 0x5412;
}

/**
 * 18-Bit-Versionsinformation (nur Versionen ≥ 7) mit BCH-Fehlerkorrektur.
 * Generator 0x1F25 (x^12+…), keine XOR-Maske.
 */
export function versionBits(version: number): number {
  let rem = version << 12;
  for (let i = 17; i >= 12; i--) {
    if (rem & (1 << i)) rem ^= 0x1f25 << (i - 12);
  }
  return (version << 12) | rem;
}
