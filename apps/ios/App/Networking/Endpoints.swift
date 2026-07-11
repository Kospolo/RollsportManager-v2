import Foundation

// ============================================================================
// Typisierte API-Calls — dünne Schicht über APIClient.
//
// Alle Request-/Response-Typen kommen aus den generierten Contracts
// (packages/contracts/generated/swift/RSMContracts.swift) — Lücken dort
// bitte MELDEN statt hier von Hand nachbauen. Einzige Ausnahme: /dev/login
// (bewusst nicht in der Spec, Typen in DevLogin.swift).
//
// Konvention für Screen-Teams: club-gebundene Listen nehmen die `clubId`
// aus `SessionStore.session?.profile.clubId`.
// ============================================================================

extension APIClient {

    // MARK: - Dev-Login (nur AUTH_MODE=dev, sonst 404)

    func devLogin(persona: DevPersona) async throws -> DevLoginResponse {
        try await post("/dev/login", body: DevLoginRequest(persona: persona.rawValue))
    }

    // MARK: - Mitglieder

    func members(clubId: String) async throws -> [ClubMember] {
        try await get("/clubs/\(clubId)/members")
    }

    /// GET /clubs/{clubId}/teams — Teams des Vereins inkl. Läufer-/Trainer-IDs.
    func teams(clubId: String) async throws -> [Team] {
        try await get("/clubs/\(clubId)/teams")
    }

    /// Familienmodell — RLS-scoped: owner/admin sehen alle Beziehungen,
    /// Eltern/Kinder nur die eigene Familie.
    func guardianships(clubId: String) async throws -> [Guardianship] {
        try await get("/clubs/\(clubId)/guardianships")
    }

    /// Rollenwechsel (owner/admin; nie sich selbst; letzter Owner geschützt).
    /// Verweigerung kommt als `APIError.problem` mit `status == 403`,
    /// Last-Owner-Schutz als 409.
    func changeMemberRole(
        clubId: String,
        memberId: String,
        _ change: ClubMemberRoleChange
    ) async throws -> ClubMember {
        try await patch("/clubs/\(clubId)/members/\(memberId)/role", body: change)
    }

    // MARK: - Termine + RSVP + Anwesenheit

    /// `from`/`to` als volle ISO-8601-date-time-Strings — der Server validiert
    /// strikt `date-time`, reines `yyyy-MM-dd` liefert 400 (gegen Dev-Stack
    /// verifiziert; Contract-Klärung offen).
    func events(clubId: String, from: String? = nil, to: String? = nil) async throws -> [Event] {
        var query = [URLQueryItem(name: "club_id", value: clubId)]
        if let from { query.append(URLQueryItem(name: "from", value: from)) }
        if let to { query.append(URLQueryItem(name: "to", value: to)) }
        return try await get("/events", query: query)
    }

    /// POST /events — neuen Termin anlegen (Coach und höher; `member`/`guest`
    /// bekommen ein RFC-7807-`Problem` mit `status == 403`). `starts_at`/
    /// `ends_at` müssen volle ISO-8601-`date-time`-Strings sein (Web postet
    /// dasselbe und erhält 201). Antwort ist der erzeugte `Event` inkl. ID.
    func createEvent(_ create: EventCreate) async throws -> Event {
        try await post("/events", body: create)
    }

    func putRsvp(eventId: String, _ upsert: EventRsvpUpsert) async throws -> EventRsvp {
        try await put("/events/\(eventId)/rsvp", body: upsert)
    }

    /// GET /attendance — Anwesenheiten des Vereins, optional auf einen Termin
    /// eingegrenzt (RLS: sichtbar, was die Rolle sehen darf).
    func attendance(clubId: String, eventId: String? = nil) async throws -> [Attendance] {
        var query = [URLQueryItem(name: "club_id", value: clubId)]
        if let eventId { query.append(URLQueryItem(name: "event_id", value: eventId)) }
        return try await get("/attendance", query: query)
    }

    /// PUT /events/{eventId}/attendance — Anwesenheit erfassen
    /// (Coach und höher, inkl. guest_coach).
    func putAttendance(eventId: String, _ upsert: AttendanceUpsert) async throws -> Attendance {
        try await put("/events/\(eventId)/attendance", body: upsert)
    }

    // MARK: - Finanzen

    func invoices(clubId: String) async throws -> [Invoice] {
        try await get("/invoices", query: [URLQueryItem(name: "club_id", value: clubId)])
    }

    /// Mahnlauf — Default ist Dry-Run (`DunningRunRequest(dryRun: true)`).
    /// Scharfe Läufe nur nach expliziter Freigabe im UI (Kontroll-Mikrocopy!).
    func dunningRun(clubId: String, _ request: DunningRunRequest) async throws -> DunningRunResult {
        try await post("/clubs/\(clubId)/dunning/run", body: request)
    }

    // MARK: - Küren

    func routines(clubId: String) async throws -> [Routine] {
        try await get("/routines", query: [URLQueryItem(name: "club_id", value: clubId)])
    }

    func routine(id: String) async throws -> Routine {
        try await get("/routines/\(id)")
    }

    func routineMarkers(routineId: String) async throws -> [RoutineMarker] {
        try await get("/routines/\(routineId)/markers")
    }

    /// POST /routines/{id}/markers — Zeitmarke an einer Abspielposition setzen
    /// (Coach und höher; sonst `Problem` mit `status == 403`). `time_ms` ist
    /// die Position in Millisekunden. Antwort ist der erzeugte `RoutineMarker`
    /// inkl. ID (für den optimistischen Einschub in die Marker-Liste).
    func addRoutineMarker(
        routineId: String,
        _ create: RoutineMarkerCreate
    ) async throws -> RoutineMarker {
        try await post("/routines/\(routineId)/markers", body: create)
    }

    func routineScores(routineId: String) async throws -> [RoutineScore] {
        try await get("/routines/\(routineId)/scores")
    }

    // MARK: - Wettkämpfe

    func competitions(clubId: String) async throws -> [Competition] {
        try await get("/competitions", query: [URLQueryItem(name: "club_id", value: clubId)])
    }

    // MARK: - Aufgaben
    //
    // Achtung: `Task` ist hier der Contracts-Struct (app.tasks), nicht
    // Swift-Concurrency — für Concurrency in App-Code `_Concurrency.Task`
    // schreiben (siehe SessionStore).

    func tasks(clubId: String) async throws -> [Task] {
        try await get("/tasks", query: [URLQueryItem(name: "club_id", value: clubId)])
    }

    func setTaskDone(taskId: String, done: Bool) async throws -> Task {
        try await patch("/tasks/\(taskId)", body: TaskUpdate(done: done))
    }

    // MARK: - News
    //
    // Web-Referenz: /(portal)/news. Liste ist server-sortiert
    // (angepinnt zuerst, dann neueste veröffentlichte). Schreiben nur
    // Trainerstab (COACH_ROLES) — `member`/`guest` erhalten 403.

    /// GET /news — Vereins-News, sichtbar für alle Mitglieder.
    func listNews(clubId: String) async throws -> [News] {
        try await get("/news", query: [URLQueryItem(name: "club_id", value: clubId)])
    }

    /// POST /news — News anlegen (Trainerstab; sonst `Problem` mit 403).
    /// `clubId` steckt im `NewsCreate` (analog zu `createEvent`).
    func createNews(_ create: NewsCreate) async throws -> News {
        try await post("/news", body: create)
    }

    // MARK: - Chat
    //
    // Web-Referenz: /(portal)/chat. Kanäle = Team-Kanäle (Mitgliedschaft)
    // + Direkt-Threads. Nachrichten chronologisch aufsteigend. Absender ist
    // serverseitig immer der Aufrufer.

    /// GET /chat/channels — meine Kanäle inkl. letzter Nachricht je Kanal.
    func listChatChannels(clubId: String) async throws -> [ChatChannel] {
        try await get("/chat/channels", query: [URLQueryItem(name: "club_id", value: clubId)])
    }

    /// GET /chat/messages — Nachrichten EINES Kanals.
    /// - `channelType == .team` verlangt `teamId` (sonst 400),
    /// - `channelType == .direct` verlangt `peerMemberId` (sonst 400).
    func listChatMessages(
        clubId: String,
        channelType: ChatChannelType,
        teamId: String? = nil,
        peerMemberId: String? = nil
    ) async throws -> [ChatMessage] {
        var query = [
            URLQueryItem(name: "club_id", value: clubId),
            URLQueryItem(name: "channel_type", value: channelType.rawValue),
        ]
        if let teamId { query.append(URLQueryItem(name: "team_id", value: teamId)) }
        if let peerMemberId { query.append(URLQueryItem(name: "peer_member_id", value: peerMemberId)) }
        return try await get("/chat/messages", query: query)
    }

    /// POST /chat/messages — Nachricht senden (Team-Kanal oder Direkt).
    /// `clubId`/`channelType`/Ziel stecken im `ChatMessageCreate`.
    func sendChatMessage(_ create: ChatMessageCreate) async throws -> ChatMessage {
        try await post("/chat/messages", body: create)
    }

    // MARK: - Medaillen (Achievements)
    //
    // Web-Referenz: /(portal)/medaillen. Liste server-sortiert nach
    // `achieved_on` desc. Optionaler `memberId`-Filter. Schreiben nur
    // Trainerstab (COACH_ROLES).

    /// GET /achievements — Medaillen des Vereins, optional auf ein Mitglied gefiltert.
    func listAchievements(clubId: String, memberId: String? = nil) async throws -> [Achievement] {
        var query = [URLQueryItem(name: "club_id", value: clubId)]
        if let memberId { query.append(URLQueryItem(name: "member_id", value: memberId)) }
        return try await get("/achievements", query: query)
    }

    /// POST /achievements — Medaille vergeben (Trainerstab; sonst 403).
    /// `clubId`/`memberId` stecken im `AchievementCreate`.
    func createAchievement(_ create: AchievementCreate) async throws -> Achievement {
        try await post("/achievements", body: create)
    }

    // MARK: - Trainingsplan (TrainingSlots)
    //
    // Web-Referenz: /(portal)/trainingsplan. Wöchentliche Slots,
    // server-sortiert nach Wochentag + Startzeit; optionaler `teamId`-Filter.

    /// GET /training-slots — wöchentliche Trainings-Slots des Vereins.
    func listTrainingSlots(clubId: String, teamId: String? = nil) async throws -> [TrainingSlot] {
        var query = [URLQueryItem(name: "club_id", value: clubId)]
        if let teamId { query.append(URLQueryItem(name: "team_id", value: teamId)) }
        return try await get("/training-slots", query: query)
    }

    // MARK: - Übungen (Exercises)
    //
    // Web-Referenz: /(portal)/uebungen. Übungs-Bibliothek des Vereins,
    // optional nach Kategorie gefiltert. Schreiben nur Trainerstab
    // (is_club_trainer) — hier vorerst nur die Leseliste.

    /// GET /exercises — Übungen des Vereins, optional auf eine `category`
    /// (ExerciseCategory) eingegrenzt. Sichtbar für alle Mitglieder.
    func listExercises(clubId: String, category: ExerciseCategory? = nil) async throws -> [Exercise] {
        var query = [URLQueryItem(name: "club_id", value: clubId)]
        if let category { query.append(URLQueryItem(name: "category", value: category.rawValue)) }
        return try await get("/exercises", query: query)
    }

    // MARK: - Familie (Guardianships)
    //
    // Web-Referenz: /(portal)/familie. Das Familienmodell nutzt zwei bereits
    // bestehende Calls (siehe oben): `guardianships(clubId:)` liefert die
    // Eltern-/Kind-Beziehungen (RLS-scoped), `members(clubId:)` die
    // Mitglieder-Stammdaten zum Auflösen der IDs. Deshalb hier bewusst keine
    // Duplikate — das Familie-Team ruft `guardianships` + `members`.

    /// Alias auf `guardianships(clubId:)` — semantisch die Familie-Liste.
    /// Existiert, damit der im Auftrag genannte Name aufrufbar ist.
    func listGuardianships(clubId: String) async throws -> [Guardianship] {
        try await guardianships(clubId: clubId)
    }

    /// Alias auf `members(clubId:)` — Mitglieder zum Auflösen der Familie-IDs.
    func listMembers(clubId: String) async throws -> [ClubMember] {
        try await members(clubId: clubId)
    }

    // MARK: - Pflichtstunden (Duty)
    //
    // Web-Referenz: /(portal)/pflichtstunden. Zwei Ebenen: das Soll
    // (DutyRequirement, je Verein/Team/Mitglied) und die Ist-Einträge
    // (DutyEntry). Mitglieder erfassen eigene Stunden; Trainerstab alle.

    /// GET /duty-requirements — Soll-Vorgaben des Vereins, optional je Team.
    func listDutyRequirements(clubId: String, teamId: String? = nil) async throws -> [DutyRequirement] {
        var query = [URLQueryItem(name: "club_id", value: clubId)]
        if let teamId { query.append(URLQueryItem(name: "team_id", value: teamId)) }
        return try await get("/duty-requirements", query: query)
    }

    /// GET /duty-entries — erfasste Stunden. Ohne `memberId` liefert der Server
    /// die eigenen Einträge (Mitglied) bzw. alle (Trainerstab); mit `memberId`
    /// die eines Mitglieds (nur mit Berechtigung, sonst RLS-gefiltert).
    func listDutyEntries(clubId: String, memberId: String? = nil) async throws -> [DutyEntry] {
        var query = [URLQueryItem(name: "club_id", value: clubId)]
        if let memberId { query.append(URLQueryItem(name: "member_id", value: memberId)) }
        return try await get("/duty-entries", query: query)
    }

    /// POST /duty-entries — Stunden erfassen. `clubId`/`memberId`/`hours`/
    /// `activityDate` stecken im `DutyEntryCreate` (analog zu `createEvent`).
    /// `approved` setzt nur der Trainerstab — Mitglieder-Einträge, die `true`
    /// senden, quittiert der Server/DB-Trigger mit `Problem` (403/42501).
    func createDutyEntry(_ create: DutyEntryCreate) async throws -> DutyEntry {
        try await post("/duty-entries", body: create)
    }

    // MARK: - Auswertung (Reports)
    //
    // Web-Referenz: /(portal)/auswertung. Ein aggregiertes Kennzahlen-Objekt
    // (Mitglieder nach Rolle/Team, Anwesenheitsquote, offene Rechnungen,
    // Medaillenspiegel, kommende Termine). Nur Trainerstab/Admin —
    // `member`/`guest` erhalten `Problem` mit `status == 403`.

    /// GET /reports/summary — aggregierte Vereins-Auswertung.
    func getReportsSummary(clubId: String) async throws -> ReportSummary {
        try await get("/reports/summary", query: [URLQueryItem(name: "club_id", value: clubId)])
    }
}
