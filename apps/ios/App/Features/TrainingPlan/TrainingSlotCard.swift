import SwiftUI

/// Eine Trainingszeit als Karte: Zeitspanne (prominent, Mono/tabular),
/// Team-Pille, Ort (Freitext), Trainer:in und optionale Notiz.
///
/// Wochentag-agnostisch — der Tag steht in der Abschnitts-Überschrift der
/// Wochenliste. Rein lesend (keine Bearbeiten-/Löschen-Aktionen in diesem
/// Batch). Web-Referenz: _components/SlotCard.tsx.
struct TrainingSlotCard: View {
    let slot: TrainingSlot
    /// Aufgelöster Team-Name (nil ⇒ „Ganzer Verein“).
    let teamName: String?
    /// Aufgelöste:r Trainer:in (nil ⇒ keine Zeile).
    let coachName: String?

    private var timeRange: String { TrainingPlanGrouping.timeRange(slot) }

    var body: some View {
        RSMCard(padding: Theme.Spacing.s4) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                timeRow
                teamPill
                if let place = slot.location, !place.isEmpty {
                    metaRow(systemImage: "mappin", text: place)
                }
                if let coachName, !coachName.isEmpty {
                    metaRow(systemImage: "person", text: coachName)
                }
                if let note = slot.note, !note.isEmpty {
                    Text(verbatim: note)
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    // MARK: - Bausteine

    private var timeRow: some View {
        HStack(spacing: Theme.Spacing.s2) {
            Image(systemName: "clock")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.Colors.brandInk)
                .accessibilityHidden(true)
            Text(verbatim: timeRange)
                .font(Theme.Fonts.h3)
                .monospacedDigit()
                .foregroundStyle(Theme.Colors.inkPrimary)
        }
    }

    @ViewBuilder
    private var teamPill: some View {
        if let teamName, !teamName.isEmpty {
            pill(Text(verbatim: teamName), background: Theme.Colors.brandSoft, foreground: Theme.Colors.brandInk)
        } else {
            pill(Text("trainingsplan.wholeClub"), background: Theme.Colors.bgSunken, foreground: Theme.Colors.inkSoft)
        }
    }

    private func pill(_ label: Text, background: Color, foreground: Color) -> some View {
        label
            .font(Theme.Fonts.caption.weight(.semibold))
            .foregroundStyle(foreground)
            .padding(.horizontal, Theme.Spacing.s3)
            .padding(.vertical, Theme.Spacing.s1)
            .background(background)
            .clipShape(Capsule())
    }

    private func metaRow(systemImage: String, text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s2) {
            Image(systemName: systemImage)
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Theme.Colors.inkFaint)
                .accessibilityHidden(true)
            Text(verbatim: text)
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
