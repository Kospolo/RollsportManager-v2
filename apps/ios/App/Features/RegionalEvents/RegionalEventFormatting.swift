import Foundation

/// Reine Ableitungen/Formatierungen des Events-Features (eigener Namensraum,
/// kollisionsfrei zu den anderen parallelen Feature-Teams).
///
/// Wire-Format von `startsOn`/`endsOn` sind ISO-Kalendertage (YYYY-MM-DD).
/// Sie werden bewusst als lokaler Kalendertag geparst (nicht über einen
/// UTC-annehmenden ISO-Parser), damit die Vergangen-Erkennung und die Anzeige
/// zeitzonenfest sind — 1:1 wie die Web-Referenz (events/helpers.ts).
enum RegionalEventDate {

    /// Halbgeviertstrich für die mehrtägige Zeitspanne (echtes „–“).
    private static let enDash = "–"

    /// Parser für den reinen Kalendertag (YYYY-MM-DD → lokale Mitternacht).
    private static let isoDay: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    /// Anzeige-Formatter: lokalisiert lang („15. Juli 2026“ / „15 July 2026“).
    private static let display: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = .current
        formatter.timeZone = .current
        formatter.dateStyle = .long
        formatter.timeStyle = .none
        return formatter
    }()

    /// YYYY-MM-DD → lokales `Date` (ohne Zeitzonen-Verschiebung).
    static func date(from iso: String) -> Date? {
        isoDay.date(from: iso)
    }

    /// Heutiger Kalendertag als YYYY-MM-DD (lokale Zeit) — Basis der
    /// Vergangen-Grenze, gleiche Form wie `startsOn`/`endsOn` (lex. vergleichbar).
    static func todayIso(now: Date = Date()) -> String {
        isoDay.string(from: now)
    }

    /// Vergangen = der letzte Tag des Events (`endsOn`, sonst `startsOn`) liegt
    /// VOR heute. Ein heute noch laufendes Event gilt als kommend.
    static func isPast(_ event: RegionalEvent, today: String = RegionalEventDate.todayIso()) -> Bool {
        (event.endsOn ?? event.startsOn) < today
    }

    /// Ein einzelnes Datum lokalisiert; fällt bei unparsbarem Wert auf den
    /// Rohstring zurück (nie leer, nie Absturz).
    static func absolute(_ iso: String) -> String {
        guard let parsed = date(from: iso) else { return iso }
        return display.string(from: parsed)
    }

    /// Datum bzw. Zeitspanne: „15. Juli 2026“ (eintägig) oder
    /// „15. Juli 2026 – 16. Juli 2026“ (mehrtägig, echter Halbgeviertstrich).
    static func span(startsOn: String, endsOn: String?) -> String {
        let start = absolute(startsOn)
        guard let endsOn, endsOn != startsOn else { return start }
        return "\(start) \(enDash) \(absolute(endsOn))"
    }
}

/// Freitext-URL absichern: nur echte http(s)-Links werden verlinkt (schützt vor
/// javascript:/data:-URLs aus Freitext). Sonst `nil` — 1:1 wie die Web-Referenz
/// (`safeExternalUrl`).
enum RegionalEventLink {
    static func safeExternalURL(_ raw: String?) -> URL? {
        guard let raw else { return nil }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        let lower = trimmed.lowercased()
        guard lower.hasPrefix("http://") || lower.hasPrefix("https://") else { return nil }
        return URL(string: trimmed)
    }
}
