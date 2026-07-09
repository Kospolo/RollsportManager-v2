/**
 * Hilfsfunktionen für die Mock-Daten — Termine liegen RELATIV zu heute,
 * damit der Demo-Verein nie „veraltet".
 */

/** ISO-Zeitstempel: heute + `days` Tage, zur Uhrzeit hour:minute (lokale Zeit). */
export function daysFromNow(days: number, hour = 12, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** ISO-Datum (YYYY-MM-DD): heute + `days` Tage. */
export function dateFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Deterministischer Pseudozufall (mulberry32) für statische Waveform-Peaks:
 * gleicher Seed → exakt gleiche Kurve, auf Server und Client identisch.
 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Statische Waveform-Peaks (0.08–1.0) mit musikalischer Hüllkurve. */
export function waveformPeaks(seed: number, count = 96): number[] {
  const rnd = seededRandom(seed);
  const peaks: number[] = [];
  for (let i = 0; i < count; i++) {
    const phase = i / count;
    // leiser Anfang, kräftiger Mittelteil, Finale mit Spitze
    const envelope =
      0.35 + 0.45 * Math.sin(Math.PI * phase) + (phase > 0.82 ? 0.2 * (phase - 0.82) * 5 : 0);
    const value = Math.min(1, Math.max(0.08, envelope * (0.55 + 0.45 * rnd())));
    peaks.push(Math.round(value * 100) / 100);
  }
  return peaks;
}
