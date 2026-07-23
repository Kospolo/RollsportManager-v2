import Foundation

/// Lädt die Dokumente (PRO): erst Entitlement, dann — nur bei PRO — die Liste.
/// Gleiches Gate-Muster wie die Galerie (402 `club_pro_required` → Upgrade).
/// Zusätzlich verwaltet das Modell den Download eines Dokuments in eine
/// temporäre Datei (für QuickLook/Teilen). Web-Referenz: /(portal)/dokumente.
@MainActor
final class DocumentsViewModel: ObservableObject {

    enum State {
        case loading
        case proRequired
        /// 403 `club_module_disabled` — zubuchbar, aber nicht gebucht.
        case moduleNotBooked
        case error(String)
        case loaded([Document])
    }

    @Published private(set) var state: State = .loading
    @Published var selectedCategory: String?

    /// Läuft gerade ein Download (Zeile zeigt Spinner statt Chevron).
    @Published private(set) var downloadingId: String?
    /// Fehler beim Download (Alert).
    @Published var downloadError: String?
    /// Fertig geladene Datei → QuickLook-Sheet.
    @Published var previewURL: URL?

    /// `uploaded_by_member_id` → „Vorname Nachname" (für die „von …"-Zeile).
    /// Best effort: fehlt die Mitgliederliste (RLS/403), bleibt die Map leer und
    /// die Zeile zeigt nur das Datum. Web-Referenz löst genauso über `memberById`.
    @Published private(set) var uploaderNames: [String: String] = [:]

    func loadIfNeeded(api: APIClient, clubId: String) async {
        if case .loaded = state { return }
        await load(api: api, clubId: clubId)
    }

    func load(api: APIClient, clubId: String) async {
        state = .loading
        do {
            let entitlement = try await api.getEntitlement(clubId: clubId)
            guard entitlement.pro else { state = .proRequired; return }
            // Dokumente sind Pflicht, die Mitglieder (für den Namen) nur Kür —
            // beide parallel, ein Fehler der Mitgliederliste kippt den Screen nicht.
            async let docsTask = api.listDocuments(clubId: clubId)
            async let membersTask = api.members(clubId: clubId)
            let docs = try await docsTask
            let members = (try? await membersTask) ?? []
            uploaderNames = Dictionary(
                members.map { ($0.id, Self.memberName($0)) },
                uniquingKeysWith: { first, _ in first }
            )
            state = .loaded(docs)
        } catch {
            // Reihenfolge wie in der API: erst Lizenz (402), dann Buchung (403).
            if error.isClubProRequiredError {
                state = .proRequired
            } else if error.isClubModuleDisabledError {
                state = .moduleNotBooked
            } else {
                state = .error(RoutinesViewModel.message(for: error))
            }
        }
    }

    /// Anzeigename der hochladenden Person, falls die Mitgliederliste sichtbar war.
    func uploaderName(for document: Document) -> String? {
        uploaderNames[document.uploadedByMemberId]
    }

    private static func memberName(_ member: ClubMember) -> String {
        "\(member.firstName) \(member.lastName)".trimmingCharacters(in: .whitespaces)
    }

    /// Lädt das Dokument in eine temporäre Datei und öffnet die Vorschau.
    func open(document: Document, api: APIClient) async {
        guard downloadingId == nil else { return }
        downloadingId = document.id
        defer { downloadingId = nil }
        do {
            let url = try await api.downloadMedia(
                key: document.storageKey,
                suggestedName: document.title
            )
            previewURL = url
        } catch {
            downloadError = RoutinesViewModel.message(for: error)
        }
    }

    var categories: [String] {
        guard case .loaded(let docs) = state else { return [] }
        var seen = Set<String>()
        var result: [String] = []
        for doc in docs where seen.insert(doc.category).inserted {
            result.append(doc.category)
        }
        return result
    }

    var visibleDocuments: [Document] {
        guard case .loaded(let docs) = state else { return [] }
        guard let category = selectedCategory else { return docs }
        return docs.filter { $0.category == category }
    }
}
