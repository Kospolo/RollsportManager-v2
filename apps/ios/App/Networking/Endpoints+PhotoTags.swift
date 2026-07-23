import Foundation

// ============================================================================
// Foto-Markierung: „diese Person ist auf diesem Bild" (Migration 0056,
// services/api/src/routes/photo-tags.ts).
//
// ### DIE ZWEI RECHTE LIEGEN AUSEINANDER — DAS IST DER GANZE PUNKT ###
//   MARKIEREN (POST)  = Trainerstab (COACH_ROLES, ohne treasurer). Es ist ein
//                       Metadatum und braucht KEINE Einwilligung: dass ein
//                       Kind auf einem Bild ist, darf der Verein wissen.
//   ANZEIGEN am Profil = NUR mit wirksamer Einwilligung 'photos_internal'.
//                       Der Server filtert das (app.has_internal_photo_consent)
//                       — und zwar auch gegenüber dem owner.
//
// ### DESHALB GIBT ES HIER KEIN `GET /members/{id}/photos` ###
// Die Route existiert, aber sie liefert BILDER einer Person. In dieser App
// werden Kinderfotos nicht über den Mitglieder-Pfad gerendert (CLAUDE.md:
// Identität über Monogramm + Farbton). Was hier fehlt, kann niemand
// versehentlich anschliessen — dieselbe Begründung wie bei `RSMMonogramTile`,
// das gar keine `avatarUrl` entgegennimmt.
//
// Diese Datei kann also genau dreierlei: sehen, wer auf EINEM Bild markiert
// ist; jemanden markieren; eine Markierung zurücknehmen.
// ============================================================================

extension APIClient {

    /// GET /gallery/{itemId}/tags — wer ist auf diesem Bild markiert.
    ///
    /// Was zurückkommt, entscheidet die RLS: Trainerstab und Betroffene sehen
    /// alle Markierungen, alle anderen nur die eingewilligten. Eine kürzere
    /// Liste ist deshalb kein Datenverlust, sondern die Projektion.
    func listPhotoTags(itemId: String) async throws -> [PhotoTag] {
        try await get("/gallery/\(itemId)/tags")
    }

    /// POST /photo-tags — eine Person auf einem Bild markieren.
    /// 403, wenn die Rolle nicht zum Trainerstab gehört (Server entscheidet).
    func createPhotoTag(_ create: PhotoTagCreate) async throws -> PhotoTag {
        try await post("/photo-tags", body: create)
    }

    /// DELETE /photo-tags/{tagId} — Markierung zurücknehmen (Soft-Delete).
    /// Erlaubt sind die markierte Person, ein eingetragener Vormund und der
    /// Trainerstab — das Widerrufsrecht liegt bewusst NICHT nur beim Verein.
    @discardableResult
    func deletePhotoTag(tagId: String) async throws -> Deleted {
        try await delete("/photo-tags/\(tagId)")
    }
}
