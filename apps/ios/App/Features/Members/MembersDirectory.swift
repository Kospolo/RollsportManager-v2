import SwiftUI

// ============================================================================
// Das Mitglieder-VERZEICHNIS als Karten — „Mensch statt Tabelle".
//
// Die alte Zeile (40-pt-Kreis · Name · Team · Rollen-Pill · Chevron, getrennt
// durch Haarlinien) war eine Tabelle mit runden Ecken: Der Name musste sich die
// Breite mit der Pille teilen und brach dabei zweizeilig um („Anna-Lena /
// Böhm"), waehrend das Motto — das einzige Feld, das ein Mensch selbst ueber
// sich schreibt — NIRGENDS auftauchte.
//
// Die Karte dreht das um: Flaeche links (Monogramm-Kachel im Farbton der
// Person), lauter Name daneben, darunter die Einordnung und das eigene Wort.
//
// LEITPLANKEN (nicht verhandelbar, stehen hier als Code-Kommentar, damit sie
// beim naechsten Umbau nicht verloren gehen):
//   * KEINE Fotos — `members.ts` hat keine Einwilligungs-Wache, der Verein ist
//     voller Kinder. Identitaet kommt ueber Monogramm + Farbton.
//   * KEINE Beitrags-/Mahnanzeige. Das Verzeichnis ist der Ort, an dem sich der
//     Verein begegnet, nicht die Debitorenliste (Wuerde-Befund, Web zuerst).
//   * Kein Punkte-/Streak-Spielzeug, keine Kachel ohne Text, 44 pt Trefferflaeche.
// ============================================================================

/// Eine Person als Karte: Monogramm-Kachel · Name · Rolle/Teams/Jahrgang · Motto.
struct MemberCardView: View {
    let member: ClubMember
    let teamNames: [String]
    /// Ist das die angemeldete Person? („Du"-Badge)
    var isSelf: Bool = false

    /// Ab den Accessibility-Stufen steht die Kachel UEBER dem Text statt
    /// daneben — nebeneinander bliebe fuer den Namen keine Breite mehr.
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private var birthYear: String? {
        // Nur wenn das Datum wirklich da ist. Fehlt es (serverseitig redigiert
        // fuer einfache Mitglieder), bleibt die Angabe weg — nie ein „—".
        guard let raw = member.birthDate, raw.count >= 4 else { return nil }
        return String(raw.prefix(4))
    }

    private var motto: String? {
        guard let motto = member.profileMotto?.trimmingCharacters(in: .whitespacesAndNewlines),
              !motto.isEmpty
        else { return nil }
        return motto
    }

    var body: some View {
        let layout = dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: Theme.Spacing.s3))
            : AnyLayout(HStackLayout(alignment: .top, spacing: Theme.Spacing.s4))

        return layout {
            RSMMonogramTile(name: member.membersFullName, personId: member.id)
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                nameLine
                badgeLine
                if let motto {
                    mottoLine(motto)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.Spacing.s4)
        .background(Theme.Colors.bgSurface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                .stroke(Theme.Colors.line, lineWidth: 1)
        )
        .shadow(
            color: Theme.Shadows.card.color,
            radius: Theme.Shadows.card.radius,
            x: Theme.Shadows.card.x,
            y: Theme.Shadows.card.y
        )
        .contentShape(RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous))
    }

    /// Der Name ist das Lauteste auf der Karte — er bekommt die volle Breite
    /// (die Rollen-Pille steht darunter, nicht daneben).
    private var nameLine: some View {
        Text(verbatim: member.membersFullName)
            .font(Theme.Fonts.listTitle)
            .foregroundStyle(Theme.Colors.inkPrimary)
            .lineLimit(2)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var badgeLine: some View {
        // Umbrechendes Layout: Rolle + Teams + Jahrgang fliessen in die naechste
        // Zeile statt zu kuerzen. Ein abgeschnittener Teamname hilft niemandem.
        MembersFlowRow(spacing: Theme.Spacing.s2, lineSpacing: Theme.Spacing.s2) {
            RSMStatusPill(
                text: MembersL10n.roleKey(member.role),
                kind: MembersL10n.roleKind(member.role)
            )
            if isSelf {
                RSMStatusPill(text: "members.card.you", kind: .brand)
            }
            ForEach(teamNames, id: \.self) { name in
                MembersTeamBadge(name: name)
            }
            if let birthYear {
                Text("members.card.bornYear \(birthYear)")
                    .font(Theme.Fonts.caption)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkFaint)
            }
        }
    }

    /// Das Motto — das einzige freiwillige Wort einer Person. Einzeilig, als
    /// ruhiges Zitat mit Kante; fehlt es, endet die Karte darueber.
    private func mottoLine(_ text: String) -> some View {
        HStack(spacing: Theme.Spacing.s2) {
            Rectangle()
                .fill(Theme.Colors.lineStrong)
                .frame(width: 2)
                .accessibilityHidden(true)
            Text(verbatim: text)
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
                .lineLimit(1)
        }
        .fixedSize(horizontal: false, vertical: true)
    }
}

/// Team-Badge — neutral getoent, damit die Rollen-Pille lauter bleibt.
struct MembersTeamBadge: View {
    let name: String

    var body: some View {
        Text(verbatim: name)
            .font(Theme.Fonts.caption)
            .foregroundStyle(Theme.Colors.inkSoft)
            .padding(.horizontal, Theme.Spacing.s3)
            .padding(.vertical, Theme.Spacing.s1)
            .background(Theme.Colors.bgSunken)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.s, style: .continuous))
    }
}

// MARK: - Filter-Chip mit Trefferzahl

/// Chip wie `MembersFilterChip`, aber mit Trefferzahl. Die Zahl laeuft
/// `monospacedDigit`, damit die Chips beim Tippen in der Suche nicht zappeln.
struct MembersCountChip: View {
    let title: LocalizedStringKey
    let count: Int
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Theme.Spacing.s2) {
                Text(title)
                    .font(Theme.Fonts.caption.weight(.semibold))
                Text(verbatim: "\(count)")
                    .font(Theme.Fonts.caption.weight(.semibold))
                    .monospacedDigit()
                    .opacity(0.7)
            }
            .foregroundStyle(isSelected ? Theme.Colors.brandInk : Theme.Colors.inkSoft)
            .padding(.horizontal, Theme.Spacing.s4)
            .frame(minHeight: Theme.Size.touchTarget)
            .background(isSelected ? Theme.Colors.brandSoft : Theme.Colors.bgSurface)
            .clipShape(Capsule())
            .overlay(
                Capsule().stroke(
                    isSelected ? Theme.Colors.brandInk : Theme.Colors.line,
                    lineWidth: 1
                )
            )
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }
}

// MARK: - Skelett

/// Platzhalter-KARTEN statt Vollbild-Spinner: der Bildschirm sieht schon aus
/// wie das Ergebnis, es fehlen nur die Namen. Beim Eintreffen springt nichts.
struct MembersSkeletonCard: View {
    @State private var isPulsing = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s4) {
            RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                .fill(Theme.Colors.bgSunken)
                .frame(width: 68, height: 68)
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                bar(width: 168, height: 17)
                bar(width: 116, height: 13)
                bar(width: 196, height: 13)
            }
            Spacer(minLength: 0)
        }
        .padding(Theme.Spacing.s4)
        .background(Theme.Colors.bgSurface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                .stroke(Theme.Colors.line, lineWidth: 1)
        )
        .opacity(isPulsing ? 0.62 : 1)
        .animation(
            reduceMotion ? nil : .easeInOut(duration: 0.9).repeatForever(autoreverses: true),
            value: isPulsing
        )
        .onAppear { isPulsing = true }
        .accessibilityHidden(true)
    }

    private func bar(width: CGFloat, height: CGFloat) -> some View {
        Capsule()
            .fill(Theme.Colors.bgSunken)
            .frame(width: width, height: height)
    }
}

// MARK: - Umbrechende Reihe

/// Minimales Flow-Layout: legt seine Elemente nebeneinander und bricht um,
/// wenn die Breite nicht reicht. (SwiftUIs `Layout` ab iOS 16 — kein Paket.)
struct MembersFlowRow: Layout {
    var spacing: CGFloat = 8
    var lineSpacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var lineHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > maxWidth {
                x = 0
                y += lineHeight + lineSpacing
                lineHeight = 0
            }
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
        return CGSize(width: proposal.width ?? x, height: y + lineHeight)
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) {
        var x = bounds.minX
        var y = bounds.minY
        var lineHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX {
                x = bounds.minX
                y += lineHeight + lineSpacing
                lineHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), anchor: .topLeading, proposal: .unspecified)
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
    }
}
