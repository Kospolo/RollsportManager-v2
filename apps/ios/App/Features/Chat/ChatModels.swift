import Foundation

// ============================================================================
// Reine Helfer des Chat-Features (keine Datenzugriffe, keine i18n).
//
// Contract-Typen (ChatChannel/ChatMessage/…) bleiben READ-ONLY — hier stehen
// nur kleine Erweiterungen (berechnete Eigenschaften, KEINE Protokoll-
// Konformanzen) und die Datums-Formatierung. Web-Referenz-Logik:
// apps/web/app/(portal)/chat/helpers.ts.
// ============================================================================

extension ChatChannel {

    /// Stabiler Schlüssel eines Kanals — Kanäle haben KEINE eigene id:
    /// Team-Kanäle identifiziert `teamId`, Direkt-Kanäle `peerMemberId`
    /// (siehe ChatChannel-Read-Model). Dient als `ForEach`-Identität und
    /// zum Auswahl-Vergleich.
    var rsmKey: String {
        channelType == .team
            ? "team:\(teamId ?? "")"
            : "direct:\(peerMemberId ?? "")"
    }

    /// Anzeigename (Team-Name bzw. Peer-Name); leer, wenn der Server nichts
    /// liefert — die View setzt dann den Typ-Fallback ein.
    var rsmDisplayName: String {
        (channelType == .team ? teamName : peerName) ?? ""
    }
}

/// Datums-/Zeit-Formatierung für den Chat. Alle Timestamps kommen als
/// ISO-8601-Strings über die Leitung (z. B. `2026-07-08T19:05:00.000Z`,
/// teils ohne Millisekunden) — die Contracts lassen sie bewusst als String.
enum ChatFormat {

    private static let isoWithFraction: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let isoPlain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    /// Robustes Parsen: erst mit Millisekunden, dann ohne.
    static func date(from iso: String) -> Date? {
        isoWithFraction.date(from: iso) ?? isoPlain.date(from: iso)
    }

    /// Aktueller Zeitpunkt als ISO-8601-String (für optimistische Blasen, bis
    /// der Server den echten `created_at` zurückliefert).
    static func nowISO() -> String {
        isoWithFraction.string(from: Date())
    }

    /// Uhrzeit in der Sprache des Geräts (z. B. „19:05"). Fällt bei
    /// unparsbarem Input auf den Rohwert zurück, statt leer zu bleiben.
    static func time(_ iso: String) -> String {
        guard let date = date(from: iso) else { return iso }
        return date.formatted(date: .omitted, time: .shortened)
    }

    /// Kompakter Zeitstempel für die Kanalliste: heute → Uhrzeit,
    /// sonst kurzes Datum (z. B. „08.07.2026").
    static func listTimestamp(_ iso: String) -> String {
        guard let date = date(from: iso) else { return "" }
        if Calendar.current.isDateInToday(date) {
            return date.formatted(date: .omitted, time: .shortened)
        }
        return date.formatted(date: .numeric, time: .omitted)
    }
}
