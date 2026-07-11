import SwiftUI

/// Darstellungs- und Formatierungs-Helfer der Jubiläen (Geburtstage & Vereins-
/// jubiläen). Reine Funktionen, kein Netzwerk — die Views reichen die Schlüssel
/// an den String-Catalog. Bewusst lokal im Feature-Ordner gehalten, damit der
/// Shared-Code (Theme/Contracts) unangetastet bleibt. Web-Referenz:
/// `(portal)/jubilaeen/_components/parts.ts`.
enum JubilaeenFormat {

    // MARK: - Art (festliche Farbwelt)

    /// Festliche Optik je Art: Geburtstag = Beere/Torte, Vereinsjubiläum =
    /// Honig/Rosette. Glyph im runden Tint-Kreis, dazu der Ton der Art-Pille.
    struct KindStyle {
        let symbol: String          // SF Symbol im runden Glyph
        let pill: RSMStatusKind     // Ton der Art-Pille
        let glyphBackground: Color  // Tint-Kreis hinter dem Glyph
        let glyphForeground: Color  // Glyph-Farbe
    }

    static func style(for kind: AnniversaryKind) -> KindStyle {
        switch kind {
        case .birthday:
            KindStyle(
                symbol: "birthday.cake.fill", pill: .brand,
                glyphBackground: Theme.Colors.brandSoft, glyphForeground: Theme.Colors.brandInk
            )
        case .membership:
            KindStyle(
                symbol: "rosette", pill: .warn,
                glyphBackground: Theme.Colors.warnSoft, glyphForeground: Theme.Colors.warn
            )
        }
    }

    /// Art-Label (Text der Pille).
    static func kindLabel(_ kind: AnniversaryKind) -> LocalizedStringKey {
        switch kind {
        case .birthday: "jubilaeen.kind.birthday"
        case .membership: "jubilaeen.kind.membership"
        }
    }

    /// Meilenstein („5 Jahre Mitglied“ / „wird 50“) — mit Jahres-Argument.
    /// Der Catalog-Schlüssel trägt das `%lld`, die Interpolation liefert den Wert.
    static func milestone(_ kind: AnniversaryKind, years: Int) -> LocalizedStringKey {
        switch kind {
        case .birthday: "jubilaeen.milestone.birthday \(years)"
        case .membership: "jubilaeen.milestone.membership \(years)"
        }
    }

    // MARK: - Countdown

    /// Countdown-Pille: Text + Dringlichkeits-Ton. „heute“/„morgen“ feiern
    /// (brand), die nächste Woche warm (warn), danach dezent (neutral).
    struct Countdown {
        let label: LocalizedStringKey
        let kind: RSMStatusKind
    }

    static func countdown(daysUntil: Int) -> Countdown {
        if daysUntil <= 0 { return Countdown(label: "jubilaeen.count.today", kind: .brand) }
        if daysUntil == 1 { return Countdown(label: "jubilaeen.count.tomorrow", kind: .brand) }
        return Countdown(
            label: "jubilaeen.count.days \(daysUntil)",
            kind: daysUntil <= 7 ? .warn : .neutral
        )
    }

    // MARK: - Datum (ISO YYYY-MM-DD, timezone-fest an lokaler Mitternacht)

    /// ISO-Tagesdatum → lokale Mitternacht. Fester POSIX-Parser, damit die
    /// reine `YYYY-MM-DD`-Zeichenkette ohne Tages-Versatz gelesen wird.
    private static let isoDay: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    static func localDate(_ iso: String) -> Date? {
        isoDay.date(from: String(iso.prefix(10)))
    }

    /// „Mi., 15. Juli“ (de) / „Wed, 15 July“ (en) — Wochentag kurz + Tag + Monat.
    private static let dayLong: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = .autoupdatingCurrent
        formatter.setLocalizedDateFormatFromTemplate("EEEdMMMM")
        return formatter
    }()

    /// „Juli 2026“ (de) / „July 2026“ (en) — Überschrift einer Monatsgruppe.
    private static let monthLong: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = .autoupdatingCurrent
        formatter.setLocalizedDateFormatFromTemplate("MMMMyyyy")
        return formatter
    }()

    /// Fällt bei unparsbarem Wert auf den Rohstring zurück (nie leer).
    static func dayText(_ iso: String) -> String {
        guard let date = localDate(iso) else { return iso }
        return dayLong.string(from: date)
    }

    /// Gruppierungs-Schlüssel „2026-07“ direkt aus der ISO-Zeichenkette.
    static func monthKey(_ iso: String) -> String { String(iso.prefix(7)) }

    static func monthLabel(_ iso: String) -> String {
        guard let date = localDate(iso) else { return monthKey(iso) }
        return monthLong.string(from: date)
    }

    // MARK: - Monats-Gruppierung (Reihenfolge der sortierten Liste bleibt)

    /// Ein Monatsblock der Liste — die Eingabe ist bereits server-sortiert nach
    /// Nähe, die Reihenfolge bleibt also chronologisch.
    struct MonthGroup: Identifiable {
        let id: String        // monthKey, z. B. „2026-07“
        let title: String     // „Juli 2026“
        let items: [Anniversary]
    }

    static func groupByMonth(_ items: [Anniversary]) -> [MonthGroup] {
        var order: [String] = []
        var buckets: [String: [Anniversary]] = [:]
        for item in items {
            let key = monthKey(item.date)
            if buckets[key] == nil {
                order.append(key)
                buckets[key] = []
            }
            buckets[key]?.append(item)
        }
        return order.map { key in
            let bucket = buckets[key] ?? []
            return MonthGroup(id: key, title: monthLabel(bucket.first?.date ?? key), items: bucket)
        }
    }
}

extension Anniversary {
    /// Stabiler Listen-Schlüssel: eine Person kann Geburtstag UND Vereins-
    /// jubiläum im selben Fenster haben (`Anniversary` ist nur `Equatable`,
    /// nicht `Hashable`, daher kein `id: \.self`). Spiegelt die Web-Referenz
    /// (`memberId-kind-date`).
    var rowKey: String { "\(memberId)-\(kind.rawValue)-\(date)" }
}
