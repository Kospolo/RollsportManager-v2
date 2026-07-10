import Foundation

// ============================================================================
// TEMPORÄRER BUILD-SHIM — bitte entfernen, sobald die Contracts neu generiert
// sind. NICHT die Generated-Contracts editieren (die sind READ-ONLY).
//
// PROBLEM (Codegen-Defekt, gemeldet an das Contracts-Team):
//   RSMContracts.swift referenziert den Typ `Weekday`
//   (TrainingSlot.weekday / TrainingSlotCreate / TrainingSlotUpdate), aber der
//   Swift-Generator emittiert die Definition NICHT. In der OpenAPI-Spec ist
//   `Weekday` ein *benannter Skalar*:
//       "Weekday": { "type": "integer", "minimum": 0, "maximum": 6 }
//   Für benannte Skalar-Schemas müsste der Swift-Generator ein
//       public typealias Weekday = Int
//   ausgeben (analog zum Kotlin-Output) — tut er aber nicht, wodurch das
//   gesamte Target nicht kompiliert („cannot find type 'Weekday' in scope“).
//
// FIX (Contracts-Team): Swift-Template so ergänzen, dass benannte
//   Integer-/String-Skalare als `typealias` erzeugt werden, danach
//   `npm run generate` in packages/contracts. Sobald die Generated-Datei den
//   Alias selbst enthält, DIESE Datei löschen (sonst Redeklaration).
//
// Der Shim spiegelt die Spec 1:1 (0 = Montag … 6 = Sonntag) und trifft KEINE
// eigene Contract-Entscheidung — er macht nur den vom Generator gedroppten
// Alias sichtbar, damit die vier neuen Module gebaut/verifiziert werden können.
// ============================================================================

public typealias Weekday = Int
