import SwiftUI

/// Übungs-Karte im Grid: Kategorie-Chip, optionaler Video-Marker, Name,
/// zweizeiliger Beschreibungs-Anriss und ein Fuß mit Schwierigkeit, optionaler
/// Dauer und Autor:in. Die ganze Karte ist ein Button (≥ 44 pt) und öffnet die
/// Detailansicht. Web-Referenz: uebungen/_components/ExerciseCard.tsx.
struct ExerciseCardView: View {
    let exercise: Exercise
    /// Aufgelöster Autorenname; `nil` → „Unbekannt“.
    let authorName: String?
    let action: () -> Void

    private var authorDisplay: String {
        authorName ?? String(localized: "uebungen.author.unknown")
    }

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                header
                Text(verbatim: exercise.name)
                    .font(Theme.Fonts.h3)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .multilineTextAlignment(.leading)
                if let description = exercise.description, !description.isEmpty {
                    Text(verbatim: description)
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
                Divider().overlay(Theme.Colors.line)
                footer
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Theme.Spacing.s5)
            .contentShape(Rectangle())
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityLabel(Text(verbatim: exercise.name))
        .accessibilityHint(Text("uebungen.card.a11y.hint"))
    }

    // MARK: - Bausteine

    private var header: some View {
        HStack(spacing: Theme.Spacing.s2) {
            RSMStatusPill(text: ExerciseCatalog.labelKey(exercise.category), kind: .brand)
            if hasVideo {
                Spacer(minLength: 0)
                videoBadge
            }
        }
    }

    private var footer: some View {
        HStack(spacing: Theme.Spacing.s3) {
            ExerciseDifficultyDots(value: exercise.difficulty)
            if let seconds = exercise.durationSeconds {
                durationLabel(seconds)
            }
            Spacer(minLength: Theme.Spacing.s2)
            Text("uebungen.card.byAuthor \(authorDisplay)")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
                .lineLimit(1)
                .truncationMode(.tail)
        }
    }

    private var videoBadge: some View {
        HStack(spacing: Theme.Spacing.s1) {
            Image(systemName: "play.fill")
                .font(.system(size: 10, weight: .semibold))
                .accessibilityHidden(true)
            Text("uebungen.card.video")
                .font(Theme.Fonts.caption.weight(.semibold))
        }
        .foregroundStyle(Theme.Colors.info)
        .padding(.horizontal, Theme.Spacing.s3)
        .padding(.vertical, Theme.Spacing.s1)
        .background(Theme.Colors.infoSoft)
        .clipShape(Capsule())
    }

    private func durationLabel(_ seconds: Int) -> some View {
        HStack(spacing: Theme.Spacing.s1) {
            Image(systemName: "clock")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Theme.Colors.inkFaint)
                .accessibilityHidden(true)
            Text(verbatim: ExerciseDuration.format(seconds))
                .font(Theme.Fonts.monoTable)
                .foregroundStyle(Theme.Colors.inkSoft)
                .monospacedDigit()
        }
    }

    /// Video-Marker nur bei nicht-leerer URL (analog Web `exercise.videoUrl`).
    private var hasVideo: Bool {
        guard let url = exercise.videoUrl else { return false }
        return !url.trimmingCharacters(in: .whitespaces).isEmpty
    }
}
