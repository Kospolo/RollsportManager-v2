import Foundation

// ============================================================================
// Zustand der internen Trainer-Notizen eines Mitglieds.
//
// ### DIE LEERE LISTE IST EIN GÜLTIGES ERGEBNIS ###
// Für die betroffene Person und ihre Familie liefert der Server IMMER eine
// leere Liste — nie einen Fehler. Dieses ViewModel darf daraus deshalb keinen
// Sonderfall bauen: „nichts da" sieht hier genauso aus wie „nichts geschrieben".
// Genau das ist gewollt; jede Unterscheidung wäre schon eine Auskunft.
// ============================================================================

@MainActor
final class CoachNotesViewModel: ObservableObject {

    enum State {
        case loading
        case failed(String)
        case loaded([MemberCoachNote])
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var isSaving = false
    /// Klartext-Meldung des letzten Neins (Alert). Bei 403 steht dort der
    /// zweisprachige Erklärtext des Servers — er sagt genauer WARUM, als es
    /// ein Ersatztext im Client könnte.
    @Published var actionError: String?

    private var hasLoaded = false

    var notes: [MemberCoachNote] {
        if case .loaded(let notes) = state { return notes }
        return []
    }

    // MARK: - Laden

    func loadIfNeeded(api: APIClient, clubId: String, memberId: String) async {
        guard !hasLoaded else { return }
        await load(api: api, clubId: clubId, memberId: memberId)
    }

    func load(api: APIClient, clubId: String, memberId: String) async {
        state = .loading
        do {
            let notes = try await api.listCoachNotes(clubId: clubId, memberId: memberId)
            hasLoaded = true
            state = .loaded(notes)
        } catch {
            state = .failed(Self.message(for: error))
        }
    }

    // MARK: - Schreiben

    /// Legt eine Notiz an. Leerer/nur-Leerzeichen-Text wird gar nicht erst
    /// gesendet — eine leere Notiz ist keine Notiz.
    func add(body: String, api: APIClient, clubId: String, memberId: String) async -> Bool {
        let text = body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isSaving else { return false }
        isSaving = true
        defer { isSaving = false }
        do {
            let created = try await api.createCoachNote(
                MemberCoachNoteCreate(clubId: clubId, memberId: memberId, body: text)
            )
            // Der Server sortiert absteigend nach `created_at` — die neueste
            // Notiz gehört damit nach vorn.
            state = .loaded([created] + notes)
            return true
        } catch {
            actionError = Self.message(for: error)
            return false
        }
    }

    func update(note: MemberCoachNote, body: String, api: APIClient) async -> Bool {
        let text = body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isSaving else { return false }
        isSaving = true
        defer { isSaving = false }
        do {
            let fresh = try await api.updateCoachNote(noteId: note.id, body: text)
            state = .loaded(notes.map { $0.id == fresh.id ? fresh : $0 })
            return true
        } catch {
            actionError = Self.message(for: error)
            return false
        }
    }

    func delete(note: MemberCoachNote, api: APIClient) async {
        guard !isSaving else { return }
        isSaving = true
        defer { isSaving = false }
        do {
            try await api.deleteCoachNote(noteId: note.id)
            state = .loaded(notes.filter { $0.id != note.id })
        } catch {
            actionError = Self.message(for: error)
        }
    }

    private static func message(for error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
