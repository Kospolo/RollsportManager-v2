import SwiftUI

/// Trainingsnotizen zur Kür — rein lokal (UserDefaults), keine API.
/// Speichern nur bei Änderung; Zeitstempel des letzten Stands darunter.
/// Sekundär-Button: die Beere des Screens gehört dem Play im Player.
struct RoutineNotesView: View {
    let routineId: String

    @State private var text = ""
    @State private var savedText = ""
    @State private var savedAt: Date?

    private struct StoredNote: Codable {
        var text: String
        var savedAt: Date
    }

    private var storageKey: String { "rsm.routines.notes.\(routineId)" }
    private var isDirty: Bool { text != savedText }

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                RSMSectionHeader(
                    eyebrow: "routines.notes.eyebrow",
                    title: "routines.notes.title"
                )

                editor

                Text("routines.notes.hint")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)

                RSMSecondaryButton(title: "routines.notes.save") { save() }
                    .disabled(!isDirty)
                    .opacity(isDirty ? 1 : 0.5)

                if let savedAt {
                    Text("routines.notes.saved \(RoutineFormat.savedAt(savedAt))")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
            }
        }
        .onAppear(perform: load)
    }

    // MARK: - Editor (Mulden-Optik, Platzhalter solange leer)

    private var editor: some View {
        ZStack(alignment: .topLeading) {
            TextEditor(text: $text)
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkPrimary)
                .scrollContentBackground(.hidden)
                .padding(Theme.Spacing.s2)
                .frame(minHeight: 110)
                .background(
                    RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous)
                        .fill(Theme.Colors.bgSunken)
                )
                .accessibilityLabel(Text("routines.notes.a11y.editor"))

            if text.isEmpty {
                Text("routines.notes.placeholder")
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.inkFaint)
                    .padding(.horizontal, Theme.Spacing.s3)
                    .padding(.vertical, Theme.Spacing.s4)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
        }
    }

    // MARK: - Persistenz (nur dieses Gerät — steht so auch im UI-Hinweis)

    private func load() {
        guard
            let data = UserDefaults.standard.data(forKey: storageKey),
            let stored = try? JSONDecoder().decode(StoredNote.self, from: data)
        else { return }
        text = stored.text
        savedText = stored.text
        savedAt = stored.savedAt
    }

    private func save() {
        let note = StoredNote(text: text, savedAt: Date())
        guard let data = try? JSONEncoder().encode(note) else { return }
        UserDefaults.standard.set(data, forKey: storageKey)
        savedText = note.text
        savedAt = note.savedAt
    }
}
