import SwiftUI

// ============================================================================
// Sparten-Zugehörigkeit EINES Mitglieds auf der Mitglieder-Detailseite.
//
// Reine ANZEIGE (Badges) für alle; für Berechtigte (can_manage_sparten =
// owner/admin/treasurer + Plattform-Admin) zusätzlich ein Knopf ins
// Zuordnungs-Sheet (Mehrfachauswahl). Die n:m-Wahrheit lebt auf der Sparte —
// gespeichert wird deshalb pro GEÄNDERTER Sparte ein Roster-Voll-Replace
// (PUT …/sparten/{id}/members). Selbst-ladend (eigener @StateObject), damit die
// Mitglieder-Detailseite nur minimal berührt wird.
// Web-Referenz: mitglieder/[id]/MemberSpartenCard + MemberSpartenSheet.
// ============================================================================

/// Selbst-ladende Karte: holt die Sparten des Vereins und zeigt die Zuordnung
/// des Mitglieds. Erscheint erst, wenn es etwas zu zeigen gibt ODER der/die
/// Betrachter:in verwalten darf (sonst komplett unsichtbar).
struct MemberSpartenCard: View {
    let memberId: String
    let memberName: String

    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = MemberSpartenViewModel()
    @State private var showSheet = false

    var body: some View {
        Group {
            // Nur zeigen, wenn Zuordnung existiert ODER verwalten erlaubt ist.
            if model.hasLoaded, model.assignedSparten.isEmpty, !model.canManage {
                EmptyView()
            } else if model.hasLoaded {
                card
            } else {
                EmptyView()
            }
        }
        .task {
            await model.loadIfNeeded(
                api: session.api,
                clubId: session.clubId,
                clubRole: session.session?.profile.clubRole,
                memberId: memberId
            )
        }
        .sheet(isPresented: $showSheet) {
            MemberSpartenSheet(
                memberId: memberId,
                memberName: memberName,
                sparten: model.allSparten,
                api: session.api,
                clubId: session.clubId,
                onSaved: { updated in model.apply(sparten: updated) }
            )
        }
    }

    private var card: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                HStack(alignment: .top) {
                    RSMSectionHeader(
                        eyebrow: "member.sparten.eyebrow",
                        title: "member.sparten.title"
                    )
                    Spacer(minLength: 0)
                    if model.canManage {
                        Button {
                            showSheet = true
                        } label: {
                            HStack(spacing: Theme.Spacing.s1) {
                                Image(systemName: "pencil")
                                    .font(.system(size: 12, weight: .semibold))
                                Text(model.assignedSparten.isEmpty
                                     ? "member.sparten.assignCta"
                                     : "member.sparten.editCta")
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
                }

                if model.assignedSparten.isEmpty {
                    Text("member.sparten.none")
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                } else {
                    SparteBadgeFlow(sparten: model.assignedSparten)
                }
            }
        }
    }
}

/// Umbrechende Reihe kompakter Sparten-Abzeichen (Icon-Chip + Name), inaktive
/// gedämpft mit „Inaktiv"-Zusatz. Nutzt einen einfachen Wrap über `FlowLayout`.
struct SparteBadgeFlow: View {
    let sparten: [Sparte]

    var body: some View {
        SparteFlowLayout(spacing: Theme.Spacing.s2) {
            ForEach(sparten, id: \.id) { sparte in
                SparteBadge(sparte: sparte)
            }
        }
    }
}

/// Kompaktes, wiederverwendbares Sparten-Abzeichen: farbiger Icon-Chip in der
/// Akzentfarbe + Name; inaktive Sparten gedämpft mit gestricheltem Rand.
/// Web-Referenz: sparten/_components/SparteBadge.tsx.
struct SparteBadge: View {
    let sparte: Sparte

    private var accent: Color { SparteColorCatalog.color(for: sparte.farbe) }

    var body: some View {
        HStack(spacing: Theme.Spacing.s2) {
            Image(systemName: SparteIconCatalog.symbol(for: sparte.icon))
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(accent)
                .frame(width: 24, height: 24)
                .background(accent.opacity(0.18))
                .clipShape(Circle())
                .accessibilityHidden(true)
            Text(verbatim: sparte.name)
                .font(Theme.Fonts.caption.weight(.semibold))
                .foregroundStyle(Theme.Colors.inkPrimary)
                .lineLimit(1)
            if !sparte.aktiv {
                Text("sparten.badge.inactive")
                    .font(Theme.Fonts.eyebrow)
                    .tracking(Theme.Fonts.eyebrowTracking)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.Colors.inkFaint)
            }
        }
        .padding(.leading, Theme.Spacing.s1)
        .padding(.trailing, Theme.Spacing.s3)
        .padding(.vertical, Theme.Spacing.s1)
        .background(sparte.aktiv ? Theme.Colors.bgSurface : Theme.Colors.bgSunken.opacity(0.6))
        .clipShape(Capsule())
        .overlay(
            Capsule().strokeBorder(
                Theme.Colors.line,
                style: sparte.aktiv
                    ? StrokeStyle(lineWidth: 1)
                    : StrokeStyle(lineWidth: 1, dash: [4, 3])
            )
        )
        .accessibilityElement(children: .combine)
    }
}

/// Minimaler Wrap-Layout (iOS 16+ Layout-Protokoll) für die Badge-Reihe —
/// bricht Kinder in mehrere Zeilen um, ohne Fremd-Abhängigkeit.
struct SparteFlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout Void) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var rows: [CGFloat] = [0]
        var rowWidth: CGFloat = 0
        var totalHeight: CGFloat = 0
        var rowHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if rowWidth > 0, rowWidth + spacing + size.width > maxWidth {
                totalHeight += rowHeight + spacing
                rowWidth = size.width
                rowHeight = size.height
                rows.append(0)
            } else {
                rowWidth += (rowWidth > 0 ? spacing : 0) + size.width
                rowHeight = max(rowHeight, size.height)
            }
        }
        totalHeight += rowHeight
        return CGSize(width: maxWidth == .infinity ? rowWidth : maxWidth, height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout Void) {
        let maxX = bounds.maxX
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > maxX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), anchor: .topLeading, proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

// MARK: - ViewModel

@MainActor
final class MemberSpartenViewModel: ObservableObject {

    @Published private(set) var allSparten: [Sparte] = []
    @Published private(set) var hasLoaded = false

    private var clubRole: ClubRole?
    private var memberId: String = ""
    private var hasStarted = false

    var canManage: Bool { permissions(clubRole).canManageSparten }

    /// Sparten, denen das Mitglied angehört — sortiert wie die Liste.
    var assignedSparten: [Sparte] {
        allSparten.filter { $0.memberIds.contains(memberId) }
    }

    func loadIfNeeded(api: APIClient, clubId: String, clubRole: ClubRole?, memberId: String) async {
        self.clubRole = clubRole
        self.memberId = memberId
        guard !hasStarted else { return }
        hasStarted = true
        // Best-effort: ein Fehler blendet die Karte lediglich aus (kein Screen-
        // Blocker auf der Mitglieder-Detailseite).
        let sparten = (try? await api.listSparten(clubId: clubId)) ?? []
        allSparten = SpartenViewModel.sort(sparten)
        hasLoaded = true
    }

    /// Nach dem Speichern im Sheet: die geänderten Sparten übernehmen.
    func apply(sparten updated: [Sparte]) {
        var byId: [String: Sparte] = [:]
        for sparte in allSparten { byId[sparte.id] = sparte }
        for sparte in updated { byId[sparte.id] = sparte }
        allSparten = SpartenViewModel.sort(Array(byId.values))
    }
}
