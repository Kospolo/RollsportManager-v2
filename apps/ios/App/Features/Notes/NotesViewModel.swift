import Foundation

/// Listen-ViewModel der privaten Notizen (Web-Referenz: (portal)/notizen).
///
/// Notizen sind STRIKT privat pro Nutzer: der Server scoped sie via RLS auf den
/// eingeloggten Account, `GET /notes` hat deshalb bewusst keinen Filter. Es gibt
/// kein Trainer-Gate — Anlegen/Bearbeiten/Löschen stehen jeder:m für die eigenen
/// Notizen offen. Reihenfolge = zuletzt geändert zuerst, damit eine eben
/// gespeicherte Notiz verlässlich nach oben springt.
@MainActor
final class NotesViewModel: ObservableObject {

    enum State: Equatable {
        case loading
        case error(String)
        case loaded
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var notes: [Note] = []
    /// Notiz, für die der Löschen-Bestätigungsdialog offen ist (`nil` = zu).
    @Published var deleteTarget: Note?
    @Published private(set) var isDeleting = false
    /// Fehler bei Pull-to-Refresh oder Löschen, wenn schon Daten sichtbar sind —
    /// wird als Alert gezeigt, statt die Liste durch einen Fehler-Screen zu ersetzen.
    @Published var actionErrorMessage: String?

    private var api: APIClient?
    private var hasLoadedOnce = false

    var isEmpty: Bool { notes.isEmpty }

    // MARK: - Laden

    /// Erststart aus `.task` — der `APIClient` kommt aus dem SessionStore im
    /// View-Environment, deshalb wird er hier hineingereicht.
    func loadIfNeeded(api: APIClient) async {
        self.api = api
        guard !hasLoadedOnce else { return }
        hasLoadedOnce = true
        await load(showLoadingState: true)
    }

    func retry() async { await load(showLoadingState: true) }

    /// Pull-to-Refresh: kein Lade-Screen, Fehler nur als Alert.
    func refresh() async { await load(showLoadingState: false) }

    private func load(showLoadingState: Bool) async {
        guard let api else { return }
        if showLoadingState { state = .loading }
        do {
            let loaded = try await api.listNotes()
            notes = Self.sorted(loaded)
            state = .loaded
        } catch {
            let message = Self.friendlyMessage(error)
            if state == .loaded, !showLoadingState {
                actionErrorMessage = message
            } else {
                state = .error(message)
            }
        }
    }

    // MARK: - Mutationen (optimistisch in die Liste einpflegen)

    /// Eine angelegte oder bearbeitete Notiz (mit echter ID) einsortieren; die
    /// Reihenfolge (zuletzt geändert zuerst) wird dabei neu hergestellt.
    func upsert(_ note: Note) {
        if let index = notes.firstIndex(where: { $0.id == note.id }) {
            notes[index] = note
        } else {
            notes.append(note)
        }
        notes = Self.sorted(notes)
    }

    /// Öffnet den Löschen-Bestätigungsdialog — es wird NIE ohne ausdrückliche
    /// Bestätigung gelöscht.
    func requestDelete(_ note: Note) {
        deleteTarget = note
    }

    /// Führt das Löschen nach Bestätigung aus (DELETE /notes/{id} → Deleted).
    /// Die Notiz wird explizit übergeben (vom `presenting:`-Dialog), damit der
    /// Aufruf NICHT auf `deleteTarget` angewiesen ist — der Bestätigungsdialog
    /// nilt `deleteTarget` beim Schließen, was sonst mit dem asynchronen Löschen
    /// kollidieren und es still verschlucken könnte. Erfolg entfernt die Notiz
    /// aus der Liste; ein Fehler bleibt als Alert.
    func confirmDelete(_ note: Note) async {
        guard let api, !isDeleting else { return }
        isDeleting = true
        defer { isDeleting = false }
        do {
            try await api.deleteNote(noteId: note.id)
            notes.removeAll { $0.id == note.id }
            deleteTarget = nil
        } catch {
            actionErrorMessage = Self.friendlyMessage(error)
            deleteTarget = nil
        }
    }

    // MARK: - Helfer

    private static func sorted(_ notes: [Note]) -> [Note] {
        notes.sorted { $0.updatedAt > $1.updatedAt }
    }

    static func friendlyMessage(_ error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
