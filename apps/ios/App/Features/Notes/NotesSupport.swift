import Foundation

// ============================================================================
// Kleiner, feature-eigener Namensraum für Datums-/Zeit-Aufbereitung der
// privaten Notizen — bewusst kollisionsfrei zu anderen Teams (kein Zugriff
// auf deren private Helfer). Die Contracts liefern `created_at`/`updated_at`
// als ISO-8601-String auf der Leitung (siehe RSMContracts.swift), deshalb hier
// selbst geparst und in eine menschliche „vor X“-Angabe übersetzt.
// ============================================================================

enum NotesFormat {

    private static let isoFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let isoPlain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    /// Relativer Formatter folgt automatisch der aktiven Sprache (DE/EN) —
    /// „vor 3 Tagen“ / „3 days ago“.
    private static let relative: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter
    }()

    static func date(from string: String) -> Date? {
        isoFractional.date(from: string) ?? isoPlain.date(from: string)
    }

    /// Menschliche „vor X“-Angabe des Aktualisierungszeitpunkts. Fällt bei
    /// unlesbarem Timestamp auf den Rohwert zurück, damit nie ein leeres Feld
    /// entsteht.
    static func relativeUpdated(_ iso: String) -> String {
        guard let date = date(from: iso) else { return iso }
        return relative.localizedString(for: date, relativeTo: Date())
    }
}
