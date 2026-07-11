import Foundation
import SwiftUI

/// Formular-State für das Anlegen ODER Bearbeiten einer privaten Notiz
/// (Titel + Text) über `createNote`/`updateNote`. Titel ist Pflicht, der Text
/// optional. Erfolg reicht die gespeicherte `Note` (mit echter ID) via
/// `onSaved` zurück in die Liste; ein Fehler bleibt als Alert im Sheet stehen.
@MainActor
final class NoteFormViewModel: ObservableObject {

    enum Mode: Equatable {
        case create
        case edit(Note)
    }

    // MARK: - Eingaben
    @Published var title: String
    @Published var body: String

    // MARK: - Zustand
    @Published var titleError: LocalizedStringKey?
    @Published private(set) var isSaving = false
    /// Fehler beim Absenden (Transport / RFC-7807-Problem) als Klartext.
    @Published var submitError: String?

    let mode: Mode
    private let api: APIClient
    private let onSaved: (Note) -> Void

    var isEdit: Bool {
        if case .edit = mode { return true }
        return false
    }

    init(mode: Mode, api: APIClient, onSaved: @escaping (Note) -> Void) {
        self.mode = mode
        self.api = api
        self.onSaved = onSaved
        switch mode {
        case .create:
            title = ""
            body = ""
        case .edit(let note):
            title = note.title
            body = note.body
        }
#if DEBUG
        applyDevPrefillIfNeeded()
#endif
    }

#if DEBUG
    /// NUR DEBUG/Smoke-Test: füllt ein Anlegen-Formular aus Launch-Argumenten
    /// (`-devPrefillNote YES`, optional `-devNoteTitle …` / `-devNoteBody …`),
    /// damit ein Screenshot das ausgefüllte Sheet zeigt und der Auto-Submit
    /// einen echten POST /notes fahren kann. Ohne das Flag passiert nichts.
    private func applyDevPrefillIfNeeded() {
        let defaults = UserDefaults.standard
        guard defaults.bool(forKey: "devPrefillNote") else { return }
        guard case .create = mode else { return }
        title = defaults.string(forKey: "devNoteTitle") ?? "iOS Testnotiz"
        body = defaults.string(forKey: "devNoteBody")
            ?? "Automatisierter iOS-Smoke-Test – nur für mich sichtbar."
    }
#endif

    // MARK: - Absenden

    /// Validiert und speichert. Gibt bei Erfolg `true` zurück (View schließt das
    /// Sheet); bei Validierungs- oder Serverfehler `false` (Sheet bleibt offen).
    func submit() async -> Bool {
        guard !isSaving else { return false }

        let trimmedTitle = title.trimmedNote
        guard !trimmedTitle.isEmpty else {
            titleError = "notizen.form.field.title.error"
            return false
        }
        let trimmedBody = body.trimmedNote

        isSaving = true
        defer { isSaving = false }
        do {
            let saved: Note
            switch mode {
            case .create:
                // clubId bewusst nil ⇒ rein private Notiz.
                saved = try await api.createNote(
                    NoteCreate(title: trimmedTitle, body: trimmedBody)
                )
            case .edit(let note):
                saved = try await api.updateNote(
                    noteId: note.id,
                    NoteUpdate(title: trimmedTitle, body: trimmedBody)
                )
            }
            onSaved(saved)
            return true
        } catch {
            submitError = (error as? APIError)?.errorDescription ?? error.localizedDescription
            return false
        }
    }
}

private extension String {
    var trimmedNote: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
