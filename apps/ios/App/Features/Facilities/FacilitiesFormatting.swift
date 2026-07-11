import Foundation
import SwiftUI

// Reine, zustandslose Helfer des Belegungsplan-Features (eigener Namensraum
// `Belegung…`, kollisionsfrei zu anderen Feature-Teams). Web-Referenz:
// apps/web/app/(portal)/belegungsplan/{helpers.ts,i18n.ts}.

// MARK: - ISO-8601 (Contracts lassen Timestamps als String auf der Leitung)

/// Parsen/Serialisieren der Buchungs-Zeitstempel. `createBooking` erwartet volle
/// ISO-8601-date-time (wie `createEvent`) — deshalb dieselbe Formatter-Kette.
enum BelegungISO {
    private static let withFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let plain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static func date(from string: String) -> Date? {
        withFractionalSeconds.date(from: string) ?? plain.date(from: string)
    }

    static func string(from date: Date) -> String {
        plain.string(from: date)
    }
}

// MARK: - Anzeige-Mapping (Enum-Labels + Chip-Töne)

enum BelegungDisplay {

    /// Anzeige-Reihenfolge der Hallen-Arten (Web-Referenz `KIND_ORDER`).
    static let kindOrder: [FacilityKind] = [.hall, .room, .outdoor, .other]

    /// FacilityKind → String-Catalog-Key des Labels.
    static func kindLabelKey(_ kind: FacilityKind) -> LocalizedStringKey {
        switch kind {
        case .hall: "belegungsplan.kind.hall"
        case .room: "belegungsplan.kind.room"
        case .outdoor: "belegungsplan.kind.outdoor"
        case .other: "belegungsplan.kind.other"
        }
    }

    /// BookingStatus → String-Catalog-Key des Labels.
    static func statusLabelKey(_ status: BookingStatus) -> LocalizedStringKey {
        switch status {
        case .confirmed: "belegungsplan.status.confirmed"
        case .pending: "belegungsplan.status.pending"
        case .cancelled: "belegungsplan.status.cancelled"
        }
    }

    /// BookingStatus → Chip-Ton (Bestätigt=grün, Angefragt=gelb, Storniert=neutral).
    static func statusTone(_ status: BookingStatus) -> RSMStatusKind {
        switch status {
        case .confirmed: .success
        case .pending: .warn
        case .cancelled: .neutral
        }
    }

    // MARK: Zeiten/Datum

    /// Uhrzeit lokalisiert („17:00“ / „5:00 PM“). Leerer String bei Parsefehler.
    static func time(_ iso: String) -> String {
        guard let date = BelegungISO.date(from: iso) else { return "" }
        return date.formatted(date: .omitted, time: .shortened)
    }

    /// Zeitspanne einer Buchung („17:00 – 18:30“), Halbgeviertstrich.
    static func timeRange(_ startsAt: String, _ endsAt: String) -> String {
        "\(time(startsAt)) – \(time(endsAt))"
    }

    /// Absolutes Datum, lokalisiert („9. Juli 2026“ / „Jul 9, 2026“).
    static func absoluteDate(_ iso: String) -> String {
        guard let date = BelegungISO.date(from: iso) else { return "" }
        return date.formatted(date: .abbreviated, time: .omitted)
    }

    /// Relative Angabe, lokalisiert („in 3 Tagen“ / „in 3 days“).
    static func relativeDate(_ iso: String) -> String {
        guard let date = BelegungISO.date(from: iso) else { return "" }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    /// Aufgelöster Name (Vor- + Nachname) oder `nil`, wenn das Mitglied nicht
    /// (mehr) lesbar ist — Aufrufer zeigt dann „Unbekannt“.
    static func memberName(_ member: ClubMember?) -> String? {
        guard let member else { return nil }
        let name = "\(member.firstName) \(member.lastName)"
            .trimmingCharacters(in: .whitespaces)
        return name.isEmpty ? nil : name
    }
}

// MARK: - Ableitungen (Überschneidungen, kommende Buchungen, Tages-Gruppen)

enum BelegungLogic {

    /// Zwei ISO-Zeiträume [aStart,aEnd) und [bStart,bEnd) überschneiden sich,
    /// wenn aStart < bEnd und bStart < aEnd. Alle Zeitstempel sind UTC-ISO —
    /// der lexikografische Vergleich entspricht dem chronologischen.
    static func overlaps(_ aStart: String, _ aEnd: String, _ bStart: String, _ bEnd: String) -> Bool {
        aStart < bEnd && bStart < aEnd
    }

    /// Bestehende Buchungen derselben Halle, die den vorgeschlagenen Slot
    /// überschneiden — stornierte und (im Edit-Fall) die eigene Buchung
    /// ausgenommen. Überschneidungen sind NICHT DB-erzwungen, die App weist sie
    /// deshalb selbst als Hinweis aus.
    static func conflictingBookings(
        _ bookings: [FacilityBooking],
        facilityId: String,
        startsAt: String,
        endsAt: String,
        excludeId: String? = nil
    ) -> [FacilityBooking] {
        bookings.filter { booking in
            booking.facilityId == facilityId
                && booking.status != .cancelled
                && booking.id != excludeId
                && overlaps(startsAt, endsAt, booking.startsAt, booking.endsAt)
        }
    }

    /// Überschneidet diese Buchung eine andere aktive Buchung derselben Halle?
    static func hasConflict(_ booking: FacilityBooking, in all: [FacilityBooking]) -> Bool {
        guard booking.status != .cancelled else { return false }
        return !conflictingBookings(
            all,
            facilityId: booking.facilityId,
            startsAt: booking.startsAt,
            endsAt: booking.endsAt,
            excludeId: booking.id
        ).isEmpty
    }

    /// Kommende/laufende Buchungen (endsAt >= jetzt), chronologisch aufsteigend.
    static func upcomingBookings(_ bookings: [FacilityBooking], now: Date = Date()) -> [FacilityBooking] {
        bookings
            .filter { (BelegungISO.date(from: $0.endsAt) ?? .distantPast) >= now }
            .sorted { $0.startsAt < $1.startsAt }
    }

    /// Eine nach Kalendertag (lokale Zeit) gruppierte Buchungsliste.
    struct DayGroup: Identifiable {
        let id: String
        let iso: String
        let bookings: [FacilityBooking]
    }

    /// Buchungen nach Kalendertag (lokale Zeit) gruppieren, aufsteigend sortiert.
    static func groupByDay(_ list: [FacilityBooking]) -> [DayGroup] {
        let calendar = Calendar.current
        let sorted = list.sorted { $0.startsAt < $1.startsAt }
        var order: [String] = []
        var buckets: [String: [FacilityBooking]] = [:]
        var firstIso: [String: String] = [:]

        for booking in sorted {
            let date = BelegungISO.date(from: booking.startsAt) ?? Date()
            let day = calendar.startOfDay(for: date)
            let key = ISO8601DateFormatter.dayKey(from: day)
            if buckets[key] == nil {
                buckets[key] = []
                order.append(key)
                firstIso[key] = booking.startsAt
            }
            buckets[key]?.append(booking)
        }

        return order.map { key in
            DayGroup(id: key, iso: firstIso[key] ?? "", bookings: buckets[key] ?? [])
        }
    }
}

private extension ISO8601DateFormatter {
    /// Stabiler „yyyy-MM-dd“-Schlüssel eines Kalendertags (lokal).
    static func dayKey(from date: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
}
