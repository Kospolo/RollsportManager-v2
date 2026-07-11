import Foundation

// ============================================================================
// Typisierte API-Calls für die vier neuen Portal-Module —
// Schließfächer · Wartelisten · Budget · Profil (inkl. Einstellungen).
//
// Muster wie in Endpoints.swift: dünne Schicht über APIClient, Request-/
// Response-Typen ausschließlich aus den generierten Contracts
// (packages/contracts/generated/swift/RSMContracts.swift). Club-gebundene
// Listen nehmen die `clubId` aus `SessionStore.session?.profile.clubId`.
//
// HINWEIS an die Contracts-/Feature-Teams (Namens-Mapping): Der Auftrag nennt
// die Typen `WaitlistEntry` und `MyProfile`; die generierten Contracts heißen
// `Waitlist` (Eintrag) bzw. `Me`/`MeUpdate` (eigenes Profil). Hier werden die
// tatsächlich generierten Namen benutzt — kein Handnachbau.
// ============================================================================

extension APIClient {

    // MARK: - Schließfächer (Lockers)
    //
    // Web-Referenz: /(portal)/schliessfaecher. Schließfach-Inventar des Vereins
    // (Locker) mit Status frei/belegt/defekt und optionaler Zuordnung zu einem
    // Mitglied (`assignedMemberId`). Schreiben/Zuweisen nur berechtigte Rollen —
    // hier vorerst die Leseliste (POST/PATCH/assign/release liegen im Contract
    // bereit: LockerCreate/LockerUpdate/LockerAssign).

    /// GET /lockers — Schließfächer des Vereins inkl. Status + Zuordnung.
    func listLockers(clubId: String) async throws -> [Locker] {
        try await get("/lockers", query: [URLQueryItem(name: "club_id", value: clubId)])
    }

    // MARK: - Wartelisten (Waitlists)
    //
    // Web-Referenz: /(portal)/wartelisten. Warteschlangen des Vereins
    // (Waitlist) je `kind` (facility/equipment/team/event), optional gefiltert.
    // Eintreten = POST (WaitlistCreate), Austreten = DELETE → `Deleted`.

    /// GET /waitlists — Wartelisten-Einträge des Vereins, optional je `kind`.
    func listWaitlists(clubId: String, kind: WaitlistKind? = nil) async throws -> [Waitlist] {
        var query = [URLQueryItem(name: "club_id", value: clubId)]
        if let kind { query.append(URLQueryItem(name: "kind", value: kind.rawValue)) }
        return try await get("/waitlists", query: query)
    }

    /// POST /waitlists — auf eine Warteliste setzen. `clubId`/`memberId`/`kind`
    /// und optional `targetId`/`note` stecken im `WaitlistCreate`. Antwort ist
    /// der erzeugte `Waitlist`-Eintrag inkl. ID + `status`.
    func joinWaitlist(_ input: WaitlistCreate) async throws -> Waitlist {
        try await post("/waitlists", body: input)
    }

    /// DELETE /waitlists/{waitlistId} — Wartelisten-Eintrag verlassen. Antwort
    /// ist `Deleted` (`status` + `id`) für das optimistische Entfernen aus der
    /// Liste. Fremder Eintrag ⇒ `Problem` mit 403/404 (RLS).
    @discardableResult
    func leaveWaitlist(id: String) async throws -> Deleted {
        try await delete("/waitlists/\(id)")
    }

    // MARK: - Budget (Finanzen)
    //
    // Web-Referenz: /(portal)/finanzen/budget. Nur `can_manage_finance`
    // (owner/admin/treasurer) — andere Rollen erhalten `Problem` mit 403.
    // Zwei Ebenen: die Plan-Zeilen (Budget je Kategorie/Jahr) und der
    // aggregierte Soll-/Ist-Bericht (BudgetReport, Plan vs. Ist je Kategorie).

    /// GET /budgets — Budget-Planzeilen des Vereins für ein `year`
    /// (beide Parameter Pflicht). `can_manage_finance`, sonst 403.
    func listBudgets(clubId: String, year: Int) async throws -> [Budget] {
        try await get("/budgets", query: [
            URLQueryItem(name: "club_id", value: clubId),
            URLQueryItem(name: "year", value: String(year)),
        ])
    }

    /// GET /reports/budget — aggregierter Soll-/Ist-Bericht (Plan vs. Ist je
    /// Kategorie inkl. Summen + Abweichung) für ein `year`. `can_manage_finance`.
    func getBudgetReport(clubId: String, year: Int) async throws -> BudgetReport {
        try await get("/reports/budget", query: [
            URLQueryItem(name: "club_id", value: clubId),
            URLQueryItem(name: "year", value: String(year)),
        ])
    }

    // MARK: - Profil + Einstellungen (Me / Preferences)
    //
    // Web-Referenz: /(portal)/profil + /(portal)/einstellungen. Beides ist an
    // den eingeloggten Nutzer gebunden (kein club_id-Parameter): das Profil
    // (`Me` inkl. aller Mitgliedschaften) und die App-Einstellungen
    // (`UserPreferences`: Sprache, Theme, Benachrichtigungen).

    /// GET /me — eigenes Profil inkl. Mitgliedschaften.
    func getMyProfile() async throws -> Me {
        try await get("/me")
    }

    /// PATCH /me — eigenes Profil teilweise ändern (nur gesetzte Felder im
    /// `MeUpdate`: Vor-/Nachname, E-Mail, Geburtsdatum). Antwort ist das
    /// aktualisierte `Me`.
    func updateMyProfile(_ patch: MeUpdate) async throws -> Me {
        try await self.patch("/me", body: patch)
    }

    /// GET /me/preferences — App-Einstellungen des Nutzers.
    func getMyPreferences() async throws -> UserPreferences {
        try await get("/me/preferences")
    }

    /// PATCH /me/preferences — Einstellungen teilweise ändern (nur gesetzte
    /// Felder im `UserPreferencesUpdate`: `locale`, `theme`, `notifications`).
    /// Antwort sind die aktualisierten `UserPreferences`.
    func updateMyPreferences(_ patch: UserPreferencesUpdate) async throws -> UserPreferences {
        try await self.patch("/me/preferences", body: patch)
    }
}
