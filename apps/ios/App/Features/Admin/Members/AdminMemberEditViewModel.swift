import Foundation
import SwiftUI

/// Bearbeiten-Sheet eines Mitglieds — zwei getrennte Speicherpfade:
///  - Stammdaten (Vorname/Nachname/E-Mail/Geburtsdatum/Status, bei Gasttrainer
///    zusätzlich `valid_until`) über `updateMember` per „Speichern".
///  - Rolle über `changeMemberRole`, sofort beim Auswählen. Die Hierarchie
///    graut Optionen aus (`permissions.canChangeRole`); die Wahrheit bleibt
///    serverseitig (403 nicht berechtigt, 409 letzter Owner).
///
/// Web-Referenz: verwaltung/mitglieder/EditMemberSheet.tsx.
@MainActor
final class AdminMemberEditViewModel: ObservableObject {

    /// Fehlerursache eines Schreibpfads — trennt „keine Berechtigung" (403)
    /// vom Klartext (Transport, 409 letzter Owner, …).
    enum Failure: Equatable {
        case forbidden
        case other(String)
    }

    struct FieldErrors: Equatable {
        var firstName: LocalizedStringKey?
        var lastName: LocalizedStringKey?
        var email: LocalizedStringKey?
    }

    // MARK: - Eingaben

    @Published var firstName: String
    @Published var lastName: String
    @Published var email: String
    @Published var birthDate: Date?
    @Published var status: MemberStatus
    @Published var validUntil: Date?
    /// Aktuelle Rolle (folgt nach erfolgreichem Wechsel dem Server).
    @Published private(set) var role: ClubRole

    @Published var fieldErrors = FieldErrors()
    @Published var isSaving = false
    @Published var isChangingRole = false
    /// Alert des Stammdaten-Speicherpfads.
    @Published var saveFailure: Failure?
    /// Alert des Rollenwechsels.
    @Published var roleFailure: Failure?

    // MARK: - Kontext

    /// Unveränderter Ausgangsstand (Baseline für den Diff).
    let member: ClubMember
    private let api: APIClient
    private let clubId: String
    private let permissions: Permissions
    private let currentUserId: String?
    private let onUpdated: (ClubMember) -> Void

    init(
        member: ClubMember,
        api: APIClient,
        clubId: String,
        permissions: Permissions,
        currentUserId: String?,
        onUpdated: @escaping (ClubMember) -> Void
    ) {
        self.member = member
        self.api = api
        self.clubId = clubId
        self.permissions = permissions
        self.currentUserId = currentUserId
        self.onUpdated = onUpdated

        firstName = member.firstName
        lastName = member.lastName
        email = member.email ?? ""
        birthDate = member.birthDate.flatMap(AdminMembersFormat.date(from:))
        status = member.status
        validUntil = member.validUntil.flatMap(AdminMembersFormat.date(from:))
        role = member.role
    }

    // MARK: - Rollen-Gating (Anzeige; Server bleibt Autorität)

    var isSelf: Bool { currentUserId != nil && currentUserId == member.id }
    var isOwnerRow: Bool { role == .owner }

    /// Ganze Rollen-Auswahl bedienbar? Nie die eigene, nie einen Owner, und nur
    /// wenn die aktuelle Rolle Ziele dieses Rangs umstufen darf.
    var canEditRole: Bool {
        !isOwnerRow && !isSelf && permissions.canChangeRole(role)
    }

    /// Einzeloption bedienbar (Zielrolle vergebbar)?
    func canAssign(_ target: AssignableClubRole) -> Bool {
        guard let asClub = ClubRole(rawValue: target.rawValue) else { return false }
        return permissions.canChangeRole(asClub)
    }

    var roleHintKey: LocalizedStringKey {
        if isOwnerRow { return "mitglieder.role.hint.owner" }
        if isSelf { return "mitglieder.role.hint.self" }
        if !permissions.canChangeRole(role) { return "mitglieder.role.hint.locked" }
        return "mitglieder.role.hint.immediate"
    }

    /// Gasttrainer-Zugang befristen (nur dann `valid_until`).
    var showValidUntil: Bool { role == .guestCoach }
    var showPendingHint: Bool { member.status == .pending }

    // MARK: - Rolle ändern (sofortiger Speicherpfad)

    func changeRole(to target: AssignableClubRole) async {
        guard !isChangingRole,
              canEditRole,
              canAssign(target),
              ClubRole(rawValue: target.rawValue) != role
        else { return }

        isChangingRole = true
        defer { isChangingRole = false }
        do {
            // Rolle erst nach Erfolg übernehmen — kein optimistischer Rollback nötig.
            let updated = try await api.changeMemberRole(
                clubId: clubId,
                memberId: member.id,
                role: target
            )
            role = updated.role
            onUpdated(updated)
        } catch {
            roleFailure = Self.classify(error)
        }
    }

    // MARK: - Stammdaten (Speichern-Aktion)

    /// Speichert die Stammdaten. Rückgabe `true` ⇒ Sheet darf schließen
    /// (auch bei „nichts geändert"). Bei Fehler bleibt es offen (Alert).
    func save() async -> Bool {
        guard !isSaving else { return false }
        guard validate() else { return false }

        let patch = buildPatch()
        guard !Self.isEmpty(patch) else { return true } // nichts zu tun

        isSaving = true
        defer { isSaving = false }
        do {
            let updated = try await api.updateMember(clubId: clubId, memberId: member.id, patch)
            onUpdated(updated)
            return true
        } catch {
            saveFailure = Self.classify(error)
            return false
        }
    }

    private func validate() -> Bool {
        var errors = FieldErrors()
        if firstName.trimmingCharacters(in: .whitespaces).isEmpty {
            errors.firstName = "mitglieder.val.firstName"
        }
        if lastName.trimmingCharacters(in: .whitespaces).isEmpty {
            errors.lastName = "mitglieder.val.lastName"
        }
        let mail = email.trimmingCharacters(in: .whitespaces)
        if !mail.isEmpty, !Self.isValidEmail(mail) {
            errors.email = "mitglieder.val.email"
        }
        fieldErrors = errors
        return errors.firstName == nil && errors.lastName == nil && errors.email == nil
    }

    /// Diff-basierter Patch. HINWEIS/GEMELDET: Der generierte `ClubMemberUpdate`
    /// nutzt synthetisiertes Codable (`encodeIfPresent`) — `nil` wird beim
    /// Encodieren WEGGELASSEN, nicht als JSON-`null` gesendet. Damit lassen sich
    /// Werte setzen/ändern, ein bestehendes Feld aber nicht aktiv leeren
    /// (Web sendet dafür `null`). Leerungen bleiben hier bewusst unversendet.
    private func buildPatch() -> ClubMemberUpdate {
        var patch = ClubMemberUpdate()

        let fn = firstName.trimmingCharacters(in: .whitespaces)
        if fn != member.firstName { patch.firstName = fn }

        let ln = lastName.trimmingCharacters(in: .whitespaces)
        if ln != member.lastName { patch.lastName = ln }

        let mail = email.trimmingCharacters(in: .whitespaces)
        if !mail.isEmpty, mail != (member.email ?? "") { patch.email = mail }

        if let bd = birthDate.map(AdminMembersFormat.wire(from:)),
           bd != member.birthDate.map({ String($0.prefix(10)) }) {
            patch.birthDate = bd
        }

        if status != member.status { patch.status = status }

        // valid_until nur für Gasttrainer (befristeter Zugang) mitschicken.
        if role == .guestCoach,
           let vu = validUntil.map(AdminMembersFormat.wire(from:)),
           vu != member.validUntil.map({ String($0.prefix(10)) }) {
            patch.validUntil = vu
        }
        return patch
    }

    // MARK: - Helfer

    private static func isEmpty(_ patch: ClubMemberUpdate) -> Bool {
        patch.firstName == nil && patch.lastName == nil && patch.email == nil
            && patch.birthDate == nil && patch.status == nil && patch.validUntil == nil
    }

    private static func classify(_ error: Error) -> Failure {
        if let apiError = error as? APIError, apiError.isForbidden { return .forbidden }
        let message = (error as? APIError)?.errorDescription ?? error.localizedDescription
        return .other(message)
    }

    private static func isValidEmail(_ value: String) -> Bool {
        // Spiegelt EMAIL_PATTERN der Web-Referenz: lokal@domain.tld (tld ≥ 2).
        value.range(
            of: #"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$"#,
            options: .regularExpression
        ) != nil
    }
}
