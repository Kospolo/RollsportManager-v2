import Foundation
import SwiftUI

/// Formular-State für „Nachricht verfassen“. Validiert im Klartext und postet
/// `NewsCreate`. Erfolg: erzeugte `News` (mit echter ID) fließt via `onCreated`
/// zurück in die Liste; 403 (Rolle ohne Recht) bleibt als Alert im Sheet.
/// Der Server setzt `published_at` selbst, wenn keins mitkommt — verfasste
/// Nachrichten erscheinen also sofort veröffentlicht (kein Entwurf).
@MainActor
final class NewNewsViewModel: ObservableObject {

    /// Feldbezogene Validierungshinweise (Klartext unter dem jeweiligen Feld).
    struct FieldErrors: Equatable {
        var title: LocalizedStringKey?
        var body: LocalizedStringKey?

        var isEmpty: Bool { title == nil && body == nil }
    }

    // MARK: - Eingaben

    @Published var title = ""
    @Published var body = ""
    @Published var isPinned = false

    // MARK: - Zustand

    @Published var fieldErrors = FieldErrors()
    @Published private(set) var isSaving = false
    /// Fehler beim Absenden (403 „Keine Berechtigung“ oder Transportfehler).
    @Published var submitError: String?

    private let api: APIClient
    private let clubId: String
    private let onCreated: (News) -> Void

    init(api: APIClient, clubId: String, onCreated: @escaping (News) -> Void) {
        self.api = api
        self.clubId = clubId
        self.onCreated = onCreated
    }

    /// Validiert und postet. Gibt bei Erfolg `true` zurück (View schließt das
    /// Sheet); bei Validierungs- oder 403-Fehlern `false` (Sheet bleibt offen).
    func submit() async -> Bool {
        guard !isSaving else { return false }

        var errors = FieldErrors()
        if title.trimmed.isEmpty { errors.title = "news.form.error.title" }
        if body.trimmed.isEmpty { errors.body = "news.form.error.body" }
        fieldErrors = errors
        guard errors.isEmpty else { return false }

        let create = NewsCreate(
            clubId: clubId,
            title: title.trimmed,
            body: body.trimmed,
            isPinned: isPinned
        )

        isSaving = true
        defer { isSaving = false }
        do {
            let created = try await api.createNews(create)
            onCreated(created)
            return true
        } catch {
            submitError = error.isForbiddenAPIError
                ? NSLocalizedString("news.form.error.forbidden", comment: "403 beim Anlegen")
                : ((error as? APIError)?.errorDescription ?? error.localizedDescription)
            return false
        }
    }
}

private extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
