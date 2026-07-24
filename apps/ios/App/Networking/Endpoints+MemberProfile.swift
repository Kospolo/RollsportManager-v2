import Foundation

// ============================================================================
// DAS 360-GRAD-PROFIL EINER PERSON (services/api/src/routes/member-profile.ts).
//
//   GET /clubs/{clubId}/members/{memberId}/profile  →  MemberProfile
//
// WARUM DIESE DATEI ES BRAUCHT — UND WARUM DER ROSTER DAFUER NICHT REICHT.
// Die Vereinsliste (`members(clubId:)`) liefert bereits REDIGIERTE Zeilen: was
// der/die Betrachter:in nicht sehen darf, kommt als `null`. Was sie NICHT
// liefert, ist der Unterschied zwischen den beiden Bedeutungen von `null`:
//
//   „du darfst das nicht sehen"      vs.   „da ist nichts hinterlegt"
//
// Genau diese Verwechslung war der Befund am iPhone: die Detailansicht schrieb
// in beide Faelle „Nicht hinterlegt" und machte aus einer korrekt redigierten
// Antwort ein Datenblatt mit lauter Leerstellen — es SAH aus, als wuerde etwas
// preisgegeben, obwohl der Server sauber geschwiegen hatte.
//
// Dieser Endpunkt beantwortet die Frage direkt und SERVERSEITIG:
//   contact_visible       — darf ich E-Mail/Geburtsdatum/Telefon/Anschrift sehen?
//   admin_contact_visible — darf ich die Verwaltungs-Kontaktdaten sehen?
//   self_profile_visible  — darf ich das veroeffentlichte Selbst-Profil sehen?
//   joined_on_visible     — darf ich „im Verein seit" sehen?
//   photos                — `null`, wenn KEINE wirksame Foto-Einwilligung
//                           vorliegt (app.has_internal_photo_consent), sonst
//                           die freigegebenen Galerie-Bilder dieser Person.
//
// DIE FLAGS SIND DIE WAHRHEIT, NICHT DIE ROLLE IM CLIENT. Die Detailansicht
// baut ihre Abschnitte ausschliesslich daraus auf: ein Abschnitt, den der/die
// Betrachter:in nicht sehen darf, wird gar nicht erst gerendert. Eine zweite
// Rollenlogik im Client waere ein zweiter Ort fuer dieselbe Entscheidung — und
// liefe frueher oder spaeter auseinander (dieselbe Begruendung wie in 0053).
// ============================================================================

/// Die Personenseite liest NUR, was sie zeigt.
///
/// ### WARUM HIER NICHT DER GENERIERTE `MemberProfile`-TYP STEHT ###
/// Der 360-Grad-Endpunkt liefert 18 Sektionen. Diese Ansicht rendert davon
/// FUENF (Stammkopf, die vier Flags, Galerie-Fotos) — die uebrigen dreizehn
/// (Kueren, Wettkampf, Medaillen, Anwesenheit, Check-ins, Pflichtstunden,
/// Termine, Ausruestung, Finanzen, Beurteilungen, Konsente, Rollen,
/// Abteilungen) wandern durch den Decoder, ohne je auf den Schirm zu kommen.
///
/// Das ist nicht nur Ballast, es ist ein AUSFALLRISIKO: `JSONDecoder` ist
/// alles-oder-nichts. Ein einziges Feld irgendeiner ungenutzten Sektion, das
/// nicht zum generierten Typ passt, laesst die GANZE Personenseite ins Leere
/// laufen — und weil ein Ladefehler hier (richtigerweise) die strengere
/// Sichtbarkeit erzwingt, saehe eine Mutter dann die Daten ihres eigenen
/// Kindes nicht mehr.
///
/// GENAU DAS IST PASSIERT, und zwar nicht hypothetisch:
///   `Achievement.medal` ist in der API `medalSchema.nullable()` — eine
///   Medaille darf fehlen (Teilnahmeurkunde ohne Platzierung). Beim
///   OpenAPI-Export geht die Nullbarkeit an einem `$ref` verloren
///   (openapi.json: `"medal": {"$ref": ".../Medal"}`, dazu `required`), also
///   erzeugt der Codegen `public var medal: Medal` — NICHT optional. Trifft
///   `"medal": null` ein, wirft der Decoder `valueNotFound` und der ganze
///   Aufruf fehlt.
///
/// Dieselbe Falle steckt in `AnnualCategoryRow.kind` und `BudgetReportRow.kind`
/// und trifft die Medaillen-Liste (`GET /achievements`) schon HEUTE, unabhaengig
/// von dieser Ansicht. Der saubere Ort dafuer ist die Spec, nicht dieser Client
/// — der Befund ist gemeldet, der generierte Typ bleibt unangetastet.
///
/// Diese Ansicht liest deshalb ihren eigenen, schmalen Ausschnitt. Sie ist
/// damit gegen Drift in Sektionen immun, die sie gar nicht anzeigt.
struct MemberProfileView: Decodable {
    let member: ClubMember
    let contactVisible: Bool
    let adminContactVisible: Bool
    let selfProfileVisible: Bool
    let joinedOnVisible: Bool
    /// `nil` = KEINE wirksame Foto-Einwilligung (`has_internal_photo_consent`),
    /// `[]` = eingewilligt, aber (noch) kein Bild markiert. Der Unterschied
    /// traegt die Bild-Wache — deshalb bleibt das Optional erhalten.
    let photos: [MemberPhoto]?

    enum CodingKeys: String, CodingKey {
        case member
        case contactVisible = "contact_visible"
        case adminContactVisible = "admin_contact_visible"
        case selfProfileVisible = "self_profile_visible"
        case joinedOnVisible = "joined_on_visible"
        case photos
    }
}

extension APIClient {

    /// GET /clubs/{clubId}/members/{memberId}/profile — Stammkopf + Sichtbarkeits-
    /// Flags + freigegebene Galerie-Bilder EINER Person. 404, wenn es die
    /// Person in diesem Verein nicht gibt; 403, wenn der/die Aufrufer:in dem
    /// Verein nicht angehoert.
    func memberProfileView(clubId: String, memberId: String) async throws -> MemberProfileView {
        try await get("/clubs/\(clubId)/members/\(memberId)/profile")
    }

    /// GET /chat/recipients — die Personen, denen ich ueberhaupt schreiben DARF.
    ///
    /// Der Kinderschutz (`app.chat_dm_allowed`, Migration 0043) steckt in dieser
    /// Liste: eine erwachsene Person erreicht ein Kind nur als Erziehungs-
    /// berechtigte:r oder als Trainer:in eines seiner Teams — und umgekehrt.
    /// Der Knopf „Nachricht senden" auf der Personen-Karte haengt deshalb an
    /// DIESER Liste und nicht an einer eigenen Regel: derselbe Praedikat-Aufruf
    /// traegt serverseitig auch den INSERT (RLS with-check auf /chat/messages),
    /// der Knopf kann also nie etwas anbieten, das der Server ablehnen wuerde.
    func chatRecipients(clubId: String) async throws -> [ClubMember] {
        try await get("/chat/recipients", query: [URLQueryItem(name: "club_id", value: clubId)])
    }
}
