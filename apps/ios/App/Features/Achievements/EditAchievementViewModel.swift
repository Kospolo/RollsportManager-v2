import Foundation
import SwiftUI

/// Formular-State für „Erfolg bearbeiten". Spiegelt `AwardAchievementViewModel`
/// (Anlegen), patcht aber einen bestehenden Erfolg (`AchievementUpdate`) und
/// bietet zusätzlich das Löschen. Das Mitglied bleibt fest — die API kennt kein
/// `member_id`-Patch (wie in der Web-Referenz `AchievementFormSheet.tsx`).
///
/// Erfolg (Speichern): der aktualisierte Erfolg fließt via `onUpdated` in die
/// Vitrine; Erfolg (Löschen): `onDeleted` entfernt ihn. Ein 403 (Rolle ohne
/// Recht) bleibt als Alert im Sheet stehen.
@MainActor
final class EditAchievementViewModel: ObservableObject {

    /// Feldbezogene Validierungshinweise (Klartext unter dem jeweiligen Feld).
    struct FieldErrors: Equatable {
        var title: LocalizedStringKey?
        var placement: LocalizedStringKey?

        var isEmpty: Bool { title == nil && placement == nil }
    }

    // MARK: - Eingaben (aus dem bestehenden Erfolg vorbelegt)

    @Published var title: String
    @Published var competition: String
    @Published var placementText: String
    /// `nil` = Teilnahme ohne Medaille; sonst Gold/Silber/Bronze.
    @Published var medal: Medal?
    @Published var achievedOn: Date
    @Published var note: String

    // MARK: - Zustand

    @Published private(set) var isSaving = false
    @Published private(set) var isDeleting = false
    @Published var fieldErrors = FieldErrors()
    /// Fehler beim Absenden (403 „Keine Berechtigung" oder Transportfehler).
    @Published var submitError: String?

    /// Anzeigename des (festen) Mitglieds fürs Sheet — informativ, nicht editierbar.
    let memberName: String?

    private let api: APIClient
    private let achievementId: String
    private let clubId: String
    private let memberId: String
    private let onUpdated: (MedalAchievement) -> Void
    private let onDeleted: (String) -> Void

    init(
        api: APIClient,
        achievement: MedalAchievement,
        memberName: String?,
        onUpdated: @escaping (MedalAchievement) -> Void,
        onDeleted: @escaping (String) -> Void
    ) {
        self.api = api
        self.achievementId = achievement.id
        self.clubId = achievement.clubId
        self.memberId = achievement.memberId
        self.memberName = memberName
        self.onUpdated = onUpdated
        self.onDeleted = onDeleted
        self.title = achievement.title
        self.competition = achievement.competitionName ?? ""
        self.placementText = achievement.placement.map(String.init) ?? ""
        self.medal = achievement.medal
        self.achievedOn = MedaillenFormat.parseDay(achievement.achievedOn)
            ?? Calendar.current.startOfDay(for: Date())
        self.note = achievement.note ?? ""
    }

    // MARK: - Speichern

    /// Validiert und patcht. Gibt bei Erfolg `true` zurück (View schließt das
    /// Sheet); bei Validierungs- oder 403-Fehlern `false` (Sheet bleibt offen).
    func submit() async -> Bool {
        guard !isSaving, !isDeleting else { return false }

        var errors = FieldErrors()
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

        let update = AchievementUpdate(
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
            let updated = try await api.medaillenUpdate(achievementId: achievementId, update)
            onUpdated(updated)
            return true
        } catch {
            submitError = error.isForbiddenAPIError
                ? NSLocalizedString("medaillen.form.noPermission", comment: "403 beim Bearbeiten")
                : ((error as? APIError)?.errorDescription ?? error.localizedDescription)
            return false
        }
    }

    // MARK: - Löschen

    /// Löscht den Erfolg. Gibt bei Erfolg `true` zurück (View schließt das
    /// Sheet); bei 403/Transportfehler `false` (Sheet bleibt offen, Alert).
    func delete() async -> Bool {
        guard !isSaving, !isDeleting else { return false }
        isDeleting = true
        defer { isDeleting = false }
        do {
            _ = try await api.medaillenDelete(achievementId: achievementId)
            onDeleted(achievementId)
            return true
        } catch {
            submitError = error.isForbiddenAPIError
                ? NSLocalizedString("medaillen.form.noPermission", comment: "403 beim Löschen")
                : ((error as? APIError)?.errorDescription ?? error.localizedDescription)
            return false
        }
    }
}

private extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
