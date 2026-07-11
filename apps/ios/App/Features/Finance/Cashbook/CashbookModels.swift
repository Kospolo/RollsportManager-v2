import Foundation
import SwiftUI

// ============================================================================
// Kassenbuch — abgeleitete Ansichten & Eingabe-Helfer (PUR, testbar).
//
// Web-Referenz: apps/web/app/(portal)/finanzen/kassenbuch/derive.ts.
// GoBD-Semantik: Buchungen sind append-only. Ein Storno erzeugt eine
// Gegenbuchung (`reversesEntryId` gesetzt, negierter Betrag); die
// Originalbuchung bleibt erhalten. Der laufende Saldo ist der ECHTE Kontostand
// NACH dieser Buchung — chronologisch über das GESAMTE Kassenbuch gerechnet,
// damit Filter nur Zeilen ausblenden, den Saldo aber nicht verfälschen.
//
// Der generierte `LedgerEntry`-Contract ist READ-ONLY. `amountCents` ist dort
// optional (Betrag evtl. noch offen) — hier zählt `nil` als 0 Cent.
// ============================================================================

/// Zeitraum-Filter über der Buchungsliste (Design-System §3.3 Chips).
enum CashbookPeriod: CaseIterable, Identifiable {
    case all, d30, month, year

    var id: Self { self }

    var labelKey: LocalizedStringKey {
        switch self {
        case .all: "kassenbuch.period.all"
        case .d30: "kassenbuch.period.d30"
        case .month: "kassenbuch.period.month"
        case .year: "kassenbuch.period.year"
        }
    }
}

/// Kategorie-Filter: alle · ohne Kategorie · eine bestimmte Kategorie-ID.
enum CashbookCategoryFilter: Hashable {
    case all
    case none
    case category(String)
}

/// Eine Buchungszeile mit ihrem laufenden Saldo und GoBD-Markierungen.
struct CashbookRow: Identifiable, Equatable {
    let entry: LedgerEntry
    /// Echter Kontostand NACH dieser Buchung (über das gesamte Kassenbuch).
    let balanceCents: Int
    /// Diese Buchung wurde bereits durch ein Storno aufgehoben.
    let reversed: Bool
    /// Diese Zeile IST die Storno-Gegenbuchung.
    let isReversal: Bool

    var id: String { entry.id }
}

/// Summen über eine (gefilterte) Zeilenmenge.
struct CashbookSums: Equatable {
    var incomeCents: Int = 0
    var expenseCents: Int = 0
    var netCents: Int { incomeCents + expenseCents }
    var count: Int = 0
}

/// Reine Ableitungen über den geladenen Kassenbuch-Arrays (keine I/O).
enum CashbookDerive {

    /// Betrag einer Buchung — `nil` (Contract) zählt als 0 Cent.
    static func amountCents(_ entry: LedgerEntry) -> Int {
        entry.amountCents ?? 0
    }

    /// Kassenstand = Summe aller Buchungen (inkl. Storno-Gegenbuchungen).
    static func totalBalanceCents(_ ledger: [LedgerEntry]) -> Int {
        ledger.reduce(0) { $0 + amountCents($1) }
    }

    /// Alle Buchungen mit laufendem Saldo — neueste zuerst (wie ein
    /// Kontoauszug). Saldo läuft chronologisch auf; Storno-Ziele werden
    /// markiert. Sortierschlüssel: (`entryOn`, `id`) — stabil und deterministisch.
    static func buildRows(_ ledger: [LedgerEntry]) -> [CashbookRow] {
        let reversedIds = Set(ledger.compactMap { $0.reversesEntryId })
        let ascending = ledger.sorted { ($0.entryOn, $0.id) < ($1.entryOn, $1.id) }
        var running = 0
        var rows: [CashbookRow] = []
        rows.reserveCapacity(ascending.count)
        for entry in ascending {
            running += amountCents(entry)
            rows.append(CashbookRow(
                entry: entry,
                balanceCents: running,
                reversed: reversedIds.contains(entry.id),
                isReversal: entry.reversesEntryId != nil
            ))
        }
        return rows.reversed()
    }

    /// Frühestes eingeschlossenes Datum (ISO `yyyy-MM-dd`) des Zeitraums —
    /// `nil` = ohne Grenze. Rechnet im aktuellen Kalender (lokale Zeitzone).
    static func periodStartISO(_ period: CashbookPeriod, now: Date = Date()) -> String? {
        let calendar = Calendar.current
        switch period {
        case .all:
            return nil
        case .month:
            let comps = calendar.dateComponents([.year, .month], from: now)
            return isoDate(calendar.date(from: comps) ?? now)
        case .year:
            let comps = calendar.dateComponents([.year], from: now)
            return isoDate(calendar.date(from: comps) ?? now)
        case .d30:
            // Die letzten 30 Kalendertage inklusive heute.
            let start = calendar.date(byAdding: .day, value: -29, to: calendar.startOfDay(for: now))
            return isoDate(start ?? now)
        }
    }

    /// Zeilen nach Kategorie + Zeitraum filtern (Saldo bleibt der echte Stand).
    static func filterRows(
        _ rows: [CashbookRow],
        category: CashbookCategoryFilter,
        period: CashbookPeriod,
        now: Date = Date()
    ) -> [CashbookRow] {
        let start = periodStartISO(period, now: now)
        return rows.filter { row in
            switch category {
            case .all:
                break
            case .none:
                if row.entry.categoryId != nil { return false }
            case .category(let id):
                if row.entry.categoryId != id { return false }
            }
            if let start, row.entry.entryOn < start { return false }
            return true
        }
    }

    /// Einnahmen (≥ 0), Ausgaben (< 0, negative Summe) und Anzahl der Zeilen.
    static func sumRows(_ rows: [CashbookRow]) -> CashbookSums {
        var sums = CashbookSums()
        for row in rows {
            let cents = amountCents(row.entry)
            if cents >= 0 { sums.incomeCents += cents } else { sums.expenseCents += cents }
        }
        sums.count = rows.count
        return sums
    }

    // MARK: - ISO-Datum (date-only, lokaler Kalender)

    private static let isoDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    /// `Date` → `yyyy-MM-dd` (für Vergleich und für `LedgerEntryCreate.entryOn`).
    static func isoDate(_ date: Date) -> String {
        isoDateFormatter.string(from: date)
    }
}

/// Parsing der Betrags-Eingabe im Buchungs-Sheet.
enum CashbookInput {

    /// Euro-Eingabe („49,00“ / „49.00“) → Cents; `nil` bei ungültig/≤ 0.
    static func parseAmountCents(_ raw: String) -> Int? {
        let cleaned = raw
            .trimmingCharacters(in: .whitespaces)
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: ",", with: ".")
        guard let value = Double(cleaned), value.isFinite, value > 0 else { return nil }
        return Int((value * 100).rounded())
    }
}
