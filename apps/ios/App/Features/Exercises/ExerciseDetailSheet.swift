import SwiftUI

/// Detailansicht einer Übung als Sheet: Kategorie, Schwierigkeit, optionale
/// Dauer, Beschreibung, Anleitung und optionaler Video-Link (öffnet im
/// Browser). Rein lesend — Bearbeiten/Löschen bietet die iOS-API
/// (`Endpoints.swift`) derzeit nicht an. Web-Referenz:
/// uebungen/_components/ExerciseDetailDialog.tsx.
struct ExerciseDetailSheet: View {
    let exercise: Exercise
    /// Aufgelöster Autorenname; `nil` → „Unbekannt“.
    let authorName: String?

    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    private var authorDisplay: String {
        authorName ?? String(localized: "uebungen.author.unknown")
    }

    /// Nur echte http(s)-Ziele öffnen (kein file:/custom-scheme aus Fremddaten).
    private var videoURL: URL? {
        guard
            let raw = exercise.videoUrl?.trimmingCharacters(in: .whitespaces),
            !raw.isEmpty,
            let url = URL(string: raw),
            let scheme = url.scheme?.lowercased(),
            scheme == "http" || scheme == "https"
        else { return nil }
        return url
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    RSMCard {
                        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                            header
                            metaRow
                            if let description = exercise.description, !description.isEmpty {
                                section(titleKey: "uebungen.detail.description", body: description)
                            }
                            if let instructions = exercise.instructions, !instructions.isEmpty {
                                section(titleKey: "uebungen.detail.instructions", body: instructions)
                            }
                            if let videoURL {
                                videoButton(videoURL)
                            }
                            Divider().overlay(Theme.Colors.line)
                            authorLine
                        }
                    }
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text("uebungen.detail.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("uebungen.detail.close") { dismiss() }
                        .tint(Theme.Colors.inkSoft)
                }
            }
        }
        .presentationDragIndicator(.visible)
    }

    // MARK: - Bausteine

    private var header: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            Text("uebungen.detail.eyebrow")
                .font(Theme.Fonts.eyebrow)
                .tracking(Theme.Fonts.eyebrowTracking)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.inkFaint)
            Text(verbatim: exercise.name)
                .font(Theme.Fonts.h2)
                .foregroundStyle(Theme.Colors.inkPrimary)
        }
        .accessibilityElement(children: .combine)
    }

    private var metaRow: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            HStack(spacing: Theme.Spacing.s2) {
                RSMStatusPill(text: ExerciseCatalog.labelKey(exercise.category), kind: .brand)
                Spacer(minLength: 0)
            }
            HStack(spacing: Theme.Spacing.s4) {
                HStack(spacing: Theme.Spacing.s2) {
                    Text("uebungen.difficulty.label")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                    ExerciseDifficultyDots(value: exercise.difficulty)
                }
                if let seconds = exercise.durationSeconds {
                    durationLabel(seconds)
                }
                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func durationLabel(_ seconds: Int) -> some View {
        HStack(spacing: Theme.Spacing.s1) {
            Image(systemName: "clock")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.Colors.inkFaint)
                .accessibilityHidden(true)
            Text(verbatim: ExerciseDuration.format(seconds))
                .font(Theme.Fonts.monoTable)
                .foregroundStyle(Theme.Colors.inkSoft)
                .monospacedDigit()
            Text("uebungen.duration.unit")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkFaint)
        }
    }

    private func section(titleKey: LocalizedStringKey, body: String) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            Text(titleKey)
                .font(Theme.Fonts.eyebrow)
                .tracking(Theme.Fonts.eyebrowTracking)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.inkFaint)
            Text(verbatim: body)
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func videoButton(_ url: URL) -> some View {
        Button {
            openURL(url)
        } label: {
            HStack(spacing: Theme.Spacing.s2) {
                Image(systemName: "play.fill")
                    .font(.system(size: 13, weight: .semibold))
                    .accessibilityHidden(true)
                Text("uebungen.detail.videoOpen")
                    .font(Theme.Fonts.bodyStrong)
            }
            .foregroundStyle(Theme.Colors.brandInk)
            .padding(.horizontal, Theme.Spacing.s4)
            .frame(minHeight: Theme.Size.touchTarget)
            .background(Theme.Colors.brandSoft)
            .clipShape(Capsule())
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityHint(Text("uebungen.detail.videoHint"))
    }

    private var authorLine: some View {
        Text(verbatim: authorLineText)
            .font(Theme.Fonts.caption)
            .foregroundStyle(Theme.Colors.inkFaint)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// „Angelegt von {Name} · {Datum}“ — Datum entfällt, wenn es nicht parsebar
    /// ist (kein leeres „· “ am Ende).
    private var authorLineText: String {
        let author = String(localized: "uebungen.detail.author \(authorDisplay)")
        let date = ExerciseDate.absolute(exercise.createdAt)
        return date.isEmpty ? author : "\(author) · \(date)"
    }
}
