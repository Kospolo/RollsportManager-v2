import Foundation

// ============================================================================
// Finanz-Tiefe A — typisierte API-Calls für Kassenbuch, Rechnungen und
// Mahnwesen. Dünne Schicht über APIClient, Muster wie Endpoints.swift.
//
// Web-Referenz der Pfade (apps/web/lib/api/generated/client.ts):
//   Kassenbuch: GET/POST /ledger · GET/POST /ledger/categories ·
//               POST /ledger/{entryId}/reverse
//   Rechnungen: GET/POST /invoices · GET/PATCH /invoices/{invoiceId}
//   Mahnwesen:  POST /clubs/{id}/dunning/run · POST /clubs/{id}/dunning/apply ·
//               GET /clubs/{id}/dunning/log
//
// Rechte werden SERVERSEITIG durchgesetzt (RLS + DB-Re-Check); der Client
// spiegelt sie nur über `permissions().canManageFinance`
// (treasurer/moderator/admin/owner). Fehlt das Recht ⇒ RFC-7807-`Problem` mit
// `status == 403`. GoBD: kein Hard-Delete — Korrektur ausschließlich über
// Storno-Gegenbuchung (reverse) bzw. terminalen Rechnungs-Status.
//
// Alle Request-/Response-Typen kommen aus den generierten Contracts
// (READ-ONLY). Der bestehende Overview-VM nutzt weiter `invoices(clubId:)` und
// `dunningRun(clubId:_:)` aus Endpoints.swift — die bleiben unberührt, hier
// kommen nur die tieferen Calls additiv dazu.
// ============================================================================

extension APIClient {

    // MARK: - Kassenbuch (Ledger)

    /// GET /ledger — Kassenbuch-Journal des Vereins (append-only GoBD:
    /// Einnahmen positiv, Ausgaben negativ, Korrekturen als Storno-Gegenbuchung).
    /// Nur can_manage_finance; sonst `Problem` mit `status == 403`.
    func listLedger(clubId: String) async throws -> [LedgerEntry] {
        try await get("/ledger", query: [URLQueryItem(name: "club_id", value: clubId)])
    }

    /// POST /ledger — Kassenbuch-Buchung anlegen. `amountCents` ist
    /// vorzeichenbehaftet (Einnahme > 0, Ausgabe < 0). `clubId` steckt im
    /// `LedgerEntryCreate` (Muster wie `createEvent`). Antwort ist der erzeugte
    /// `LedgerEntry` inkl. ID.
    func createLedgerEntry(_ input: LedgerEntryCreate) async throws -> LedgerEntry {
        try await post("/ledger", body: input)
    }

    /// POST /ledger/{entryId}/reverse — Storno einer Buchung (GoBD-sicher:
    /// hängt eine negierte Gegenbuchung mit gesetztem `reverses_entry_id` an,
    /// statt zu löschen). Optionaler Begründungstext im `LedgerReverse`.
    func reverseLedgerEntry(id: String, description: String? = nil) async throws -> LedgerEntry {
        try await post("/ledger/\(id)/reverse", body: LedgerReverse(description: description))
    }

    /// GET /ledger/categories — Kassenbuch-Kategorien des Vereins
    /// (can_manage_finance).
    func listLedgerCategories(clubId: String) async throws -> [LedgerCategory] {
        try await get("/ledger/categories", query: [URLQueryItem(name: "club_id", value: clubId)])
    }

    // MARK: - Rechnungen (Invoices)

    /// GET /invoices — Rechnungsliste, optional gefiltert nach `status`
    /// (draft/open/paid/cancelled) und `memberId`. Reichere Variante der
    /// bestehenden `invoices(clubId:)`; RLS: Finanzrollen sehen alle,
    /// Mitglieder nur eigene/Kinder (Filter greift für sie folgenlos).
    func listInvoices(
        clubId: String,
        status: InvoiceStatus? = nil,
        memberId: String? = nil
    ) async throws -> [Invoice] {
        var query = [URLQueryItem(name: "club_id", value: clubId)]
        if let status { query.append(URLQueryItem(name: "status", value: status.rawValue)) }
        if let memberId { query.append(URLQueryItem(name: "member_id", value: memberId)) }
        return try await get("/invoices", query: query)
    }

    /// GET /invoices/{invoiceId} — Rechnungs-Detail (RLS wie die Liste).
    func getInvoice(id: String) async throws -> Invoice {
        try await get("/invoices/\(id)")
    }

    /// POST /invoices — Rechnung anlegen (can_manage_finance; race-freie Nummer
    /// serverseitig). `clubId`/`memberId`/`amountCents` stecken im
    /// `InvoiceCreate` (Muster wie `createEvent`); `issue: true` stellt sofort
    /// von `draft` auf `open`. Antwort ist die erzeugte `Invoice`.
    func createInvoice(_ input: InvoiceCreate) async throws -> Invoice {
        try await post("/invoices", body: input)
    }

    /// PATCH /invoices/{invoiceId} — Rechnung abschließen: `open → paid`
    /// (optional Kassenbuch-Einnahme via `postToLedger`) oder `→ cancelled`
    /// (Storno). Terminal — GoBD: kein Wieder-Öffnen. Muster wie `updateMember`.
    func setInvoiceStatus(id: String, _ update: InvoiceUpdate) async throws -> Invoice {
        try await patch("/invoices/\(id)", body: update)
    }

    /// Convenience-Overload: nur der Ziel-Status (paid/cancelled), Rest Default.
    func setInvoiceStatus(id: String, status: InvoiceUpdateStatus) async throws -> Invoice {
        try await setInvoiceStatus(id: id, InvoiceUpdate(status: status))
    }

    // MARK: - Mahnwesen (Dunning)

    /// POST /clubs/{clubId}/dunning/run — Mahnlauf. `dryRun` (Default `true`)
    /// berechnet nur; Stufen ≥ 2 kommen immer als `pending_approval` zurück und
    /// werden nie automatisch geschrieben. Convenience um das bestehende
    /// `dunningRun(clubId:_:)`.
    func runDunning(clubId: String, dryRun: Bool = true, asOf: String? = nil) async throws -> DunningRunResult {
        try await dunningRun(clubId: clubId, DunningRunRequest(dryRun: dryRun, asOf: asOf))
    }

    /// POST /clubs/{clubId}/dunning/apply — scharfe Anwendung einer Mahnstufe
    /// auf ausgewählte Rechnungen + Audit-Log. Stufen ≥ 2 verlangen
    /// `approveEscalation: true` (die bewusste menschliche Freigabe). Nur
    /// can_manage_finance; Antwort ist das `DunningApplyResult` (inkl. Log).
    func applyDunning(clubId: String, _ input: DunningApplyRequest) async throws -> DunningApplyResult {
        try await post("/clubs/\(clubId)/dunning/apply", body: input)
    }

    /// GET /clubs/{clubId}/dunning/log — Mahn-Audit-Log des Vereins, optional
    /// auf eine Rechnung (`invoiceId`) eingegrenzt. Nur can_manage_finance.
    func listDunningLog(clubId: String, invoiceId: String? = nil) async throws -> [DunningLogEntry] {
        var query: [URLQueryItem] = []
        if let invoiceId { query.append(URLQueryItem(name: "invoice_id", value: invoiceId)) }
        return try await get("/clubs/\(clubId)/dunning/log", query: query)
    }
}
