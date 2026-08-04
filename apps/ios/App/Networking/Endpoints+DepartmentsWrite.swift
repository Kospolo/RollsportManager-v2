import Foundation

// ============================================================================
// Schreib-Aufrufe für das Abteilungen-Feature (Web-Referenz:
// /(portal)/abteilungen). Dünne Schicht über APIClient; Request-/Response-Typen
// ausschließlich aus den generierten Contracts (RSMContracts.swift —
// Department/DepartmentCreate/DepartmentUpdate/DepartmentMembersSet/Deleted).
//
// Die Lese-Aufrufe (`listDepartments`, `listMembers`) liegen bewusst weiter in
// Endpoints+MehrModules.swift bzw. Endpoints.swift — hier NUR die Mutationen.
//
// RECHTE (Server bleibt die Grenze — hier nur die Aufrufe): Anlegen/Ändern/
// Löschen/Mitglieder-Setzen ist Vereins-Admin. Ein 403 kommt als
// `APIError.problem` und wird im UI als Klartext-Alert behandelt.
// ============================================================================

extension APIClient {

    /// POST /departments — Abteilung anlegen (`club_id` steckt im Body). Antwort
    /// ist die erzeugte `Department` inkl. ID.
    func createDepartment(_ create: DepartmentCreate) async throws -> Department {
        try await post("/departments", body: create)
    }

    /// PATCH /departments/{departmentId} — Abteilung bearbeiten (nur gesetzte
    /// Felder im `DepartmentUpdate`). Antwort ist die aktualisierte `Department`
    /// für den Ersatz in der Liste.
    func updateDepartment(
        departmentId: String,
        _ update: DepartmentUpdate
    ) async throws -> Department {
        // Der generierte `DepartmentUpdate` lässt nil-Felder beim Kodieren WEG —
        // damit ließe sich die Leitung nie entfernen (der Server behielte die
        // alte). Wir kodieren `lead_member_id` DAHER explizit (null = entfernen),
        // die anderen Felder bleiben omit-wenn-nil (nil = nicht anfassen).
        try await patch("/departments/\(departmentId)", body: DepartmentPatchWire(update))
    }

    /// DELETE /departments/{departmentId} — Abteilung löschen. Antwort ist
    /// `Deleted` (`status` + `id`) zum Entfernen aus der Liste.
    @discardableResult
    func deleteDepartment(departmentId: String) async throws -> Deleted {
        try await delete("/departments/\(departmentId)")
    }

    /// PUT /departments/{departmentId}/members — Mitglieder als VOLL-Replace
    /// setzen (der komplette Satz an IDs geht raus; fehlende werden entfernt).
    /// Antwort ist die aktualisierte `Department` inkl. neuer `member_ids`.
    func setDepartmentMembers(
        departmentId: String,
        _ set: DepartmentMembersSet
    ) async throws -> Department {
        try await put("/departments/\(departmentId)/members", body: set)
    }
}

/// PATCH-Body für Abteilung-Bearbeiten mit korrekter Leer-Semantik: nur
/// `lead_member_id` wird explizit kodiert (null = Leitung entfernen), der Rest
/// bleibt omit-wenn-nil (nil = unverändert lassen).
private struct DepartmentPatchWire: Encodable {
    let name: String?
    let description: String?
    let leadMemberId: String?
    let sortOrder: Int?

    init(_ u: DepartmentUpdate) {
        name = u.name; description = u.description
        leadMemberId = u.leadMemberId; sortOrder = u.sortOrder
    }

    enum CodingKeys: String, CodingKey {
        case name, description
        case leadMemberId = "lead_member_id"
        case sortOrder = "sort_order"
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(name, forKey: .name)
        try c.encodeIfPresent(description, forKey: .description)
        try c.encodeIfPresent(sortOrder, forKey: .sortOrder)
        // Bewusst encode (nicht encodeIfPresent): nil -> JSON null -> entfernt.
        try c.encode(leadMemberId, forKey: .leadMemberId)
    }
}
