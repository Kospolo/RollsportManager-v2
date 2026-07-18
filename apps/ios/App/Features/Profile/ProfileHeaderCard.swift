import SwiftUI

/// Kopf des eigenen Profils („Mensch zuerst“): großer Avatar, Anzeigename und
/// eine Zeile aus Rollen-Pille, Status-Chip, Verein + Beitrittsdatum. Bei einer
/// Gasttrainer:in mit Befristung zusätzlich ein Warn-Chip „befristet bis …“.
/// Ohne Vereinsmitgliedschaft (Plattform-Konto) tritt ein neutraler Badge an
/// die Stelle der Vereinszeile. Web-Referenz: profil/_components/ProfilScreen.
struct ProfileHeaderCard: View {
    let displayName: String
    let membership: MeMembership?

    var body: some View {
        RSMCard {
            HStack(alignment: .center, spacing: Theme.Spacing.s4) {
                RSMAvatarView(
                    name: displayName,
                    personId: membership?.id,
                    size: 60
                )
                VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                    Text(verbatim: displayName)
                        .font(Theme.Fonts.h2)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                        .lineLimit(2)
                        .minimumScaleFactor(0.8)

                    if let membership {
                        pills(for: membership)
                        clubLine(for: membership)
                    } else {
                        RSMStatusPill(text: "profil.header.platformBadge", kind: .neutral)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .accessibilityElement(children: .combine)
        }
    }

    // MARK: - Rollen-/Status-Pillen

    @ViewBuilder
    private func pills(for m: MeMembership) -> some View {
        // Umbruch-freundlich: Pillen fließen bei schmaler Breite in die 2. Zeile.
        FlowRow(spacing: Theme.Spacing.s2) {
            RSMStatusPill(text: ProfileFormat.roleLabelKey(m.role), kind: ProfileFormat.roleTone(m.role))
            RSMStatusPill(text: ProfileFormat.statusLabelKey(m.status), kind: ProfileFormat.statusTone(m.status))
            if m.role == .guestCoach, let until = m.validUntil {
                RSMStatusPill(
                    text: "profil.header.guestUntil \(ProfileFormat.day(until))",
                    kind: .warn
                )
            }
        }
    }

    @ViewBuilder
    private func clubLine(for m: MeMembership) -> some View {
        let joined = m.joinedOn.map { ProfileFormat.day($0) }
        HStack(spacing: Theme.Spacing.s2) {
            // Vereinslogo (Migration 0060) — öffentliche Route, ohne Token.
            // Hat der Verein keines, wird hier NICHTS gerendert (kein leerer
            // Platzhalter neben dem Vereinsnamen).
            RSMClubLogoView(clubId: m.clubId, size: 24, hidesWhenMissing: true)
            Text(clubText(clubName: m.clubName, joined: joined))
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkFaint)
                .lineLimit(2)
        }
    }

    private func clubText(clubName: String, joined: String?) -> String {
        if let joined {
            let meta = String(
                format: NSLocalizedString("profil.header.joined %@", comment: "dabei seit"),
                joined
            )
            return "\(clubName) · \(meta)"
        }
        return clubName
    }
}

/// Schlichtes Fließ-Layout: legt die Kinder nebeneinander und bricht bei
/// Platzmangel in die nächste Zeile um (für die Rollen-/Status-Pillen im Kopf).
/// Bewusst minimal — deckt genau den Pillen-Umbruch ab.
struct FlowRow: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout Void) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var rowWidth: CGFloat = 0
        var rowHeight: CGFloat = 0
        var totalHeight: CGFloat = 0
        var totalWidth: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if rowWidth > 0, rowWidth + spacing + size.width > maxWidth {
                totalHeight += rowHeight + spacing
                totalWidth = max(totalWidth, rowWidth)
                rowWidth = size.width
                rowHeight = size.height
            } else {
                rowWidth += (rowWidth > 0 ? spacing : 0) + size.width
                rowHeight = max(rowHeight, size.height)
            }
        }
        totalHeight += rowHeight
        totalWidth = max(totalWidth, rowWidth)
        return CGSize(width: min(totalWidth, maxWidth), height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout Void) {
        let maxWidth = bounds.width
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.minX + maxWidth {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
