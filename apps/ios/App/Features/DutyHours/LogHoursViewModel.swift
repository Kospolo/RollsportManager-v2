import Foundation
import SwiftUI

/// Formular-State für „Stunden erfassen“. Der Eintrag läuft FEST auf das eigene
/// Mitglied (`memberId`). `approved` wird NIE gesetzt — das dürfen serverseitig
/// nur Trainer:innen (DB-Trigger `duty_entries_guard_approved` → 42501/403).
/// Erfolg: erzeugter `DutyEntry` fließt via `onCreated` zurück; 403 bleibt als
/// Alert im Sheet. Web-Referenz: LogHoursSheet.tsx.
@MainActor
final class LogHoursViewModel: ObservableObject {

    // MARK: - Eingaben

    @Published var date = Date()
    @Published var hoursText = ""
    @Published var kind: DutyKind = .training
    @Published var note = ""

    // MARK: - Zustand

    @Published var hoursError: LocalizedStringKey?
    @Published private(set) var isSaving = false
    /// Fehler beim Absenden (403 „Keine Berechtigung“ oder Transportfehler).
    @Published var submitError: String?

    /// Obergrenze des Datumsfelds — kein Erfassen in der Zukunft.
    let maxDate = Date()

    private let api: APIClient
    private let clubId: String
    private let memberId: String
    private let onCreated: (DutyEntry) -> Void

    init(
        api: APIClient,
        clubId: String,
        memberId: String,
        onCreated: @escaping (DutyEntry) -> Void
    ) {
        self.api = api
        self.clubId = clubId
        self.memberId = memberId
        self.onCreated = onCreated
    }

    /// Validiert und postet. `true` = Erfolg (View schließt das Sheet);
    /// `false` = Validierungs-/403-Fehler (Sheet bleibt offen).
    func submit() async -> Bool {
        guard !isSaving else { return false }

        guard let hours = Self.parseHours(hoursText), hours > 0 else {
            hoursError = "pflichtstunden.field.hours.error"
            return false
        }

        let trimmedNote = note.trimmingCharacters(in: .whitespacesAndNewlines)
        let create = DutyEntryCreate(
            clubId: clubId,
            memberId: memberId,
            hours: hours,
            activityDate: Self.isoDate(from: min(date, maxDate)),
            kind: kind,
            note: trimmedNote.isEmpty ? nil : trimmedNote,
            // Bewusst `nil` → Feld wird NICHT gesendet; Mitglied darf `approved`
            // nicht setzen (nur Trainerstab), der Server defaultet auf false.
            approved: nil
        )

        isSaving = true
        defer { isSaving = false }
        do {
            let created = try await api.createDutyEntry(create)
            onCreated(created)
            return true
        } catch {
            submitError = error.isForbiddenAPIError
                ? NSLocalizedString("pflichtstunden.forbidden", comment: "403 beim Erfassen")
                : ((error as? APIError)?.errorDescription ?? error.localizedDescription)
            return false
        }
    }

    // MARK: - Helfer

    /// Stunden aus Freitext: Komma ODER Punkt als Dezimaltrenner, > 0.
    static func parseHours(_ text: String) -> Double? {
        let normalized = text
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: ",", with: ".")
        guard !normalized.isEmpty, let value = Double(normalized), value.isFinite else {
            return nil
        }
        return value
    }

    private static let isoOut: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    /// `Date` → „yyyy-MM-dd“ in LOKALER Zeit (Wert fürs `activity_date`-Feld,
    /// Format `date`). Web: `todayISODate` nutzt ebenfalls die lokale Zeit.
    static func isoDate(from date: Date) -> String {
        isoOut.string(from: date)
    }
}
