import SwiftUI

/// Anlage BEARBEITEN + LÖSCHEN — die iOS-Fassung von FacilityFormDialog (Edit)
/// und DeleteFacilityDialog. Spiegel des Anlegen-Sheets (FacilityCreateSheet in
/// QuickCreateSheets), erweitert um Art/Kapazität/Notiz — dieselben Felder wie
/// das Web-Formular (FacilityUpdate). Löschen liegt als eigene, rot markierte
/// Sektion darin und wird per `confirmationDialog` bestätigt (nie automatisch).
///
/// Sichtbar nur für Vereins-Admins (Gate im Detail-Sheet); die Wahrheit bleibt
/// serverseitig — ein 403 kommt als Klartext in die Fehler-Sektion.
/// Web-Referenz: belegungsplan/_components/{FacilityFormDialog,DeleteFacilityDialog}.tsx.
struct FacilityEditSheet: View {
    @ObservedObject var model: FacilitiesViewModel
    let facility: Facility
    @Environment(\.dismiss) private var dismiss

    @State private var name: String
    @State private var kind: FacilityKind
    @State private var capacity: String
    @State private var address: String
    @State private var notes: String
    @State private var saving = false
    @State private var errorMessage: String?
    @State private var showDeleteConfirm = false

    init(model: FacilitiesViewModel, facility: Facility) {
        self.model = model
        self.facility = facility
        _name = State(initialValue: facility.name)
        _kind = State(initialValue: facility.kind)
        _capacity = State(initialValue: facility.capacity.map(String.init) ?? "")
        _address = State(initialValue: facility.address ?? "")
        _notes = State(initialValue: facility.notes ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(text: $name) { Text(verbatim: "Name (z. B. Sporthalle Nord)") }
                    Picker(selection: $kind) {
                        ForEach(BelegungDisplay.kindOrder, id: \.self) { k in
                            Text(BelegungDisplay.kindLabelKey(k)).tag(k)
                        }
                    } label: { Text(verbatim: "Art") }
                } header: { Text(verbatim: "Halle / Anlage") }

                Section {
                    TextField(text: $capacity) { Text(verbatim: "Kapazität (optional)") }
#if os(iOS)
                        .keyboardType(.numberPad)
#endif
                } footer: { Text(verbatim: "Anzahl Personen — leer lassen, wenn unbekannt.") }

                Section {
                    TextField(text: $address) { Text(verbatim: "Adresse (optional)") }
                    TextField(text: $notes, axis: .vertical) { Text(verbatim: "Hinweise (optional)") }
                        .lineLimit(1...4)
                }

                if let errorMessage {
                    Section { Text(verbatim: errorMessage).foregroundStyle(Theme.Colors.danger) }
                }

                Section {
                    Button(role: .destructive) { showDeleteConfirm = true } label: {
                        Text(verbatim: "Anlage löschen")
                    }.disabled(saving)
                }
            }
            .navigationTitle(Text(verbatim: facility.name))
#if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: { Text(verbatim: "Abbrechen") }.disabled(saving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button { save() } label: {
                        saving ? AnyView(ProgressView()) : AnyView(Text(verbatim: "Sichern"))
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || saving)
                }
            }
            .confirmationDialog(
                Text(verbatim: "Anlage „\(facility.name)“ wirklich löschen?"),
                isPresented: $showDeleteConfirm, titleVisibility: .visible
            ) {
                Button(role: .destructive) { performDelete() } label: { Text(verbatim: "Löschen") }
                Button(role: .cancel) {} label: { Text(verbatim: "Abbrechen") }
            } message: {
                Text(verbatim: "Alle Buchungen dieser Anlage werden dabei entfernt. Das lässt sich nicht rückgängig machen.")
            }
        }
    }

    // MARK: - Aktionen

    private func save() {
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        guard !trimmedName.isEmpty, !saving else { return }
        let trimmedAddress = address.trimmingCharacters(in: .whitespaces)
        let trimmedNotes = notes.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedCapacity = capacity.trimmingCharacters(in: .whitespaces)

        var capacityValue: Int?
        if !trimmedCapacity.isEmpty {
            guard let parsed = Int(trimmedCapacity), parsed > 0 else {
                errorMessage = "Kapazität bitte als ganze Zahl größer 0 oder leer lassen."
                return
            }
            capacityValue = parsed
        }

        saving = true; errorMessage = nil
        _Concurrency.Task {
            do {
                try await model.update(facilityId: facility.id, FacilityUpdate(
                    name: trimmedName,
                    kind: kind,
                    address: trimmedAddress.isEmpty ? nil : trimmedAddress,
                    capacity: capacityValue,
                    notes: trimmedNotes.isEmpty ? nil : trimmedNotes
                ))
                dismiss()
            } catch {
                errorMessage = (error as? APIError)?.errorDescription ?? "Anlage konnte nicht gesichert werden."
            }
            saving = false
        }
    }

    private func performDelete() {
        saving = true; errorMessage = nil
        _Concurrency.Task {
            do {
                try await model.delete(facilityId: facility.id)
                dismiss()
            } catch {
                errorMessage = (error as? APIError)?.errorDescription ?? "Anlage konnte nicht gelöscht werden."
            }
            saving = false
        }
    }
}
