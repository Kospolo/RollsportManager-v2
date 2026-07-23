import Foundation

// ============================================================================
// Zustand der Foto-Markierung eines Galerie-Eintrags.
//
// Lädt zwei Dinge und führt sie zusammen: die Markierungen des Eintrags
// (`/gallery/{id}/tags`) und die Mitgliederliste des Vereins (für die Namen —
// der Tag-Contract trägt nur `member_id`).
//
// ### DIE LISTE IST SCHON GEFILTERT, WENN SIE ANKOMMT ###
// Was `listPhotoTags` liefert, hat die RLS bereits nach Einwilligung
// beschnitten. Dieses ViewModel filtert deshalb NICHTS nach — es gibt hier
// bewusst keine „consent"-Logik, die man falsch herum schreiben könnte.
// ============================================================================

@MainActor
final class PhotoTagViewModel: ObservableObject {

    enum State {
        case loading
        /// Markierungen sind für diese Rolle nicht einsehbar (403).
        case forbidden
        case failed(String)
        case loaded([PhotoTag])
    }

    @Published private(set) var state: State = .loading
    /// Mitglieder des Vereins — Namensquelle und Auswahlliste beim Markieren.
    @Published private(set) var members: [ClubMember] = []
    /// Läuft gerade ein Markieren/Entfernen? (Knöpfe sperren)
    @Published private(set) var isMutating = false
    /// Klartext-Meldung der letzten fehlgeschlagenen Schreibaktion (Alert).
    @Published var actionError: String?

    private var hasLoaded = false

    var tags: [PhotoTag] {
        if case .loaded(let tags) = state { return tags }
        return []
    }

    /// Name zu einer `member_id` — oder `nil`, wenn das Mitglied für die
    /// aufrufende Person gar nicht sichtbar ist. Dann zeigt die Ansicht einen
    /// neutralen Platzhalter statt einer roh durchgereichten UUID.
    func name(for memberId: String) -> String? {
        members.first { $0.id == memberId }?.membersFullName
    }

    /// Mitglieder, die noch NICHT markiert sind (Auswahl beim Markieren),
    /// optional nach Suchtext gefiltert.
    func selectableMembers(matching search: String) -> [ClubMember] {
        let taggedIds = Set(tags.map(\.memberId))
        let needle = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return members
            .filter { !taggedIds.contains($0.id) }
            .filter { needle.isEmpty || $0.membersFullName.lowercased().contains(needle) }
    }

    // MARK: - Laden

    func loadIfNeeded(itemId: String, api: APIClient, clubId: String) async {
        guard !hasLoaded else { return }
        await load(itemId: itemId, api: api, clubId: clubId)
    }

    func load(itemId: String, api: APIClient, clubId: String) async {
        state = .loading
        do {
            // Die Mitgliederliste darf scheitern, ohne die Markierungen
            // mitzureissen: ohne Namen zeigt die Ansicht „Unbekannt", ohne
            // Markierungen gäbe es gar nichts zu zeigen.
            async let tagsTask = api.listPhotoTags(itemId: itemId)
            let loadedMembers = (try? await api.listMembers(clubId: clubId)) ?? []
            let loadedTags = try await tagsTask
            members = loadedMembers
            hasLoaded = true
            state = .loaded(loadedTags)
        } catch {
            if error.isForbiddenAPIError {
                state = .forbidden
            } else {
                state = .failed((error as? APIError)?.errorDescription ?? error.localizedDescription)
            }
        }
    }

    // MARK: - Schreiben

    /// Markiert eine Person. Bei Erfolg wandert der neue Tag sofort in die
    /// Liste; bei 403 erklärt der Alert, dass nur der Trainerstab markiert.
    func tag(memberId: String, itemId: String, clubId: String, api: APIClient) async {
        guard !isMutating else { return }
        isMutating = true
        defer { isMutating = false }
        do {
            let created = try await api.createPhotoTag(
                PhotoTagCreate(clubId: clubId, galleryItemId: itemId, memberId: memberId)
            )
            state = .loaded(tags + [created])
        } catch {
            actionError = Self.actionMessage(for: error, forbidden: "gallery.tags.forbidden.tag")
        }
    }

    /// Nimmt eine Markierung zurück (Soft-Delete beim Server).
    func untag(_ tag: PhotoTag, api: APIClient) async {
        guard !isMutating else { return }
        isMutating = true
        defer { isMutating = false }
        do {
            try await api.deletePhotoTag(tagId: tag.id)
            state = .loaded(tags.filter { $0.id != tag.id })
        } catch {
            actionError = Self.actionMessage(for: error, forbidden: "gallery.tags.forbidden.untag")
        }
    }

    private static func actionMessage(for error: Error, forbidden key: String) -> String {
        if error.isForbiddenAPIError {
            return String(localized: String.LocalizationValue(key))
        }
        return (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
