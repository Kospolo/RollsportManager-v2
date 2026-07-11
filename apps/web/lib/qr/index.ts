/**
 * Selbst-enthaltene QR-Utility des Portals (Policy: keine externen Laufzeit-
 * Deps). Kodiert kurze URLs/IDs für Check-in & „Mein QR-Code" als QR-Matrix
 * (Fehlerkorrektur-Stufe M, Versionen 1–10) und rendert sie als Inline-SVG.
 *
 *   import { QrCode, encodeQr } from "@/lib/qr";
 *   <QrCode value="https://…/checkin?token=…" size={220} />
 *
 * encodeQr(value) liefert die reine Matrix (size + modules) für eigene
 * Renderer; die Komponente <QrCode> ist der Standardweg.
 */

import { encodeData } from "./encode";
import { buildMatrix } from "./matrix";

/** Reine QR-Matrix: Kantenlänge in Modulen + Belegung (true = dunkel). */
export interface QrMatrix {
  /** Kantenlänge in Modulen (21…57 für Version 1…10). */
  size: number;
  /** Zeilen × Spalten, true = dunkles Modul. */
  modules: boolean[][];
}

/**
 * Text (URL/ID) zu einer QR-Matrix kodieren. Wirft, wenn der Inhalt Version
 * 10-M übersteigt (dann kürzen) oder leer ist.
 */
export function encodeQr(value: string): QrMatrix {
  if (!value) throw new Error("QR-Wert darf nicht leer sein.");
  return buildMatrix(encodeData(value));
}

export { QrCode } from "./QrCode";
