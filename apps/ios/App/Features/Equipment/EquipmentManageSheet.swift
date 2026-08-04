import SwiftUI

/// Ausrüstung VERWALTEN — die iOS-Fassung der Web-Dialoge (EquipmentFormDialog
/// im Bearbeiten-Modus + DeleteEquipmentDialog). Ein Sheet für alles, was der
/// Trainerstab an einem Gegenstand tut: Name/Kategorie/Zustand/Bestand/Notiz
/// ändern oder den Gegenstand löschen. Spiegel des Anlegen-Sheets
/// (`EquipmentCreateSheet`), erweitert um die vollen Felder der Web-Referenz.
/// Erfolg schließt das Sheet und meldet die Änderung zurück (Liste neu laden);
/// 403/409 bleiben als Fehlertext im Sheet. Web-Referenz:
/// ausruestung/_components/EquipmentFormDialog.tsx + DeleteEquipmentDialog.tsx.
struct EquipmentManageSheet: View {
    let api: APIClient
    let equipment: Equipment
    let onChanged: () -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var name: String
    @State private var category: String
    @State private var condition: EquipmentCondition
    @State private var totalText: String
    @State private var availableText: String
    @State private var notes: String
    @State private var saving = false
    @State private var errorMessage: String?
    @State private var showDeleteConfirm = false

    init(api: APIClient, equipment: Equipment, onChanged: @escaping () -> Void) {
        self.api = api
        self.equipment = equipment
        self.onChanged = onChanged
        _name = State(initialValue: equipment.name)
        _category = State(initialValue: equipment.category ?? "")
        _condition = State(initialValue: equipment.condition)
        _totalText = State(initialValue: equipment.totalQuantity.map(String.init) ?? "")
        _availableText = State(initialValue: equipment.availableQuantity.map(String.init) ?? "")
        _notes = State(initialValue: equipment.notes ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(text: $name) { Text(verbatim: "z. B. Pylonen (Set)") }
                } header: { Text(verbatim: "Name") }

                Section {
                    TextField(text: $category) { Text(verbatim: "z. B. Training, Technik, Sicherheit") }
                    Picker(selection: $condition) {
                        ForEach(EquipmentCondition.allCases, id: \.self) { c in
                            Text(verbatim: Self.conditionLabel(c)).tag(c)
                        }
                    } label: { Text(verbatim: "Zustand") }
                } header: { Text(verbatim: "Einordnung") }

                Section {
                    HStack {
                        Text(verbatim: "Gesamtbestand")
                        Spacer(minLength: Theme.Spacing.s4)
                        TextField(text: $totalText) { Text(verbatim: "z. B. 10") }
                            .multilineTextAlignment(.trailing)
#if os(iOS)
                            .keyboardType(.numberPad)
#endif
                    }
                    HStack {
                        Text(verbatim: "Davon verfügbar")
                        Spacer(minLength: Theme.Spacing.s4)
                        TextField(text: $availableText) { Text(verbatim: "leer = alles") }
                            .multilineTextAlignment(.trailing)
#if os(iOS)
                            .keyboardType(.numberPad)
#endif
                    }
                } header: { Text(verbatim: "Bestand") } footer: {
                    Text(verbatim: "Leer lassen = nicht erfasst · „Davon verfügbar“ darf den Gesamtbestand nicht übersteigen.")
                }

                Section {
                    TextField(text: $notes, axis: .vertical) { Text(verbatim: "Aufbewahrungsort, Zubehör … (optional)") }
                        .lineLimit(1...4)
                } header: { Text(verbatim: "Notiz") }

                if let errorMessage {
                    Section { Text(verbatim: errorMessage).foregroundStyle(Theme.Colors.danger) }
                }

                Section {
                    Button(role: .destructive) { showDeleteConfirm = true } label: {
                        Text(verbatim: "Gegenstand löschen")
                    }.disabled(saving)
                }
            }
            .navigationTitle(Text(verbatim: equipment.name))
#if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: { Text(verbatim: "Abbrechen") }.disabled(saving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button { save() } label: {
                        saving ? AnyView(ProgressView()) : AnyView(Text(verbatim: "Speichern"))
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || saving)
                }
            }
            .confirmationDialog(
                Text(verbatim: "„\(equipment.name)“ wirklich löschen?"),
                isPresented: $showDeleteConfirm, titleVisibility: .visible
            ) {
                Button(role: .destructive) { performDelete() } label: { Text(verbatim: "Gegenstand löschen") }
                Button(role: .cancel) {} label: { Text(verbatim: "Abbrechen") }
            } message: {
                Text(verbatim: "Der Gegenstand wird aus dem Bestand entfernt. Das lässt sich nicht rückgängig machen.")
            }
        }
        .presentationDragIndicator(.visible)
    }

    // MARK: - Aktionen

    /// „“ → nicht erfasst (`.some(nil)`), gültige ganze Zahl ab 0 → `.some(x)`,
    /// sonst `nil` (Eingabefehler). Analog zur Web-Referenz `parseQty`.
    private func parseQty(_ raw: String) -> Int?? {
        let trimmed = raw.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return Optional.some(nil) }
        guard let value = Int(trimmed), value >= 0 else { return nil }
        return Optional.some(value)
    }

    private func save() {
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        guard !trimmedName.isEmpty, !saving else { return }
        guard let totalQty = parseQty(totalText) else {
            errorMessage = "Gesamtbestand bitte als ganze Zahl ab 0 angeben."
            return
        }
        guard let availableQty = parseQty(availableText) else {
            errorMessage = "„Davon verfügbar“ bitte als ganze Zahl ab 0 angeben."
            return
        }
        if let available = availableQty, let total = totalQty, available > total {
            errorMessage = "„Davon verfügbar“ darf den Gesamtbestand nicht übersteigen."
            return
        }
        saving = true; errorMessage = nil
        let cat = category.trimmingCharacters(in: .whitespaces)
        let noteTrimmed = notes.trimmingCharacters(in: .whitespacesAndNewlines)
        _Concurrency.Task {
            do {
                _ = try await api.updateEquipment(equipmentId: equipment.id, EquipmentUpdate(
                    name: trimmedName,
                    category: cat.isEmpty ? nil : cat,
                    totalQuantity: totalQty,
                    availableQuantity: availableQty,
                    condition: condition,
                    notes: noteTrimmed.isEmpty ? nil : noteTrimmed
                ))
                onChanged(); dismiss()
            } catch {
                errorMessage = (error as? APIError)?.errorDescription ?? "Aktion fehlgeschlagen."
            }
            saving = false
        }
    }

    private func performDelete() {
        saving = true; errorMessage = nil
        _Concurrency.Task {
            do {
                _ = try await api.deleteEquipment(equipmentId: equipment.id)
                onChanged(); dismiss()
            } catch {
                errorMessage = (error as? APIError)?.errorDescription ?? "Aktion fehlgeschlagen."
            }
            saving = false
        }
    }

    /// Zustands-Label (deutsch), identisch zur Web-Referenz (ausruestung/i18n.ts).
    static func conditionLabel(_ c: EquipmentCondition) -> String {
        switch c {
        case .good: "Gut"
        case .fair: "Brauchbar"
        case .defect: "Defekt"
        }
    }
}
