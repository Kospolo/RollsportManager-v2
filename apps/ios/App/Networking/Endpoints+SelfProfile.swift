import Foundation

// ============================================================================
// Typisierte API-Calls für das ÖFFENTLICHE SELBST-PROFIL (Migration 0045/0053).
// Web-Referenz: apps/web/app/(portal)/profil/_components/SelfProfileCard.tsx.
//
// EIN Endpunkt: PATCH /clubs/{clubId}/members/{memberId}/profile → app.set_self_profile.
// Request-Typ ist der generierte `ClubMemberSelfProfileUpdate`, Antwort der
// aktualisierte `ClubMember` (mit den `profile_*`-Feldern).
//
// SEMANTIK (serverseitig, nicht hier):
//   - Fehlender Schlüssel  = unverändert (ECHTER Teil-Patch)
//   - null oder ""         = Angabe löschen
//   - `visibility` ist NICHT nullbar — eine Stufe hat kein „leer".
//
// WER DARF: NUR die Person selbst bzw. (bei Kindern ohne Konto) ihre
// Erziehungsberechtigten — app.can_act_for_member. Verwalter dürfen fremde
// Selbst-Profile ausdrücklich NICHT beschreiben; sie erhalten 403. Die
// Kontaktdaten-Leitplanke (E-Mail/Telefon/Link im Text) quittiert der Server
// mit 422 im Klartext.
//
// GELESEN wird das Selbst-Profil über die ohnehin geladene Vereinsliste
// (`members(clubId:)`): die EIGENE Zeile trägt die `profile_*`-Werte auch dann,
// wenn die Stufe „intern" ist (gegen den Dev-Stack verifiziert) — es braucht
// dafür also KEINEN zusätzlichen Endpunkt.
// ============================================================================

extension APIClient {

    /// Maximallängen — deckungsgleich mit den CHECK-Constraints (0045) und der
    /// Zod-Prüfung der API. Das UI meldet zu lange Eingaben vorab, statt ein
    /// 422 zu provozieren.
    enum SelfProfileLimits {
        static let mottoMax = 140
        static let disciplineMax = 60
        static let skatingSinceMin = 1900
        /// Der Server erlaubt bis „aktuelles Jahr + 1".
        static var skatingSinceMax: Int { Calendar.current.component(.year, from: Date()) + 1 }
    }

    /// PATCH /clubs/{clubId}/members/{memberId}/profile — Selbst-Profil setzen.
    ///
    /// Es wird NUR gesendet, was im `update` gesetzt ist (Teil-Patch). Zum
    /// LÖSCHEN von Motto/Disziplin genügt der Leerstring — der Server behandelt
    /// `""` wie `null`.
    ///
    /// `clearSkatingSince` ist die Ausnahme: `ClubMemberSelfProfileUpdate`
    /// trägt `skatingSince` als nicht-nullbares `Int?`, ein `nil` würde beim
    /// Encodieren WEGGELASSEN (= unverändert) statt als `null` gesendet. Um das
    /// Jahr wieder zu leeren, wird der Schlüssel deshalb explizit als `null`
    /// ergänzt. (Contract-Lücke, gemeldet — dieselbe Klasse wie bei `MeUpdate`.)
    func setSelfProfile(
        clubId: String,
        memberId: String,
        _ update: ClubMemberSelfProfileUpdate,
        clearSkatingSince: Bool = false
    ) async throws -> ClubMember {
        var body = try Self.jsonObject(from: update)
        if clearSkatingSince { body["skating_since"] = .null }
        return try await patch("/clubs/\(clubId)/members/\(memberId)/profile", body: body)
    }

    /// Contract-Struct → `[String: JSONValue]`, damit ein explizites `null`
    /// ergänzt werden kann, ohne den generierten Typ zu umgehen: die Feldnamen
    /// und die Auslassungs-Semantik kommen weiterhin vom Contract.
    private static func jsonObject(
        from update: ClubMemberSelfProfileUpdate
    ) throws -> [String: JSONValue] {
        let data = try JSONEncoder().encode(update)
        return try JSONDecoder().decode([String: JSONValue].self, from: data)
    }
}
