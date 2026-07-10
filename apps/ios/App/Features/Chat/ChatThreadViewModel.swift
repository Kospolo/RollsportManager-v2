import Foundation

/// Thread-ViewModel: lädt die Nachrichten EINES Kanals (chronologisch
/// aufsteigend vom Server) und sendet neue Nachrichten optimistisch.
///
/// Ziel wird aus dem Kanal abgeleitet: Team-Kanal ⇒ `teamId` Pflicht,
/// Direkt-Kanal ⇒ `peerMemberId`/`recipientMemberId` Pflicht (sonst 400).
/// Der Absender ist serverseitig immer der Aufrufer. Rechte sind
/// serverseitig (RLS): Schreiben ohne Berechtigung ⇒ 403.
@MainActor
final class ChatThreadViewModel: ObservableObject {

    enum State: Equatable {
        case loading
        case error(String)
        case loaded
    }

    /// Fehlgeschlagenes Senden — die View mappt auf lokalisierten Text.
    enum SendFailure: Equatable {
        /// 403 vom Server: „Du darfst hier nicht schreiben."
        case forbidden
        /// Alles andere (Transport, 5xx, …) mit Klartext.
        case other(String)
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var messages: [ChatMessage] = []
    /// Fehler beim Pull-to-Refresh, wenn schon Nachrichten da sind (Alert).
    @Published var refreshErrorMessage: String?
    @Published var sendFailure: SendFailure?
    @Published private(set) var isSending = false

    private var api: APIClient?
    private var clubId: String?
    private var channel: ChatChannel?
    private(set) var myMemberId = ""
    private var hasLoadedOnce = false

    // MARK: - Laden

    func loadIfNeeded(
        api: APIClient,
        clubId: String,
        channel: ChatChannel,
        myMemberId: String
    ) async {
        self.api = api
        self.clubId = clubId
        self.channel = channel
        self.myMemberId = myMemberId
        guard !hasLoadedOnce else { return }
        hasLoadedOnce = true
        await load(showLoadingState: true)
    }

    func retry() async {
        await load(showLoadingState: true)
    }

    func refresh() async {
        await load(showLoadingState: false)
    }

    private func load(showLoadingState: Bool) async {
        guard let api, let clubId, let channel else { return }
        if showLoadingState { state = .loading }
        do {
            let server = try await api.listChatMessages(
                clubId: clubId,
                channelType: channel.channelType,
                teamId: channel.channelType == .team ? channel.teamId : nil,
                peerMemberId: channel.channelType == .direct ? channel.peerMemberId : nil
            )
            // Noch nicht bestätigte optimistische Blasen über den Reload retten.
            let serverIds = Set(server.map(\.id))
            let stillPending = messages.filter {
                $0.id.hasPrefix("temp-") && !serverIds.contains($0.id)
            }
            messages = server + stillPending
            state = .loaded
        } catch {
            let message = Self.friendlyMessage(error)
            if state == .loaded, !showLoadingState {
                refreshErrorMessage = message
            } else {
                state = .error(message)
            }
        }
    }

    // MARK: - Senden (optimistisch, mit Rollback)

    /// Hängt die Nachricht sofort als Blase an, ersetzt sie nach Bestätigung
    /// durch die serverseitige Nachricht und rollt bei Fehler zurück.
    /// Rückgabe `false` ⇒ Senden fehlgeschlagen (die View stellt den Entwurf
    /// wieder her); `sendFailure` trägt den Grund für den Alert.
    @discardableResult
    func send(text: String) async -> Bool {
        let body = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty, !isSending,
              let api, let clubId, let channel
        else { return false }

        isSending = true
        defer { isSending = false }

        let tempId = "temp-\(UUID().uuidString)"
        let optimistic = ChatMessage(
            id: tempId,
            clubId: clubId,
            channelType: channel.channelType,
            teamId: channel.channelType == .team ? channel.teamId : nil,
            senderMemberId: myMemberId,
            recipientMemberId: channel.channelType == .direct ? channel.peerMemberId : nil,
            body: body,
            imageUrl: nil,
            createdAt: ChatFormat.nowISO()
        )
        messages.append(optimistic)

        let create = ChatMessageCreate(
            clubId: clubId,
            channelType: channel.channelType,
            teamId: channel.channelType == .team ? channel.teamId : nil,
            recipientMemberId: channel.channelType == .direct ? channel.peerMemberId : nil,
            body: body,
            imageUrl: nil
        )

        do {
            let saved = try await api.sendChatMessage(create)
            // Temp-Blase durch die bestätigte Nachricht ersetzen (kein Flackern).
            if let index = messages.firstIndex(where: { $0.id == tempId }) {
                messages[index] = saved
            }
            return true
        } catch {
            messages.removeAll { $0.id == tempId }
            sendFailure = error.isForbiddenAPIError ? .forbidden : .other(Self.friendlyMessage(error))
            return false
        }
    }

    static func friendlyMessage(_ error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
