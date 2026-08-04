import SwiftUI

/// Eine bestehende Trainingszeit BEARBEITEN oder LÖSCHEN — Spiegel des
/// Anlegen-Sheets (`TrainingSlotCreateSheet`): Wochentag, Beginn, Ende, Ort.
/// Das Löschen liegt hier im Sheet (Button role: .destructive +
/// confirmationDialog), es wird BEWUSST nie automatisch bestätigt.
///
/// Nur für den Trainerstab (Gate wie beim „+" dieses Moduls,
/// `session.permissions.isTrainer`) — die Wahrheit bleibt serverseitig
/// (RLS/is_club_trainer). Web-Referenz: _components/SlotFormDialog.tsx +
/// DeleteSlotDialog.tsx.
struct TrainingSlotEditSheet: View {
    let api: APIClient
    let slot: TrainingSlot
    /// Erfolgreiches Sichern liefert den aktualisierten Slot zurück.
    let onUpdated: (TrainingSlot) -> Void
    /// Erfolgreiches Löschen liefert die gelöschte ID zurück.
    let onDeleted: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var weekday: Int
    @State private var start: Date
    @State private var end: Date
    @State private var location: String
    @State private var saving = false
    @State private var deleting = false
    @State private var confirmDelete = false
    @State private var errorMessage: String?

    private let days = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]

    init(
        api: APIClient,
        slot: TrainingSlot,
        onUpdated: @escaping (TrainingSlot) -> Void,
        onDeleted: @escaping (String) -> Void
    ) {
        self.api = api
        self.slot = slot
        self.onUpdated = onUpdated
        self.onDeleted = onDeleted
        _weekday = State(initialValue: slot.weekday)
        _start = State(initialValue: Self.parseTime(slot.startsTime))
        _end = State(initialValue: Self.parseTime(slot.endsTime))
        _location = State(initialValue: slot.location ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker(selection: $weekday) { ForEach(0..<7, id: \.self) { Text(verbatim: days[$0]).tag($0) } } label: { Text(verbatim: "Wochentag") }
                    DatePicker(selection: $start, displayedComponents: .hourAndMinute) { Text(verbatim: "Beginn") }
                    DatePicker(selection: $end, displayedComponents: .hourAndMinute) { Text(verbatim: "Ende") }
                    TextField(text: $location) { Text(verbatim: "Ort (optional)") }
                } header: { Text(verbatim: "Trainingszeit") }
                if let errorMessage { Section { Text(verbatim: errorMessage).foregroundStyle(Theme.Colors.danger) } }
                Section {
                    Button(role: .destructive) { confirmDelete = true } label: { Text(verbatim: "Trainingszeit löschen") }
                        .disabled(saving || deleting)
                }
            }
            .navigationTitle(Text(verbatim: "Trainingszeit bearbeiten"))
#if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button { dismiss() } label: { Text(verbatim: "Abbrechen") }.disabled(saving || deleting) }
                ToolbarItem(placement: .confirmationAction) {
                    Button { save() } label: { saving ? AnyView(ProgressView()) : AnyView(Text(verbatim: "Sichern")) }
                        .disabled(saving || deleting)
                }
            }
            .confirmationDialog(Text(verbatim: "Trainingszeit löschen?"), isPresented: $confirmDelete, titleVisibility: .visible) {
                Button(role: .destructive) { performDelete() } label: { Text(verbatim: "Löschen") }
                Button(role: .cancel) {} label: { Text(verbatim: "Abbrechen") }
            } message: {
                Text(verbatim: "Diese Trainingszeit wird dauerhaft entfernt.")
            }
        }
    }

    // MARK: - Aktionen

    private func save() {
        guard !saving, !deleting else { return }
        saving = true; errorMessage = nil
        let loc = location.trimmingCharacters(in: .whitespaces)
        _Concurrency.Task {
            do {
                let updated = try await api.updateTrainingSlot(id: slot.id, TrainingSlotUpdate(
                    weekday: weekday,
                    startsTime: QuickCreateFormat.time(start),
                    endsTime: QuickCreateFormat.time(end),
                    location: loc.isEmpty ? nil : loc))
                onUpdated(updated); dismiss()
            } catch {
                errorMessage = (error as? APIError)?.errorDescription ?? "Sichern fehlgeschlagen."
            }
            saving = false
        }
    }

    private func performDelete() {
        guard !saving, !deleting else { return }
        deleting = true; errorMessage = nil
        _Concurrency.Task {
            do {
                _ = try await api.deleteTrainingSlot(id: slot.id)
                onDeleted(slot.id); dismiss()
            } catch {
                errorMessage = (error as? APIError)?.errorDescription ?? "Löschen fehlgeschlagen."
            }
            deleting = false
        }
    }

    // MARK: - Helfer

    /// 'HH:MM:SS' | 'HH:MM' → Date (heute, nur Stunde/Minute) für den DatePicker.
    private static func parseTime(_ time: String) -> Date {
        let parts = time.split(separator: ":")
        let hour = parts.count > 0 ? Int(parts[0]) ?? 0 : 0
        let minute = parts.count > 1 ? Int(parts[1]) ?? 0 : 0
        return Calendar.current.date(from: DateComponents(hour: hour, minute: minute)) ?? Date()
    }
}
