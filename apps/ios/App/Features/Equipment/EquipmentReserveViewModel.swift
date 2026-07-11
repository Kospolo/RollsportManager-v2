import Foundation
import SwiftUI

/// Formular-State fürs Reservieren: Mitglied (nur Trainerstab wählbar), Menge
/// und Zeitraum (von/bis) → `createReservation`. Validiert im Klartext, prüft
/// die verfügbare Menge als Obergrenze und postet volle ISO-8601-`date-time`-
/// Werte. Erfolg liefert die erzeugte `EquipmentReservation` zurück; 403 und
/// 409 (Überbuchung) bleiben als Alert im Sheet.
@MainActor
final class EquipmentReserveViewModel: ObservableObject {

    struct FieldErrors: Equatable {
        var quantity: LocalizedStringKey?
        var range: LocalizedStringKey?

        var isEmpty: Bool { quantity == nil && range == nil }
    }

    // MARK: - Eingaben

    @Published var reservedByMemberId: String
    @Published var quantity: Int
    @Published var fromDate: Date
    @Published var toDate: Date

    // MARK: - Zustand

    @Published var fieldErrors = FieldErrors()
    @Published private(set) var isSaving = false
    @Published var submitError: String?

    let equipment: Equipment
    /// Verfügbare Menge (Obergrenze) — `nil` = Bestand nicht erfasst.
    let cap: Int?

    private let api: APIClient
    private let clubId: String

    init(api: APIClient, clubId: String, equipment: Equipment, defaultMemberId: String) {
        self.api = api
        self.clubId = clubId
        self.equipment = equipment
        self.cap = EquipmentDisplay.availableCap(equipment)
        self.reservedByMemberId = defaultMemberId
        self.quantity = 1
        let range = EquipmentDisplay.defaultRange()
        self.fromDate = range.from
        self.toDate = range.to
    }

    /// Obergrenze fürs Mengen-Stepper (bekannter Bestand deckelt, sonst 99).
    var quantityUpperBound: Int { max(1, cap ?? 99) }

    /// Validiert und postet. Gibt bei Erfolg die erzeugte Reservierung zurück
    /// (View schließt das Sheet); bei Fehlern `nil` (Sheet bleibt offen).
    func submit() async -> EquipmentReservation? {
        guard !isSaving else { return nil }

        var errors = FieldErrors()
        if quantity < 1 {
            errors.quantity = "ausruestung.reserve.err.qtyMin"
        } else if let cap, quantity > cap {
            errors.quantity = "ausruestung.reserve.err.qtyMax \(cap)"
        }
        if toDate <= fromDate {
            errors.range = "ausruestung.reserve.err.range"
        }
        fieldErrors = errors
        guard errors.isEmpty else { return nil }

        let input = EquipmentReservationCreate(
            clubId: clubId,
            equipmentId: equipment.id,
            reservedByMemberId: reservedByMemberId,
            quantity: quantity,
            fromAt: EquipmentISO.string(from: fromDate),
            toAt: EquipmentISO.string(from: toDate)
        )

        isSaving = true
        defer { isSaving = false }
        do {
            return try await api.createReservation(input)
        } catch {
            submitError = Self.message(for: error)
            return nil
        }
    }

    /// 403 (Rolle) und 409 (Überbuchung) bekommen verständliche Klartexte,
    /// alles andere die technische Beschreibung.
    private static func message(for error: Error) -> String {
        if let apiError = error as? APIError, case .problem(let problem) = apiError {
            switch problem.status {
            case 403: return String(localized: "ausruestung.reserve.forbidden")
            case 409: return String(localized: "ausruestung.reserve.conflict")
            default: break
            }
        }
        return (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
