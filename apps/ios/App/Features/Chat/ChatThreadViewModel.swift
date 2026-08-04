import Foundation
import SwiftUI

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
    /// Fehler beim moderierten Entfernen (Admin löscht fremde Nachricht) — die
    /// View zeigt ihn als Alert. Das Recht selbst ist serverseitig (RLS).
    @Published var moderationErrorMessage: String?
    /// True nach erfolgreichem Melden — die View zeigt eine kurze Bestätigung.
    @Published var reportSuccess = false

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

    // MARK: - Moderation (Admin entfernt fremde Nachricht)

    /// Entfernt eine FREMDE Nachricht per Moderation (DELETE /chat/messages/{id}).
    /// Sichtbar/aufrufbar nur für Admins in team/broadcast — die eigentliche
    /// Berechtigung erzwingt der Server (RLS). Optimistische Blasen (`temp-`)
    /// haben serverseitig keine ID und werden nie moderiert.
    /// Rückgabe `false` ⇒ fehlgeschlagen (`moderationErrorMessage` trägt den Grund).
    @discardableResult
    func moderate(_ message: ChatMessage?) async -> Bool {
        guard let message, let api,
              !message.id.hasPrefix("temp-")
        else { return false }
        do {
            _ = try await api.deleteChatMessage(id: message.id)
            // Blase animiert entfernen; die `.transition` an der Blase spielt die
            // Bewegung. Reduce Motion dämpft `.snappy` systemseitig.
            withAnimation(.snappy) {
                messages.removeAll { $0.id == message.id }
            }
            return true
        } catch {
            moderationErrorMessage = Self.friendlyMessage(error)
            return false
        }
    }

    // MARK: - Melden (Verstoss an den Vorstand/Betreiber)

    /// Meldet eine FREMDE Nachricht als Verstoss (POST /chat/reports). Der Server
    /// hält Melder, IP und einen Snapshot des Textes fest — die UI reicht nur
    /// `messageId` und den Grund weiter. Aufrufbar für jedes Mitglied an fremden,
    /// bereits gesendeten Nachrichten (nie `temp-`, nie eigene). Wird nie
    /// automatisch ausgelöst — gemeldet wird ausschliesslich über den Dialog.
    /// Wirft bei Fehler (inkl. 403/404), damit das Sheet ihn inline zeigt und
    /// offen bleibt. Bei Erfolg setzt `reportSuccess` die Bestätigung.
    func report(message: ChatMessage, reason: String) async throws {
        let trimmed = reason.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let api, let clubId,
              !message.id.hasPrefix("temp-"),
              !trimmed.isEmpty
        else { return }
        _ = try await api.reportChatMessage(
            clubId: clubId,
            messageId: message.id,
            reason: trimmed
        )
        reportSuccess = true
    }

    static func friendlyMessage(_ error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
