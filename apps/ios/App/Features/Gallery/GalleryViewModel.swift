import Foundation

/// Album-Filter der Galerie. Spiegelt die Web-Facade (`""` = alle,
/// `__none__` = ohne Album, sonst der Album-Name).
enum GalleryAlbumFilter: Hashable {
    case all
    case album(String)
    /// Einträge ohne (leeres) Album.
    case unfiled
}

/// Lädt die Galerie (PRO): zuerst das Entitlement, dann — nur bei aktivem PRO —
/// die Einträge. Ohne PRO landet der Screen auf der Upgrade-Karte; ein 402
/// `club_pro_required` aus der Liste wird zusätzlich abgefangen (Gate ist
/// verbindlich serverseitig). Web-Referenz: /(portal)/galerie.
@MainActor
final class GalleryViewModel: ObservableObject {

    enum State {
        case loading
        case proRequired
        /// 403 `club_module_disabled` — zubuchbar, aber nicht gebucht.
        case moduleNotBooked
        case error(String)
        case loaded([GalleryItem])
    }

    @Published private(set) var state: State = .loading
    /// Aktiver Album-Filter (`.all` = alle).
    @Published var selectedAlbum: GalleryAlbumFilter = .all

    func loadIfNeeded(api: APIClient, clubId: String) async {
        if case .loaded = state { return }
        await load(api: api, clubId: clubId)
    }

    func load(api: APIClient, clubId: String) async {
        state = .loading
        selectedAlbum = .all
        do {
            let entitlement = try await api.getEntitlement(clubId: clubId)
            guard entitlement.pro else { state = .proRequired; return }
            let items = try await api.listGallery(clubId: clubId)
            state = .loaded(items)
        } catch {
            // Reihenfolge wie in der API: erst Lizenz (402), dann Buchung (403).
            // Sonst bekaeme ein Verein ohne Lizenz den Rat, einen Schalter
            // umzulegen, der ihm gar nicht hilft.
            if error.isClubProRequiredError {
                state = .proRequired
            } else if error.isClubModuleDisabledError {
                state = .moduleNotBooked
            } else {
                state = .error(RoutinesViewModel.message(for: error))
            }
        }
    }

    /// Getrimmter, nicht-leerer Album-Name des Eintrags — sonst `nil`
    /// (spiegelt das Web-Kriterium `i.album` ⇒ „hat Album").
    static func normalizedAlbum(_ item: GalleryItem) -> String? {
        guard let raw = item.album?.trimmingCharacters(in: .whitespacesAndNewlines),
              !raw.isEmpty else { return nil }
        return raw
    }

    private var items: [GalleryItem] {
        if case .loaded(let items) = state { return items }
        return []
    }

    /// Verfügbare Alben (unique, in Erscheinungsreihenfolge) der geladenen Liste.
    var albums: [String] {
        var seen = Set<String>()
        var result: [String] = []
        for item in items {
            if let album = Self.normalizedAlbum(item), seen.insert(album).inserted {
                result.append(album)
            }
        }
        return result
    }

    /// Gibt es Einträge ohne Album? (dann erscheint der „Ohne Album"-Filter).
    var hasUnfiled: Bool { items.contains { Self.normalizedAlbum($0) == nil } }

    /// Filter-Optionen (wie Web): Alle → Alben (in Reihenfolge) → ggf. „Ohne Album".
    var albumOptions: [GalleryAlbumFilter] {
        var options: [GalleryAlbumFilter] = [.all]
        options.append(contentsOf: albums.map(GalleryAlbumFilter.album))
        if hasUnfiled { options.append(.unfiled) }
        return options
    }

    /// Chips nur zeigen, wenn es mehr als „Alle" + eine Gruppe gibt (Web: > 2).
    var showFilter: Bool { albumOptions.count > 2 }

    /// Anzahl der Einträge, die auf den Filter passen (Chip-Zähler).
    func count(for filter: GalleryAlbumFilter) -> Int {
        switch filter {
        case .all: return items.count
        case .album(let album): return items.filter { Self.normalizedAlbum($0) == album }.count
        case .unfiled: return items.filter { Self.normalizedAlbum($0) == nil }.count
        }
    }

    /// Nach `selectedAlbum` gefilterte Einträge (Server liefert bereits sortiert).
    var visibleItems: [GalleryItem] {
        switch selectedAlbum {
        case .all: return items
        case .album(let album): return items.filter { Self.normalizedAlbum($0) == album }
        case .unfiled: return items.filter { Self.normalizedAlbum($0) == nil }
        }
    }
}
