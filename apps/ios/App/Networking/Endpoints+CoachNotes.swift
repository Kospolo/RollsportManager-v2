import Foundation

// ============================================================================
// INTERNE TRAINER-NOTIZEN über ein Mitglied (Migration 0069,
// services/api/src/routes/coach-notes.ts).
//
// ### DAS IST DAS DRITTE DING — NICHT DIE ANDEREN ZWEI ###
//   `listNotes()` (Endpoints+MehrModules) = persönlicher Zettel, über niemanden.
//   Beurteilungen (assessments)           = offizielle Rückmeldung; die FAMILIE
//                                           liest sie, bewusst.
//   HIER                                  = interne Arbeitsnotiz. Mitglied und
//                                           Eltern sehen sie NICHT.
//
// ### DIE FAMILIE IST STRUKTURELL AUSSEN ###
// `app.can_read_coach_note` beginnt mit `not app.can_act_for_member(...)`: die
// betroffene Person und ihre Erziehungsberechtigten sind IMMER ausgeschlossen —
// auch wenn sie zugleich Vorstand oder Trainer:in sind. Für sie ist die Antwort
// eine LEERE LISTE, kein Fehler: ein Fehler wäre schon die Auskunft „da ist
// etwas, du darfst nur nicht".
//
// ### DESHALB HÄNGEN DIE NOTIZEN AN KEINER SAMMELROUTE ###
// Sie stehen bewusst NICHT im Profil-Aggregat (`/members/{id}/profile`) — das
// ist genau die Route, die ein Elternteil für sein Kind öffnet. Wer sie in
// eine Liste, einen Export oder eine Suche zieht, umgeht die Regel, auch wenn
// die RLS filtert. Diese Datei ruft daher genau EINE gezielte Route auf, immer
// mit `member_id`.
// ============================================================================

extension APIClient {

    /// GET /coach-notes?club_id&member_id — die internen Notizen ÜBER EIN
    /// Mitglied, absteigend nach Datum. Was zurückkommt, entscheidet die RLS.
    func listCoachNotes(clubId: String, memberId: String) async throws -> [MemberCoachNote] {
        try await get("/coach-notes", query: [
            URLQueryItem(name: "club_id", value: clubId),
            URLQueryItem(name: "member_id", value: memberId),
        ])
    }

    /// POST /coach-notes — Notiz schreiben. Erlaubt sind Trainer:innen dieses
    /// Mitglieds und die Vereinsleitung — nie über sich selbst oder das eigene
    /// Kind (403 mit erklärendem Text).
    func createCoachNote(_ create: MemberCoachNoteCreate) async throws -> MemberCoachNote {
        try await post("/coach-notes", body: create)
    }

    /// PATCH /coach-notes/{noteId} — Text ändern. Nur die Autor:in oder die
    /// Vereinsleitung (`coach_notes:manage`).
    func updateCoachNote(noteId: String, body: String) async throws -> MemberCoachNote {
        try await patch("/coach-notes/\(noteId)", body: MemberCoachNoteUpdate(body: body))
    }

    /// DELETE /coach-notes/{noteId} — Notiz löschen (Soft-Delete beim Server).
    @discardableResult
    func deleteCoachNote(noteId: String) async throws -> Deleted {
        try await delete("/coach-notes/\(noteId)")
    }
}
