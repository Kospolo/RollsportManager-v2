import Foundation

/// Fachlogik + Anzeige-Formatierung des Check-in-Moduls — reine Funktionen ohne
/// SwiftUI, damit sie schlank und testbar bleiben (Web-Referenz: checkin/logic.ts,
/// checkin/_components/EventSelect.tsx). Rechte sind SERVERSEITIG (RLS +
/// Rollencheck): eigenen Check-in legt jedes Mitglied an, andere einchecken +
/// Vereins-Historie darf nur der Trainerstab (403 → Klartext-Hinweis). Hier
/// werden ausschließlich Anzeigezustände berechnet.
enum CheckinLogic {

    // MARK: - ISO-8601 Parsing

    /// Server-Timestamps kommen als ISO-8601-Strings (mit oder ohne
    /// Sekundenbruchteile). Beide Varianten robust parsen; `nil` bei
    /// unlesbarem Wert.
    static func date(from iso: String) -> Date? {
        if let withFraction = isoWithFraction.date(from: iso) { return withFraction }
        return isoPlain.date(from: iso)
    }

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

    // MARK: - Termin-Auswahl (Web: selectableEvents / defaultEventId)

    /// Beginnt der ISO-Zeitstempel am selben Kalendertag wie `now`?
    static func isSameDay(_ iso: String, as now: Date, calendar: Calendar = .current) -> Bool {
        guard let day = date(from: iso) else { return false }
        return calendar.isDate(day, inSameDayAs: now)
    }

    /// Termine, in die man sich einchecken kann: ab heute 00:00 bis
    /// `horizonDays` in der Zukunft, frühester zuerst (heutige Termine ganz vorne).
    static func selectableEvents(
        _ events: [Event],
        now: Date,
        horizonDays: Int = 14,
        calendar: Calendar = .current
    ) -> [Event] {
        let start = calendar.startOfDay(for: now)
        guard let horizon = calendar.date(byAdding: .day, value: horizonDays, to: start) else { return [] }
        return events
            .compactMap { event -> (event: Event, at: Date)? in
                guard let at = date(from: event.startsAt) else { return nil }
                return (start...horizon).contains(at) ? (event, at) : nil
            }
            .sorted { $0.at < $1.at }
            .map(\.event)
    }

    /// Vorbelegter Termin: der erste heutige, sonst keiner ("" = ohne Termin).
    static func defaultEventId(_ events: [Event], now: Date) -> String {
        selectableEvents(events, now: now)
            .first { isSameDay($0.startsAt, as: now) }?
            .id ?? ""
    }

    /// Hat das Mitglied heute bereits (irgend)einen Check-in?
    static func hasCheckinToday(_ checkins: [Checkin], now: Date) -> Bool {
        checkins.contains { isSameDay($0.checkedInAt, as: now) }
    }

    // MARK: - Vereins-Statistik (Web: checkinStats)

    struct Stats: Equatable {
        var total: Int
        var thisWeek: Int
        var thisMonth: Int
    }

    /// Kennzahlen der Vereins-Check-ins: gesamt, diese Woche (ab Montag),
    /// diesen Monat.
    static func stats(_ checkins: [Checkin], now: Date) -> Stats {
        let calendar = mondayCalendar
        let weekStart = calendar.dateInterval(of: .weekOfYear, for: now)?.start ?? now
        let monthStart = calendar.dateInterval(of: .month, for: now)?.start ?? now
        var thisWeek = 0
        var thisMonth = 0
        for checkin in checkins {
            guard let at = date(from: checkin.checkedInAt) else { continue }
            if at >= weekStart { thisWeek += 1 }
            if at >= monthStart { thisMonth += 1 }
        }
        return Stats(total: checkins.count, thisWeek: thisWeek, thisMonth: thisMonth)
    }

    /// Kalender mit Wochenbeginn Montag (Web: startOfWeek, Montag = 0).
    private static let mondayCalendar: Calendar = {
        var calendar = Calendar.current
        calendar.firstWeekday = 2 // Montag
        return calendar
    }()

    // MARK: - Sortierung (neueste zuerst)

    /// Check-ins absteigend nach Zeitpunkt (ISO-8601 gleicher Form sortiert
    /// lexikografisch korrekt).
    static func sortedDescending(_ checkins: [Checkin]) -> [Checkin] {
        checkins.sorted { $0.checkedInAt > $1.checkedInAt }
    }

    // MARK: - Anzeige-Formatierung (locale-aware, wie Web format.ts)

    /// Datum + Uhrzeit in der Nutzersprache (DE/EN).
    static func dateTime(_ iso: String) -> String {
        guard let day = date(from: iso) else { return iso }
        return day.formatted(date: .abbreviated, time: .shortened)
    }

    /// Nur Uhrzeit (für heutige Termine in der Auswahl).
    static func time(_ iso: String) -> String {
        guard let day = date(from: iso) else { return iso }
        return day.formatted(date: .omitted, time: .shortened)
    }

    /// Kurzes Datum (für kommende Termine in der Auswahl).
    static func dateShort(_ iso: String) -> String {
        guard let day = date(from: iso) else { return iso }
        return day.formatted(date: .abbreviated, time: .omitted)
    }
}
