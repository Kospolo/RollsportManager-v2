import SwiftUI

/// Einzelne Notiz-Karte: Titel, Text-Vorschau (Zeilenumbrüche erhalten, auf
/// wenige Zeilen begrenzt) und eine Meta-Zeile mit „Aktualisiert vor …“ plus
/// den Aktionen Bearbeiten und Löschen. Gelöscht wird nie direkt hier — der
/// Löschen-Knopf öffnet nur den Bestätigungsdialog im Elternteil.
struct NoteCardView: View {
    let note: Note
    let onEdit: () -> Void
    let onDelete: () -> Void

    private var trimmedBody: String {
        note.body.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                Text(verbatim: note.title)
                    .font(Theme.Fonts.h3)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                if trimmedBody.isEmpty {
                    Text("notizen.card.noBody")
                        .font(Theme.Fonts.body.italic())
                        .foregroundStyle(Theme.Colors.inkFaint)
                } else {
                    Text(verbatim: trimmedBody)
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .lineLimit(6)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Divider().overlay(Theme.Colors.line)

                metaRow
            }
        }
    }

    private var metaRow: some View {
        HStack(spacing: Theme.Spacing.s3) {
            HStack(spacing: Theme.Spacing.s1) {
                Image(systemName: "clock")
                    .font(.system(size: 11, weight: .semibold))
                    .accessibilityHidden(true)
                Text("notizen.card.updated \(NotesFormat.relativeUpdated(note.updatedAt))")
            }
            .font(Theme.Fonts.caption)
            .foregroundStyle(Theme.Colors.inkFaint)

            Spacer(minLength: Theme.Spacing.s2)

            actionButton(
                titleKey: "notizen.card.edit",
                systemImage: "square.and.pencil",
                tint: Theme.Colors.inkSoft,
                a11y: Text("notizen.card.edit.a11y \(note.title)"),
                action: onEdit
            )
            actionButton(
                titleKey: "notizen.card.delete",
                systemImage: "trash",
                tint: Theme.Colors.danger,
                a11y: Text("notizen.card.delete.a11y \(note.title)"),
                action: onDelete
            )
        }
    }

    private func actionButton(
        titleKey: LocalizedStringKey,
        systemImage: String,
        tint: Color,
        a11y: Text,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: Theme.Spacing.s1) {
                Image(systemName: systemImage)
                    .font(.system(size: 12, weight: .semibold))
                Text(titleKey)
                    .font(Theme.Fonts.caption.weight(.semibold))
            }
            .foregroundStyle(tint)
            .padding(.horizontal, Theme.Spacing.s2)
            .frame(minHeight: Theme.Size.touchTarget)
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityLabel(a11y)
    }
}
