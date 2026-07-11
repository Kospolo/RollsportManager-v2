import Foundation

// ============================================================================
// Mahnwesen — abgeleitete, PURE Ansichten des Screens (Seriositätszone).
// Web-Referenz: apps/web/app/(portal)/finanzen/mahnungen/derive.ts.
//
// KONSISTENZ-REGEL (wie im Web): KPI-Kacheln, Ampel-Gruppen UND der Mahnlauf
// rechnen über DENSELBEN `DunningItem[]`, damit die Summen quer über den
// Screen aufgehen. Alle Funktionen sind pur und arbeiten auf den geladenen
// Contracts-Arrays (invoices/members) — dadurch identisch testbar.
//
// GoBD: nichts wird hier verändert; das Mahnprotokoll bleibt append-only, die
// Eskalation ab Stufe 2 erfordert die ausdrückliche Freigabe (siehe RunSheet).
// ============================================================================

/// Ein offener Posten mit abgeleiteter Mahn-Information (Ampel-Zeile).
struct DunningItem: Identifiable, Equatable {
    let invoice: Invoice
    /// Anzeigename des Mitglieds (nil, wenn /members für die Rolle tabu ist).
    let memberName: String?
    /// Beitrittsjahr des Mitglieds ("2021") — dezente Zweitzeile.
    let memberJoinYear: String?
    /// Tage überfällig (positiv) bzw. ≤ 0 = noch nicht fällig.
    let overdueDays: Int

    var id: String { invoice.id }

    /// Rohe Mahnstufe der Rechnung (kann > 3 sein).
    var level: Int { invoice.dunningLevel }

    /// In die Ampel-Treppe 0–3 geklemmte Stufe (Stufe > 3 fällt in „Übergabe").
    var displayLevel: Int { min(3, max(0, invoice.dunningLevel)) }

    /// ≥ 1 Tag über der Fälligkeit.
    var overdue: Bool { overdueDays >= 1 }

    /// Zielstufe des nächsten Laufs (nur informativ; die verbindliche
    /// Zielstufe liefert der Server-Trockenlauf, s. DunningRunSheet).
    var nextStage: Int { invoice.dunningLevel + 1 }
}

/// Anzahl + Summe je Mahnstufe (0–3) — die vier Ampel-Gruppen.
struct DunningStageBucket: Identifiable, Equatable {
    let level: Int
    let items: [DunningItem]
    let sumCents: Int
    var id: Int { level }
}

enum DunningDerive {

    /// Offene Rechnungen → DunningItem[], höchste Stufe & älteste zuerst.
    static func buildItems(
        invoices: [Invoice],
        memberName: (String) -> String?,
        memberJoinYear: (String) -> String?,
        asOf: Date
    ) -> [DunningItem] {
        invoices
            .filter { $0.status == .open }
            .map { invoice in
                DunningItem(
                    invoice: invoice,
                    memberName: memberName(invoice.memberId),
                    memberJoinYear: memberJoinYear(invoice.memberId),
                    overdueDays: DunningFormat.overdueDays(dueOn: invoice.dueOn, asOf: asOf)
                )
            }
            .sorted { lhs, rhs in
                if lhs.level != rhs.level { return lhs.level > rhs.level }
                return lhs.overdueDays > rhs.overdueDays
            }
    }

    /// Summe der Beträge (Cents) einer Posten-Auswahl.
    static func sumCents(_ items: [DunningItem]) -> Int {
        items.reduce(0) { $0 + ($1.invoice.amountCents ?? 0) }
    }

    /// Vier Ampel-Gruppen (0–3) — leere Stufen bleiben sichtbar (Treppe).
    static func groupByStage(_ items: [DunningItem]) -> [DunningStageBucket] {
        (0...3).map { level in
            let bucket = items.filter { $0.displayLevel == level }
            return DunningStageBucket(level: level, items: bucket, sumCents: sumCents(bucket))
        }
    }
}

/// Formatierung/Datumslogik nur fürs Mahnwesen — Beträge macht `FinanceFormat`
/// (geteilt), das Datum mit Uhrzeit fürs Protokoll und die Überfälligkeits-
/// Tage rechnen wir hier, ohne die geteilte Formatierung zu erweitern.
enum DunningFormat {

    private static let utcCalendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC") ?? .current
        return calendar
    }()

    private static let dateOnlyParser: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let isoParser: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let isoParserNoFraction = ISO8601DateFormatter()

    private static let dateTimeDisplay: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()

    private static let dateDisplay: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    /// Tage über der Fälligkeit (positiv = überfällig). Kein/kaputtes Datum ⇒ 0.
    static func overdueDays(dueOn: String?, asOf: Date) -> Int {
        guard let dueOn, !dueOn.isEmpty,
              let due = dateOnlyParser.date(from: dueOn)
        else { return 0 }
        let dueStart = utcCalendar.startOfDay(for: due)
        let nowStart = utcCalendar.startOfDay(for: asOf)
        return utcCalendar.dateComponents([.day], from: dueStart, to: nowStart).day ?? 0
    }

    /// Leitungs-Zeitstempel (date-time) → lokalisiertes Datum + Uhrzeit.
    static func dateTime(_ raw: String) -> String {
        let parsed = isoParser.date(from: raw)
            ?? isoParserNoFraction.date(from: raw)
            ?? dateOnlyParser.date(from: raw)
        guard let parsed else { return raw }
        return dateTimeDisplay.string(from: parsed)
    }

    /// „Heute" als lokalisiertes Datum (für die Kopf-Zeile „Stand …").
    static func today(_ date: Date) -> String {
        dateDisplay.string(from: date)
    }
}
