/**
 * Vertrag des Check-in-QR-Codes eines Mitglieds — von BEIDEN Seiten genutzt:
 * der Anzeige („Mein QR-Code" auf /mein-qr und im Check-in) und dem Scanner
 * (Kamera-Check-in). Bewusst hier zentral, damit Kodierung und Dekodierung nie
 * auseinanderlaufen.
 *
 * Nutzlast angelehnt an v1 (rsm_member): `RSM|member|<clubId>|<memberId>` — kurz,
 * selbstbeschreibend und für jedes Mitglied stabil. Der eigentliche QR wird von
 * der self-contained Utility lib/qr kodiert (keine externe Abhängigkeit).
 */

/** Kompakte, stabile QR-Nutzlast einer Mitglieds-Identität. */
export function memberQrPayload(member: { id: string; clubId: string }): string {
  return `RSM|member|${member.clubId}|${member.id}`;
}

/**
 * Aus einem gescannten (oder manuell eingegebenen) QR-Text die Mitglieds-ID
 * herauslösen. Akzeptiert das strukturierte Vorzeig-Format
 * `RSM|member|<clubId>|<memberId>` ebenso wie eine nackte Mitglieds-ID. Die
 * endgültige Gültigkeit prüft der Aufrufer gegen die Mitgliederliste des
 * Vereins (ein fremder QR trifft dort auf kein Mitglied → saubere Ablehnung).
 */
export function parseMemberQr(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const parts = trimmed.split("|");
  if (parts.length === 4 && parts[0] === "RSM" && parts[1] === "member") {
    return parts[3].trim() || null;
  }
  return trimmed;
}
