import SwiftUI

/// Wettkampf VERWALTEN — die iOS-Fassung des Web-Formulars (NewCompetitionSheet
/// im Edit-Modus) plus Löschen (OverviewTab). Ein Sheet für alles, was der
/// Trainerstab an einem bestehenden Wettkampf tut: Name/Ort/Zeiten/Status
/// ändern und den Wettkampf löschen. Spiegelbild des Anlegen-Sheets
/// (CompetitionCreateSheet) — dieselben Felder, vorbefüllt.
///
/// Die Startliste (Meldungen) und die Wertung liegen im Detail, nicht hier.
/// Die verbindliche Rechteprüfung sitzt serverseitig; ein 403 kommt als
/// Klartext zurück.
struct CompetitionManageSheet: View {
    @ObservedObject var model: CompetitionsViewModel
    let competition: Competition
    @Environment(\.dismiss) private var dismiss

    @State private var name: String
    @State private var location: String
    @State private var starts: Date
    @State private var ends: Date
    @State private var status: CompetitionStatus
    @State private var saving = false
    @State private var errorMessage: String?
    @State private var showDeleteConfirm = false

    init(model: CompetitionsViewModel, competition: Competition) {
        self.model = model
        self.competition = competition
        _name = State(initialValue: competition.name)
        _location = State(initialValue: competition.location ?? "")
        _starts = State(initialValue: WettkampfDate.timestamp(from: competition.startsAt) ?? Date())
        _ends = State(initialValue: WettkampfDate.timestamp(from: competition.endsAt)
            ?? (WettkampfDate.timestamp(from: competition.startsAt) ?? Date()).addingTimeInterval(3 * 3600))
        _status = State(initialValue: competition.status)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section { TextField(text: $name) { Text(verbatim: "Name") } } header: { Text(verbatim: "Wettkampf") }
                Section {
                    DatePicker(selection: $starts) { Text(verbatim: "Beginn") }
                    DatePicker(selection: $ends, in: starts...) { Text(verbatim: "Ende") }
                    TextField(text: $location) { Text(verbatim: "Ort (optional)") }
                }
                Section {
                    Picker(selection: $status) {
                        ForEach(CompetitionStatus.allCases, id: \.self) { s in
                            Text(WettkampfStatusDisplay.labelKey(s)).tag(s)
                        }
                    } label: { Text(verbatim: "Status") }
                } header: { Text(verbatim: "Status") }

                if let errorMessage {
                    Section { Text(verbatim: errorMessage).foregroundStyle(Theme.Colors.danger) }
                }

                Section {
                    Button(role: .destructive) { showDeleteConfirm = true } label: {
                        Text(verbatim: "Wettkampf löschen")
                    }.disabled(saving)
                }
            }
            .navigationTitle(Text(verbatim: competition.name))
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
                Text(verbatim: "Wettkampf „\(competition.name)“ wirklich löschen?"),
                isPresented: $showDeleteConfirm, titleVisibility: .visible
            ) {
                Button(role: .destructive) { performDelete() } label: { Text(verbatim: "Löschen") }
                Button(role: .cancel) {} label: { Text(verbatim: "Abbrechen") }
            }
        }
    }

    // MARK: - Aktionen

    private func save() {
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        guard !trimmedName.isEmpty, !saving else { return }
        saving = true; errorMessage = nil
        let loc = location.trimmingCharacters(in: .whitespaces)
        _Concurrency.Task {
            do {
                try await model.update(competitionId: competition.id, CompetitionUpdate(
                    name: trimmedName,
                    location: loc.isEmpty ? nil : loc,
                    startsAt: QuickCreateFormat.iso(starts),
                    endsAt: QuickCreateFormat.iso(ends),
                    status: status
                ))
                dismiss()
            } catch {
                errorMessage = CompetitionsViewModel.friendlyMessage(error)
            }
            saving = false
        }
    }

    private func performDelete() {
        saving = true; errorMessage = nil
        _Concurrency.Task {
            do {
                try await model.delete(competitionId: competition.id)
                dismiss()
            } catch {
                errorMessage = CompetitionsViewModel.friendlyMessage(error)
            }
            saving = false
        }
    }
}
