import SwiftUI

// ============================================================================
// Bausteine des Wartelisten-Screens: Art-Chip, kompakter Aktions-Button,
// Filter-Chips, „Meine-Einträge“-Karte und Queue-Zeile (Trainer+). Alle rein
// darstellend — Aktionen laufen als Closures nach oben (WaitlistsView).
// ============================================================================

/// Art-Chip (Icon + Wort) im neutralen Sunken-Ton — analog zu den Web-Badges.
struct WaitlistKindChip: View {
    let kind: WaitlistKind

    var body: some View {
        HStack(spacing: Theme.Spacing.s1) {
            Image(systemName: kind.systemImage)
                .font(.system(size: 11, weight: .semibold))
                .accessibilityHidden(true)
            Text(kind.labelKey)
                .font(Theme.Fonts.caption.weight(.semibold))
        }
        .foregroundStyle(Theme.Colors.inkSoft)
        .padding(.horizontal, Theme.Spacing.s3)
        .padding(.vertical, Theme.Spacing.s1)
        .background(Theme.Colors.bgSunken)
        .clipShape(Capsule())
    }
}

/// Kompakter Text-Button (ghost) für „Austragen“/„Entfernen“. Destruktive
/// Variante in Danger-Farbe. Mindest-Touch-Ziel 44 pt.
struct WaitlistActionButton: View {
    let titleKey: LocalizedStringKey
    var systemImage: String = "xmark.circle"
    var isDestructive = false
    var isDisabled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Theme.Spacing.s1) {
                Image(systemName: systemImage)
                    .font(.system(size: 13, weight: .semibold))
                    .accessibilityHidden(true)
                Text(titleKey)
                    .font(Theme.Fonts.caption.weight(.semibold))
            }
            .foregroundStyle(isDestructive ? Theme.Colors.danger : Theme.Colors.brandInk)
            .padding(.horizontal, Theme.Spacing.s3)
            .frame(minHeight: Theme.Size.touchTarget)
            .contentShape(Rectangle())
        }
        .buttonStyle(RSMPressableButtonStyle())
        .disabled(isDisabled)
    }
}

/// Optionale Notiz als Zitat-Blase (Sunken-Mulde) — nur wenn vorhanden.
private struct WaitlistNoteBubble: View {
    let note: String

    var body: some View {
        Text(verbatim: note)
            .font(Theme.Fonts.caption)
            .foregroundStyle(Theme.Colors.inkSoft)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Theme.Spacing.s3)
            .padding(.vertical, Theme.Spacing.s2)
            .background(Theme.Colors.bgSunken)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
    }
}

// MARK: - Filter-Chips (Vereins-Warteschlange)

/// Horizontale Art-Filter für die Queue: „Alle“ + je Art mit Anzahl.
struct WaitlistFilterChips: View {
    @Binding var selection: WaitlistKind?
    let total: Int
    let counts: [WaitlistKind: Int]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.s2) {
                chip(titleKey: "wartelisten.filter.all", count: total, isActive: selection == nil) {
                    selection = nil
                }
                ForEach(WaitlistKind.displayOrder, id: \.self) { kind in
                    chip(kind: kind, count: counts[kind] ?? 0, isActive: selection == kind) {
                        selection = selection == kind ? nil : kind
                    }
                }
            }
            .padding(.horizontal, Theme.Spacing.s1)
        }
    }

    @ViewBuilder
    private func chip(
        titleKey: LocalizedStringKey? = nil,
        kind: WaitlistKind? = nil,
        count: Int,
        isActive: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: Theme.Spacing.s1) {
                if let kind {
                    Image(systemName: kind.systemImage)
                        .font(.system(size: 11, weight: .semibold))
                        .accessibilityHidden(true)
                    Text(kind.labelKey)
                } else if let titleKey {
                    Text(titleKey)
                }
                Text(verbatim: "\(count)")
                    .monospacedDigit()
                    .foregroundStyle(isActive ? Theme.Colors.brandContrast.opacity(0.8) : Theme.Colors.inkFaint)
            }
            .font(Theme.Fonts.caption.weight(.semibold))
            .foregroundStyle(isActive ? Theme.Colors.brandContrast : Theme.Colors.inkSoft)
            .padding(.horizontal, Theme.Spacing.s3)
            .frame(minHeight: 36)
            .background(isActive ? Theme.Colors.brand : Theme.Colors.bgSunken)
            .clipShape(Capsule())
        }
        .buttonStyle(RSMPressableButtonStyle())
    }
}

// MARK: - Meine-Einträge-Karte (Selbst-Austrag)

struct WaitlistMineCard: View {
    let entry: Waitlist
    let target: WaitlistTarget
    var isDisabled: Bool
    let onLeave: () -> Void

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                HStack(alignment: .top, spacing: Theme.Spacing.s2) {
                    VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                        WaitlistKindChip(kind: entry.kind)
                        target.labelText
                            .font(Theme.Fonts.bodyStrong)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                            .lineLimit(2)
                    }
                    Spacer(minLength: Theme.Spacing.s2)
                    RSMStatusPill(text: entry.status.labelKey, kind: entry.status.pillKind)
                }

                if let note = entry.note, !note.isEmpty {
                    WaitlistNoteBubble(note: note)
                }

                HStack(spacing: Theme.Spacing.s2) {
                    Text("wartelisten.joinedOn \(WaitlistDateFormat.short(entry.createdAt))")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkFaint)
                    Spacer(minLength: Theme.Spacing.s2)
                    WaitlistActionButton(
                        titleKey: "wartelisten.leave.cta",
                        systemImage: "trash",
                        isDestructive: true,
                        isDisabled: isDisabled,
                        action: onLeave
                    )
                }
            }
        }
    }
}

// MARK: - Queue-Zeile (Trainer+)

struct WaitlistQueueRow: View {
    let entry: Waitlist
    let member: ClubMember?
    let target: WaitlistTarget
    var isDisabled: Bool
    let onRemove: () -> Void

    private var memberName: String {
        guard let member else { return "?" }
        return "\(member.firstName) \(member.lastName)"
    }

    var body: some View {
        RSMCard(padding: Theme.Spacing.s4) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                HStack(alignment: .center, spacing: Theme.Spacing.s3) {
                    RSMAvatarView(name: memberName, personId: entry.memberId, size: 40)
                    VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                        Text(verbatim: memberName)
                            .font(Theme.Fonts.bodyStrong)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                            .lineLimit(1)
                        HStack(spacing: Theme.Spacing.s2) {
                            WaitlistKindChip(kind: entry.kind)
                            target.labelText
                                .font(Theme.Fonts.caption)
                                .foregroundStyle(Theme.Colors.inkSoft)
                                .lineLimit(1)
                        }
                    }
                    Spacer(minLength: Theme.Spacing.s2)
                    RSMStatusPill(text: entry.status.labelKey, kind: entry.status.pillKind)
                }

                if let note = entry.note, !note.isEmpty {
                    WaitlistNoteBubble(note: note)
                }

                HStack {
                    Spacer()
                    WaitlistActionButton(
                        titleKey: "wartelisten.action.remove",
                        systemImage: "trash",
                        isDestructive: true,
                        isDisabled: isDisabled,
                        action: onRemove
                    )
                }
            }
        }
    }
}
