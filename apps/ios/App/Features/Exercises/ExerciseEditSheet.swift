import SwiftUI

/// Verwalten-Sheet einer Übung für Trainer:innen: Bearbeiten (Spiegel des
/// Anlegen-Sheets `ExerciseCreateSheet`, ergänzt um die Web-Felder Beschreibung,
/// Video, Anleitung und Dauer) sowie Löschen (Bestätigungs-Dialog, nie
/// automatisch). Erfolg: `onSaved`/`onDeleted` (Liste neu laden) + schließen;
/// Fehler bleibt als Klartext im Sheet, damit ein erneuter Versuch möglich ist.
/// Die Rechte-Wahrheit bleibt serverseitig (RLS/API, 403 → Klartext).
/// Web-Referenz: uebungen/_components/ExerciseFormDialog.tsx +
/// DeleteExerciseDialog.tsx.
struct ExerciseEditSheet: View {
    let api: APIClient
    let exercise: Exercise
    let onSaved: () -> Void
    let onDeleted: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var category: ExerciseCategory
    @State private var difficulty: Int
    @State private var description: String
    @State private var videoUrl: String
    @State private var instructions: String
    @State private var duration: String
    @State private var saving = false
    @State private var deleting = false
    @State private var showDeleteConfirm = false
    @State private var errorMessage: String?

    init(api: APIClient, exercise: Exercise, onSaved: @escaping () -> Void, onDeleted: @escaping () -> Void) {
        self.api = api
        self.exercise = exercise
        self.onSaved = onSaved
        self.onDeleted = onDeleted
        _name = State(initialValue: exercise.name)
        _category = State(initialValue: exercise.category)
        _difficulty = State(initialValue: min(5, max(1, exercise.difficulty ?? 3)))
        _description = State(initialValue: exercise.description ?? "")
        _videoUrl = State(initialValue: exercise.videoUrl ?? "")
        _instructions = State(initialValue: exercise.instructions ?? "")
        _duration = State(initialValue: exercise.durationSeconds.map(String.init) ?? "")
    }

    private var busy: Bool { saving || deleting }

    private var trimmedName: String { name.trimmingCharacters(in: .whitespaces) }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(text: $name) { Text(verbatim: "Name") }
                } header: { Text(verbatim: "Übung") }

                Section {
                    Picker(selection: $category) {
                        ForEach(ExerciseCatalog.order, id: \.self) { Text(ExerciseCatalog.labelKey($0)).tag($0) }
                    } label: { Text(verbatim: "Kategorie") }
                    Stepper(value: $difficulty, in: 1...5) { Text(verbatim: "Schwierigkeit: \(difficulty)/5") }
                }

                Section {
                    TextField(text: $description, axis: .vertical) { Text(verbatim: "Beschreibung") }
                    TextField(text: $instructions, axis: .vertical) { Text(verbatim: "Anleitung") }
                } header: { Text(verbatim: "Details (optional)") }

                Section {
                    TextField(text: $videoUrl) { Text(verbatim: "Video-Link (http/https)") }
#if os(iOS)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
#endif
                        .autocorrectionDisabled()
                    TextField(text: $duration) { Text(verbatim: "Dauer (Sekunden)") }
#if os(iOS)
                        .keyboardType(.numberPad)
#endif
                }

                if let errorMessage {
                    Section { Text(verbatim: errorMessage).foregroundStyle(Theme.Colors.danger) }
                }

                Section {
                    Button(role: .destructive) {
                        showDeleteConfirm = true
                    } label: {
                        Text(verbatim: "Übung löschen")
                    }
                    .disabled(busy)
                }
            }
            .navigationTitle(Text(verbatim: "Übung bearbeiten"))
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
                    .disabled(trimmedName.isEmpty || busy)
                }
            }
            .confirmationDialog(
                Text(verbatim: "„\(exercise.name)“ wirklich löschen?"),
                isPresented: $showDeleteConfirm,
                titleVisibility: .visible
            ) {
                Button(role: .destructive) { performDelete() } label: { Text(verbatim: "Löschen") }
                Button(role: .cancel) {} label: { Text(verbatim: "Abbrechen") }
            } message: {
                Text(verbatim: "Diese Übung wird dauerhaft aus der Bibliothek entfernt.")
            }
        }
    }

    // MARK: - Aktionen

    private func save() {
        guard !trimmedName.isEmpty, !busy else { return }
        let trimmedVideo = videoUrl.trimmingCharacters(in: .whitespaces)
        if !trimmedVideo.isEmpty, !isHTTPURL(trimmedVideo) {
            errorMessage = "Bitte einen gültigen http(s)-Link angeben."
            return
        }
        let trimmedDuration = duration.trimmingCharacters(in: .whitespaces)
        var durationSeconds: Int?
        if !trimmedDuration.isEmpty {
            guard let parsed = Int(trimmedDuration), parsed > 0 else {
                errorMessage = "Dauer muss eine Zahl größer 0 sein."
                return
            }
            durationSeconds = parsed
        }
        let trimmedDesc = description.trimmingCharacters(in: .whitespaces)
        let trimmedInstr = instructions.trimmingCharacters(in: .whitespaces)

        saving = true; errorMessage = nil
        let update = ExerciseUpdate(
            name: trimmedName,
            category: category,
            difficulty: difficulty,
            description: trimmedDesc.isEmpty ? nil : trimmedDesc,
            videoUrl: trimmedVideo.isEmpty ? nil : trimmedVideo,
            instructions: trimmedInstr.isEmpty ? nil : trimmedInstr,
            durationSeconds: durationSeconds
        )
        _Concurrency.Task {
            do {
                _ = try await api.updateExercise(exercise.id, update)
                onSaved(); dismiss()
            } catch {
                errorMessage = (error as? APIError)?.errorDescription ?? "Speichern fehlgeschlagen."
            }
            saving = false
        }
    }

    private func performDelete() {
        guard !busy else { return }
        deleting = true; errorMessage = nil
        _Concurrency.Task {
            do {
                try await api.deleteExercise(exercise.id)
                onDeleted(); dismiss()
            } catch {
                errorMessage = (error as? APIError)?.errorDescription ?? "Löschen fehlgeschlagen."
            }
            deleting = false
        }
    }

    /// Nur echte http(s)-Ziele zulassen (kein file:/custom-scheme) — analog zur
    /// Web-Prüfung (`HTTP_RE`) und zum Video-Öffnen im Detail-Sheet.
    private func isHTTPURL(_ raw: String) -> Bool {
        guard let url = URL(string: raw), let scheme = url.scheme?.lowercased() else { return false }
        return (scheme == "http" || scheme == "https") && (url.host?.isEmpty == false)
    }
}
