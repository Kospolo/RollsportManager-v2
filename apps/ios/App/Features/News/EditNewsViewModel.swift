import Foundation
import SwiftUI

/// Formular-State für „Nachricht bearbeiten“. Spiegel von `NewNewsViewModel`,
/// nur dass er aus einer bestehenden `News` vorbelegt und `NewsUpdate` per
/// PATCH schickt. Erfolg: die aktualisierte `News` fließt via `onSaved` zurück
/// in die Liste; 403 (Rolle ohne Recht) bleibt als Alert im Sheet.
@MainActor
final class EditNewsViewModel: ObservableObject {

    /// Feldbezogene Validierungshinweise (Klartext unter dem jeweiligen Feld).
    struct FieldErrors: Equatable {
        var title: LocalizedStringKey?
        var body: LocalizedStringKey?

        var isEmpty: Bool { title == nil && body == nil }
    }

    // MARK: - Eingaben

    @Published var title: String
    @Published var body: String
    @Published var isPinned: Bool

    // MARK: - Zustand

    @Published var fieldErrors = FieldErrors()
    @Published private(set) var isSaving = false
    /// Fehler beim Absenden (403 „Keine Berechtigung“ oder Transportfehler).
    @Published var submitError: String?

    private let api: APIClient
    private let newsId: String
    private let onSaved: (News) -> Void

    init(api: APIClient, news: News, onSaved: @escaping (News) -> Void) {
        self.api = api
        self.newsId = news.id
        self.onSaved = onSaved
        self.title = news.title
        self.body = news.body
        self.isPinned = news.isPinned
    }

    /// Validiert und patcht. Gibt bei Erfolg `true` zurück (View schließt das
    /// Sheet); bei Validierungs- oder 403-Fehlern `false` (Sheet bleibt offen).
    func submit() async -> Bool {
        guard !isSaving else { return false }

        var errors = FieldErrors()
        if title.trimmed.isEmpty { errors.title = "news.form.error.title" }
        if body.trimmed.isEmpty { errors.body = "news.form.error.body" }
        fieldErrors = errors
        guard errors.isEmpty else { return false }

        let update = NewsUpdate(
            title: title.trimmed,
            body: body.trimmed,
            isPinned: isPinned
        )

        isSaving = true
        defer { isSaving = false }
        do {
            let updated = try await api.updateNews(newsId: newsId, update)
            onSaved(updated)
            return true
        } catch {
            submitError = error.isForbiddenAPIError
                ? NSLocalizedString("news.form.error.forbidden", comment: "403 beim Bearbeiten")
                : ((error as? APIError)?.errorDescription ?? error.localizedDescription)
            return false
        }
    }
}

private extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
