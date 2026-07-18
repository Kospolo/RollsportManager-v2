import SwiftUI

/// Sparten-Karte im „Heimspiel"-Charakter: farbiger Icon-Chip (Akzentfarbe der
/// Sparte), Name, Aktiv-/Eigene-Finanzen-Badges, Mitglieder- und Team-Zahl.
/// Inaktive Sparten sind sichtbar abgesetzt (gedämpft + gestrichelter Rand).
/// Bearbeiten/(De-)Aktivieren/Löschen erscheinen nur für Berechtigte
/// (`canManage`); die Rechte-Wahrheit bleibt serverseitig (403 → Alert +
/// Rollback). Web-Referenz: sparten/_components/SparteCard.tsx.
struct SparteCardView: View {
    let sparte: Sparte
    let memberCount: Int
    let teamCount: Int
    let canManage: Bool
    let isBusy: Bool
    let onEdit: () -> Void
    let onToggleActive: () -> Void
    let onDelete: () -> Void

    private var accent: Color { SparteColorCatalog.color(for: sparte.farbe) }

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                header
                Divider().overlay(Theme.Colors.line)
                counts
                if canManage { actions }
            }
            .opacity(sparte.aktiv ? 1 : 0.72)
        }
        .overlay(inactiveBorder)
    }

    // MARK: - Kopf (Icon-Chip · Name · Badges)

    private var header: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s3) {
            RoundedRectangle(cornerRadius: Theme.Radius.org, style: .continuous)
                .fill(accent.opacity(0.16))
                .frame(width: 44, height: 44)
                .overlay(
                    Image(systemName: SparteIconCatalog.symbol(for: sparte.icon))
                        .font(.system(size: 19, weight: .semibold))
                        .foregroundStyle(accent)
                )
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                Text(verbatim: sparte.name)
                    .font(Theme.Fonts.h3)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .lineLimit(1)
                HStack(spacing: Theme.Spacing.s2) {
                    RSMStatusPill(
                        text: sparte.aktiv ? "sparten.badge.active" : "sparten.badge.inactive",
                        kind: sparte.aktiv ? .success : .neutral
                    )
                    if sparte.eigeneFinanzen {
                        RSMStatusPill(text: "sparten.badge.ownFinances", kind: .warn)
                    }
                }
            }
            Spacer(minLength: 0)
        }
    }

    // MARK: - Zahlen (Mitglieder · Teams)

    private var counts: some View {
        HStack(spacing: Theme.Spacing.s4) {
            countItem(systemImage: "person.2.fill", text: Text("sparten.count.members \(memberCount)"))
            countItem(systemImage: "person.3.fill", text: Text("sparten.count.teams \(teamCount)"))
            Spacer(minLength: 0)
        }
        .font(Theme.Fonts.caption.weight(.semibold))
        .foregroundStyle(Theme.Colors.inkSoft)
    }

    private func countItem(systemImage: String, text: Text) -> some View {
        HStack(spacing: Theme.Spacing.s1) {
            Image(systemName: systemImage)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Theme.Colors.inkFaint)
                .accessibilityHidden(true)
            text
        }
    }

    // MARK: - Aktionen (nur canManage)

    private var actions: some View {
        HStack(spacing: Theme.Spacing.s2) {
            actionButton(titleKey: "sparten.action.edit", systemImage: "pencil", action: onEdit)
            actionButton(
                titleKey: sparte.aktiv ? "sparten.action.deactivate" : "sparten.action.activate",
                systemImage: sparte.aktiv ? "pause.circle" : "play.circle",
                action: onToggleActive
            )
            Spacer(minLength: 0)
            Button(action: onDelete) {
                Text("sparten.action.delete")
                    .font(Theme.Fonts.caption.weight(.bold))
                    .foregroundStyle(Theme.Colors.danger)
                    .padding(.horizontal, Theme.Spacing.s3)
                    .frame(minHeight: 34)
            }
            .buttonStyle(RSMPressableButtonStyle())
        }
        .disabled(isBusy)
        .opacity(isBusy ? 0.5 : 1)
        .padding(.top, Theme.Spacing.s1)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Theme.Colors.line)
                .frame(height: 1)
                .offset(y: -Theme.Spacing.s2)
        }
    }

    private func actionButton(
        titleKey: LocalizedStringKey,
        systemImage: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: Theme.Spacing.s1) {
                Image(systemName: systemImage)
                    .font(.system(size: 12, weight: .semibold))
                Text(titleKey)
                    .font(Theme.Fonts.caption.weight(.bold))
            }
            .foregroundStyle(Theme.Colors.brandInk)
            .padding(.horizontal, Theme.Spacing.s3)
            .frame(minHeight: 34)
            .background(Theme.Colors.brandSoft)
            .clipShape(Capsule())
        }
        .buttonStyle(RSMPressableButtonStyle())
    }

    // MARK: - Inaktiv-Rand (gestrichelt)

    @ViewBuilder
    private var inactiveBorder: some View {
        if !sparte.aktiv {
            RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                .strokeBorder(
                    Theme.Colors.line,
                    style: StrokeStyle(lineWidth: 1, dash: [5, 4])
                )
        }
    }
}
