import Foundation
import SwiftUI

// ============================================================================
// Reine Ableitungen der Rechnungs-Verwaltung (Seriositätszone Finanzen).
// Web-Referenz: apps/web/app/(portal)/finanzen/rechnungen/derive.ts.
//
// Alle Typen/Funktionen hier sind PUR — sie arbeiten auf den geladenen
// Contracts (Invoice, READ-ONLY) und tragen keinerlei Netzwerkzustand. Das
// hält den ViewModel schlank und die Summen konsistent zur Anzeige.
// ============================================================================

/// Filter über der Rechnungsliste: „Alle" plus die drei sichtbaren Status.
/// Entwürfe erscheinen bewusst nur unter „Alle" (sie sind ein Zwischenschritt,
/// kein eigener Arbeitskorb) — deckt die verbindliche Vorgabe
/// Alle · Offen · Bezahlt · Storniert ab.
enum InvoiceStatusFilter: CaseIterable, Identifiable {
    case all
    case open
    case paid
    case cancelled

    var id: Self { self }

    var labelKey: LocalizedStringKey {
        switch self {
        case .all: "rechnungen.filter.all"
        case .open: "rechnungen.filter.open"
        case .paid: "rechnungen.filter.paid"
        case .cancelled: "rechnungen.filter.cancelled"
        }
    }

    /// Zählt für die Chip-Badge: „Alle" alle, sonst der jeweilige Status.
    func matches(_ invoice: Invoice) -> Bool {
        switch self {
        case .all: return true
        case .open: return invoice.status == .open
        case .paid: return invoice.status == .paid
        case .cancelled: return invoice.status == .cancelled
        }
    }
}

/// Wort + Farbwelt eines Rechnungsstatus (Design-System §3.6: Status nie nur
/// über Farbe — der Chip trägt IMMER ein Wort).
enum InvoiceStatusDisplay {
    static func labelKey(_ status: InvoiceStatus) -> LocalizedStringKey {
        switch status {
        case .draft: "rechnungen.status.draft"
        case .open: "rechnungen.status.open"
        // „Teilbezahlt" kam mit Migration 0072 in den Contract; ohne diesen
        // Fall compilierte NICHTS mehr — auch das iOS-Ziel nicht.
        case .partiallyPaid: "rechnungen.status.partiallyPaid"
        case .paid: "rechnungen.status.paid"
        case .cancelled: "rechnungen.status.cancelled"
        }
    }

    static func pillKind(_ status: InvoiceStatus) -> RSMStatusKind {
        switch status {
        case .draft: .neutral
        case .open: .info
        // Teilbezahlt ist BEWUSST kein „success": es ist noch etwas offen.
        // Gleiche Entscheidung wie im Web (finanzen/rechnungen/derive.ts).
        case .partiallyPaid: .warn
        case .paid: .success
        case .cancelled: .neutral
        }
    }
}

/// Betrags-Ableitungen der Rechnungsmenge — nie hart codiert, immer aus den
/// DENSELBEN Datensätzen wie die angezeigten Zeilen.
enum InvoiceMath {
    /// Summe der Beträge in Cents (offene Beträge im Contract, `nil`, zählen 0).
    static func sumCents(_ invoices: [Invoice]) -> Int {
        invoices.reduce(0) { $0 + ($1.amountCents ?? 0) }
    }

    /// Sortiert: zuletzt ausgestellt zuerst, bei Gleichstand höhere Nummer oben
    /// (Strings vergleichen lexikografisch — die Rechnungsnummern sind
    /// links-null-aufgefüllt und damit korrekt geordnet).
    static func sorted(_ invoices: [Invoice]) -> [Invoice] {
        invoices.sorted { lhs, rhs in
            let lhsKey = lhs.issuedOn ?? lhs.createdAt
            let rhsKey = rhs.issuedOn ?? rhs.createdAt
            if lhsKey != rhsKey { return lhsKey > rhsKey }
            return lhs.number > rhs.number
        }
    }
}

/// Euro-Eingabe → Cents. Akzeptiert deutsche und englische Trennzeichen
/// („86,00" · „86" · „1.234,50" · „86.50"); das letzte Komma/Punkt gilt als
/// Dezimaltrenner. `nil` bei leerer oder ungültiger Eingabe.
/// Web-Referenz: derive.ts `parseEuroToCents`.
enum InvoiceAmountInput {
    static func parseEuroToCents(_ input: String) -> Int? {
        let cleaned = input.trimmingCharacters(in: .whitespaces)
            .filter { $0.isNumber || $0 == "," || $0 == "." }
        guard !cleaned.isEmpty else { return nil }

        let lastComma = cleaned.lastIndex(of: ",")
        let lastDot = cleaned.lastIndex(of: ".")
        let normalized: String
        switch (lastComma, lastDot) {
        case let (comma?, dot?) where comma > dot:
            // Komma ist Dezimaltrenner (de) — Punkte sind Tausenderpunkte.
            normalized = cleaned.replacingOccurrences(of: ".", with: "")
                .replacingOccurrences(of: ",", with: ".")
        case let (comma?, dot?) where dot > comma:
            // Punkt ist Dezimaltrenner (en) — Kommata sind Tausendertrenner.
            normalized = cleaned.replacingOccurrences(of: ",", with: "")
        case (.some, .none):
            normalized = cleaned.replacingOccurrences(of: ",", with: ".")
        default:
            normalized = cleaned
        }

        guard let value = Double(normalized), value.isFinite, value >= 0 else { return nil }
        return Int((value * 100).rounded())
    }
}
