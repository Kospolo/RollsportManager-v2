import SwiftUI

/// „Überregionalen Termin bearbeiten“ als Sheet — Spiegel des Anlegen-Sheets
/// (RegionalEventCreateSheet in QuickCreateSheets), nur mit vorbelegten Feldern
/// und dem vollen Feldsatz, den die Detail-Ansicht auch zeigt (Disziplin,
/// Ausrichter, Ort, Zeitspanne, Anmelde-Link, Beschreibung). Löschen liegt in
/// diesem Sheet hinter einem `.confirmationDialog`. Schreiben ist serverseitig
/// auf die Vereinsleitung (is_club_admin) beschränkt; ein 403 kommt als
/// Klartext zurück. Web-Referenz: events/_components/RegionalEventFormSheet.tsx
/// und DeleteRegionalEventDialog.tsx.
struct RegionalEventEditSheet: View {
    let api: APIClient
    let event: RegionalEvent
    let onSaved: () -> Void
    let onDeleted: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var title: String
    @State private var discipline: String
    @State private var hostOrg: String
    @State private var location: String
    @State private var startsOn: Date
    @State private var hasEnd: Bool
    @State private var endsOn: Date
    @State private var registrationUrl: String
    @State private var description: String

    @State private var saving = false
    @State private var deleting = false
    @State private var showDeleteConfirm = false
    @State private var errorMessage: String?

    init(api: APIClient, event: RegionalEvent, onSaved: @escaping () -> Void, onDeleted: @escaping () -> Void) {
        self.api = api
        self.event = event
        self.onSaved = onSaved
        self.onDeleted = onDeleted
        _title = State(initialValue: event.title)
        _discipline = State(initialValue: event.discipline ?? "")
        _hostOrg = State(initialValue: event.hostOrg ?? "")
        _location = State(initialValue: event.location ?? "")
        _startsOn = State(initialValue: RegionalEventDate.date(from: event.startsOn) ?? Date())
        _hasEnd = State(initialValue: event.endsOn != nil)
        _endsOn = State(initialValue: RegionalEventDate.date(from: event.endsOn ?? event.startsOn)
            ?? RegionalEventDate.date(from: event.startsOn) ?? Date())
        _registrationUrl = State(initialValue: event.registrationUrl ?? "")
        _description = State(initialValue: event.description ?? "")
    }

    private var trimmedTitle: String { title.trimmingCharacters(in: .whitespaces) }
    private var busy: Bool { saving || deleting }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(text: $title) { Text(verbatim: "Titel") }
                    TextField(text: $discipline) { Text(verbatim: "Disziplin (optional)") }
                    TextField(text: $location) { Text(verbatim: "Ort (optional)") }
                    TextField(text: $hostOrg) { Text(verbatim: "Ausrichter (optional)") }
                } header: { Text(verbatim: "Überregionaler Termin") }

                Section {
                    DatePicker(selection: $startsOn, displayedComponents: .date) { Text(verbatim: "Datum") }
                    Toggle(isOn: $hasEnd) { Text(verbatim: "Mehrtägig (Enddatum)") }
                    if hasEnd {
                        DatePicker(selection: $endsOn, in: startsOn..., displayedComponents: .date) {
                            Text(verbatim: "Enddatum")
                        }
                    }
                } header: { Text(verbatim: "Zeitraum") }

                Section {
                    TextField(text: $registrationUrl) { Text(verbatim: "Anmelde-Link (optional)") }
#if os(iOS)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled(true)
#endif
                    TextField(text: $description, axis: .vertical) { Text(verbatim: "Beschreibung (optional)") }
                        .lineLimit(3...8)
                } header: { Text(verbatim: "Weitere Angaben") }

                if let errorMessage {
                    Section { Text(verbatim: errorMessage).foregroundStyle(Theme.Colors.danger) }
                }

                Section {
                    Button(role: .destructive) {
                        showDeleteConfirm = true
                    } label: {
                        Text(verbatim: "Termin löschen")
                            .frame(maxWidth: .infinity, alignment: .center)
                    }
                    .disabled(busy)
                }
            }
            .navigationTitle(Text(verbatim: "Termin bearbeiten"))
#if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: { Text(verbatim: "Abbrechen") }.disabled(busy)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        save()
                    } label: {
                        saving ? AnyView(ProgressView()) : AnyView(Text(verbatim: "Sichern"))
                    }
                    .disabled(trimmedTitle.isEmpty || busy)
                }
            }
            .confirmationDialog(
                Text(verbatim: "Diesen überregionalen Termin löschen?"),
                isPresented: $showDeleteConfirm,
                titleVisibility: .visible
            ) {
                Button(role: .destructive) { delete() } label: { Text(verbatim: "Endgültig löschen") }
                Button(role: .cancel) {} label: { Text(verbatim: "Abbrechen") }
            } message: {
                Text(verbatim: "Der Termin verschwindet für alle Mitglieder. Das lässt sich nicht rückgängig machen.")
            }
        }
    }

    // MARK: - Aktionen

    private func save() {
        guard !trimmedTitle.isEmpty, !busy else { return }
        saving = true
        errorMessage = nil
        let update = RegionalEventUpdate(
            title: trimmedTitle,
            startsOn: QuickCreateFormat.date(startsOn),
            endsOn: hasEnd ? QuickCreateFormat.date(endsOn) : nil,
            hostOrg: nilIfEmpty(hostOrg),
            discipline: nilIfEmpty(discipline),
            location: nilIfEmpty(location),
            registrationUrl: nilIfEmpty(registrationUrl),
            description: nilIfEmpty(description)
        )
        _Concurrency.Task {
            do {
                _ = try await api.updateRegionalEvent(eventId: event.id, update)
                onSaved()
                dismiss()
            } catch {
                errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
            }
            saving = false
        }
    }

    private func delete() {
        guard !busy else { return }
        deleting = true
        errorMessage = nil
        _Concurrency.Task {
            do {
                try await api.deleteRegionalEvent(eventId: event.id)
                onDeleted()
                dismiss()
            } catch {
                errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
            }
            deleting = false
        }
    }

    private func nilIfEmpty(_ raw: String) -> String? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
