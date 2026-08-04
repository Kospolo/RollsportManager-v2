import Foundation

/// Schreib-Endpunkte der Übungsbibliothek (Bearbeiten/Löschen). Das Anlegen
/// (`createExercise`) liegt weiterhin in `Endpoints.swift`; hier kommen nur die
/// bisher fehlenden iOS-Aktionen dazu, damit Trainer:innen dieselben Schreib-
/// Rechte wie im Web haben. Rechte-Wahrheit bleibt serverseitig (RLS/403).
/// Web-Referenz: apps/web/app/(portal)/uebungen (data.updateExercise/
/// data.deleteExercise).
extension APIClient {

    /// PATCH /exercises/{exerciseId} — aktualisiert eine Übung und liefert den
    /// neuen Stand zurück. 403 = nicht berechtigt (nur Trainer:innen).
    func updateExercise(_ exerciseId: String, _ input: ExerciseUpdate) async throws -> Exercise {
        try await patch("/exercises/\(exerciseId)", body: input)
    }

    /// DELETE /exercises/{exerciseId} — entfernt eine Übung. 403 = nicht
    /// berechtigt (nur Trainer:innen).
    @discardableResult
    func deleteExercise(_ exerciseId: String) async throws -> Deleted {
        try await delete("/exercises/\(exerciseId)")
    }
}
