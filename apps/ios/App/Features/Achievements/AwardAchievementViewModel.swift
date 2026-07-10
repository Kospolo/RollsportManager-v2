import Foundation
import SwiftUI

/// Formular-State für „Erfolg vergeben“. Validiert im Klartext und postet einen
/// `AchievementCreate` (Trainerstab). Erfolg: erzeugter Erfolg (mit echter ID)
/// fließt via `onCreated` in die Vitrine; 403 (Rolle ohne Recht) bleibt als
/// Alert im Sheet stehen. Web-Referenz: `AchievementFormSheet.tsx` (Anlegen).
@MainActor
final class AwardAchievementViewModel: ObservableObject {

    /// Feldbezogene Validierungshinweise (Klartext unter dem jeweiligen Feld).
    struct FieldErrors: Equatable {
        var member: LocalizedStringKey?
        var title: LocalizedStringKey?
        var placement: LocalizedStringKey?

        var isEmpty: Bool { member == nil && title == nil && placement == nil }
    }

    // MARK: - Eingaben

    @Published var memberId = ""
    @Published var title = ""
    @Published var competition = ""
    @Published var placementText = ""
    /// `nil` = Teilnahme ohne Medaille (Web-Default); sonst Gold/Silber/Bronze.
    @Published var medal: Medal?
    @Published var achievedOn = Calendar.current.startOfDay(for: Date())
    @Published var note = ""

    // MARK: - Zustand

    @Published private(set) var isSaving = false
    @Published var fieldErrors = FieldErrors()
    /// Fehler beim Absenden (403 „Keine Berechtigung“ oder Transportfehler).
    @Published var submitError: String?

    /// Auswahlliste (alphabetisch, aus der Liste durchgereicht).
    let members: [ClubMember]

    private let api: APIClient
    private let clubId: String
    private let onCreated: (MedalAchievement) -> Void

    init(
        api: APIClient,
        clubId: String,
        members: [ClubMember],
        onCreated: @escaping (MedalAchievement) -> Void
    ) {
        self.api = api
        self.clubId = clubId
        self.members = members
        self.onCreated = onCreated
    }

    /// Anzeigename des gewählten Mitglieds (für das Menü-Label).
    var selectedMemberName: String? {
        members.first { $0.id == memberId }.map(MedaillenL10n.memberName)
    }

    // MARK: - Absenden

    /// Validiert und postet. Gibt bei Erfolg `true` zurück (View schließt das
    /// Sheet); bei Validierungs- oder 403-Fehlern `false` (Sheet bleibt offen).
    func submit() async -> Bool {
        guard !isSaving else { return false }

        var errors = FieldErrors()
        if memberId.isEmpty { errors.member = "medaillen.form.err.member" }
        if title.trimmed.isEmpty { errors.title = "medaillen.form.err.title" }

        let trimmedPlacement = placementText.trimmed
        var placementValue: Int?
        if !trimmedPlacement.isEmpty {
            if let parsed = Int(trimmedPlacement), parsed > 0 {
                placementValue = parsed
            } else {
                errors.placement = "medaillen.form.err.placement"
            }
        }

        fieldErrors = errors
        guard errors.isEmpty else { return false }

        let create = AchievementCreate(
            clubId: clubId,
            memberId: memberId,
            title: title.trimmed,
            competitionName: competition.trimmed.isEmpty ? nil : competition.trimmed,
            placement: placementValue,
            medal: medal,
            achievedOn: MedaillenFormat.wireString(from: achievedOn),
            note: note.trimmed.isEmpty ? nil : note.trimmed
        )

        isSaving = true
        defer { isSaving = false }
        do {
            let created = try await api.medaillenCreate(create)
            onCreated(created)
            return true
        } catch {
            submitError = error.isForbiddenAPIError
                ? NSLocalizedString("medaillen.form.noPermission", comment: "403 beim Vergeben")
                : ((error as? APIError)?.errorDescription ?? error.localizedDescription)
            return false
        }
    }
}

private extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
