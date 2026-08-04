import Foundation

// Schreib-Endpunkte des Trainingsplan-Moduls (Bearbeiten + Löschen einer
// Trainingszeit). Anlegen liegt bereits in Endpoints.swift
// (createTrainingSlot). Web-Referenz: /(portal)/trainingsplan
// (_components/SlotFormDialog.tsx + DeleteSlotDialog.tsx). Recht erzwingt der
// Server (RLS/is_club_trainer) — die iOS-Sichtbarkeit ist nur Komfort.

extension APIClient {

    /// PATCH /training-slots/{slotId} — Trainingszeit ändern. Antwort ist der
    /// aktualisierte Slot.
    func updateTrainingSlot(id: String, _ patch: TrainingSlotUpdate) async throws -> TrainingSlot {
        try await self.patch("/training-slots/\(id)", body: patch)
    }

    /// DELETE /training-slots/{slotId} — Trainingszeit löschen. Antwort ist
    /// `Deleted` (enthält die gelöschte ID).
    func deleteTrainingSlot(id: String) async throws -> Deleted {
        try await delete("/training-slots/\(id)")
    }
}
