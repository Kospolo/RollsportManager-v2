import type { PlatformEntitlement, SupportTicket } from "@/lib/types";

/**
 * Reine Ableitungen des Betreiber-Dashboards. Ausgelagert, damit der Client
 * Darstellung bleibt und diese Regeln einzeln lesbar (und prüfbar) sind.
 *
 * ############################################################################
 * ### WAS HIER ABSICHTLICH FEHLT: DER UMSATZ                               ###
 * ############################################################################
 * Der Auftrag nennt „Umsatz/offene Zahlungen“ als Dashboard-Zahl. Die offenen
 * Rechnungen liefert /platform/stats (openInvoices). Den UMSATZ liefert kein
 * Endpunkt:
 *   * /platform/payments gibt Webhook-EREIGNISSE zurück (id, provider,
 *     event_id, event_type, status, received_at, processed_at) — KEINE Beträge.
 *   * /platform/products kennt Preise (price_cents), /platform/entitlements
 *     kennt je Verein eine Stufe (tier).
 * Man könnte daraus einen MRR basteln: Stufe → Produkt raten, Preise addieren.
 * Das wäre genau das „heimliche clientseitige Zusammenrechnen“, das der Auftrag
 * untersagt — und es wäre falsch: die Zuordnung tier→Produktcode ist nirgends
 * hinterlegt (es gibt club_license UND personal_pro, month UND year), und
 * niemand sähe der Zahl an, dass sie geraten ist. Eine erfundene Umsatzzahl auf
 * dem Dashboard des Geschäftsführers ist schlimmer als gar keine.
 *
 * Deshalb: das Dashboard zeigt, was belegt ist (Abo-Zustände, offene
 * Rechnungen), und sagt beim Umsatz ausdrücklich, dass er fehlt. Was der Server
 * dafür liefern müsste, steht im Bericht.
 */

/** Ab wann eine Testphase als „läuft bald aus“ gilt. */
export const TRIAL_SOON_DAYS = 30;

/** Tage bis zum Stichtag (negativ = bereits vorbei). */
export function daysUntil(iso: string, now: Date = new Date()): number {
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000);
}

/**
 * Testphasen, die in den nächsten TRIAL_SOON_DAYS auslaufen — und die bereits
 * abgelaufenen, die noch auf „trial“ stehen.
 *
 * Das ist KEINE Hochrechnung: status und validUntil stehen so je Verein in der
 * Antwort von /platform/entitlements. Hier wird gefiltert und sortiert, nicht
 * gerechnet.
 *
 * Abgelaufene bleiben ausdrücklich drin (daysUntil < 0): eine Testphase, deren
 * Enddatum vorbei ist und die immer noch „trial“ heißt, ist genau der Fall, den
 * Marcel sehen MUSS — dort läuft jemand seit Wochen gratis mit, oder die
 * Zustandsmaschine hängt.
 */
export function expiringTrials(
  rows: readonly PlatformEntitlement[],
  now: Date = new Date(),
): PlatformEntitlement[] {
  return rows
    .filter((r) => r.status === "trial" && r.validUntil !== undefined)
    .filter((r) => daysUntil(r.validUntil as string, now) <= TRIAL_SOON_DAYS)
    .sort((a, b) => (a.validUntil as string).localeCompare(b.validUntil as string));
}

/** Vereine mit überfälliger Zahlung — die zweite Zahl, die Geld kostet. */
export function pastDueClubs(rows: readonly PlatformEntitlement[]): PlatformEntitlement[] {
  return rows.filter((r) => r.status === "past_due").sort((a, b) => a.clubName.localeCompare(b.clubName));
}

/**
 * Tickets, die auf Marcel warten. „waiting_on_club“ zählt bewusst NICHT: dort
 * hat er geantwortet und wartet selbst. Ein Dashboard, das ihm 40 Tickets
 * vorhält, bei denen er nichts tun kann, wird nicht mehr gelesen.
 */
export function ticketsAwaitingOperator(tickets: readonly SupportTicket[]): SupportTicket[] {
  return tickets
    .filter((x) => x.status === "open" || x.status === "in_progress")
    .sort((a, b) => (b.lastReplyAt ?? b.createdAt).localeCompare(a.lastReplyAt ?? a.createdAt));
}
