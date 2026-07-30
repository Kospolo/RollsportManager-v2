import SwiftUI

/// Betreiber-Sicht „Lizenzen": je Verein eine Zeile mit Stufe, Status, Quelle
/// und Laufzeit. Web-Referenz: apps/web/app/(super)/lizenzen.
///
/// ### KEIN VEREIN OHNE ZEILE ###
/// Der Endpoint liefert AUCH Vereine ohne Lizenz — mit leeren Feldern. Das ist
/// der Normalfall „kostenlos" und kein Datenfehler. Genau deshalb steht hier
/// eine eigene, ruhige Darstellung dafür („Kostenlos") statt sechs
/// Gedankenstriche, die wie ein kaputter Datensatz aussehen.
///
/// LESEND. Das Umstufen einer Lizenz (`PATCH /platform/entitlements/{clubId}`)
/// bleibt im Web: es schaltet einem fremden Verein Funktionen ab und verlangt
/// eine Begründung fürs `operator_audit_log`.
struct PlatformLicensesView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = PlatformSectionModel<[PlatformEntitlementRow]>()
    /// Die Zeile, deren Lizenz gerade bearbeitet wird (Sheet offen ⇔ != nil).
    @State private var editing: PlatformEntitlementRow?

    var body: some View {
        PlatformSectionScreen(
            title: "platform.licenses.title",
            model: model,
            fetch: { try await session.api.listPlatformEntitlements() },
            isEmpty: { $0.isEmpty },
            emptyImage: "shield.lefthalf.filled",
            emptyTitle: "platform.licenses.empty.title",
            emptyMessage: "platform.licenses.empty.message"
        ) { rows in
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                summary(rows)
                ForEach(rows, id: \.clubId) { row in
                    licenseCard(row)
                }
            }
        }
        .sheet(item: $editing) { row in
            EditEntitlementSheet(row: row) {
                // Nach dem Speichern die Liste frisch ziehen, damit Stufe/Status
                // sofort stimmen.
                _Concurrency.Task {
                    await model.load { try await session.api.listPlatformEntitlements() }
                }
            }
            .environmentObject(session)
        }
    }

    /// Wie viele Vereine zahlen, wie viele nicht — die eine Zahl, die ein
    /// Betreiber unterwegs wirklich sehen will.
    private func summary(_ rows: [PlatformEntitlementRow]) -> some View {
        let licensed = rows.filter { hasLicense($0) }.count
        return HStack(spacing: Theme.Spacing.s3) {
            RSMKpiTile(
                eyebrow: "platform.licenses.kpi.licensed",
                value: licensed.formatted(.number)
            )
            RSMKpiTile(
                eyebrow: "platform.licenses.kpi.free",
                value: (rows.count - licensed).formatted(.number)
            )
        }
        .frame(maxWidth: .infinity)
        .padding(Theme.Spacing.s2)
        .background(Theme.Colors.bgSurface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                .stroke(Theme.Colors.line, lineWidth: 1)
        )
    }

    private func hasLicense(_ row: PlatformEntitlementRow) -> Bool {
        guard let tier = row.tier?.lowercased() else { return false }
        return tier != "free" && !tier.isEmpty
    }

    private func licenseCard(_ row: PlatformEntitlementRow) -> some View {
        RSMCard(padding: Theme.Spacing.s4) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                HStack(alignment: .top, spacing: Theme.Spacing.s3) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(verbatim: row.clubName)
                            .font(Theme.Fonts.listTitle)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                            .fixedSize(horizontal: false, vertical: true)
                        Text("platform.licenses.memberCount \(row.memberCount ?? 0)")
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkSoft)
                    }
                    Spacer(minLength: Theme.Spacing.s2)
                    tierPill(row)
                }

                if hasLicense(row) {
                    VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                        PlatformDetailRow(
                            label: "platform.licenses.status",
                            value: statusText(row.status)
                        )
                        PlatformDetailRow(
                            label: "platform.licenses.source",
                            value: sourceText(row.source)
                        )
                        PlatformDetailRow(
                            label: "platform.licenses.validUntil",
                            value: PlatformFormat.day(row.validUntil)
                        )
                        PlatformDetailRow(
                            label: "platform.licenses.updatedAt",
                            value: PlatformFormat.dateTime(row.updatedAt)
                        )
                    }
                } else {
                    Text("platform.licenses.freeExplained")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .fixedSize(horizontal: false, vertical: true)
                }

                editButton(row)
            }
        }
    }

    /// „Lizenz verwalten" — öffnet das Bearbeiten-Sheet für genau diese Zeile.
    /// Der Server erzwingt Begründung + Protokoll (operator_audit_log); die UI
    /// führt nur dorthin.
    private func editButton(_ row: PlatformEntitlementRow) -> some View {
        Button {
            editing = row
        } label: {
            Label("platform.licenses.edit.open", systemImage: "slider.horizontal.3")
                .font(Theme.Fonts.bodyStrong)
                .frame(maxWidth: .infinity, minHeight: Theme.Size.touchTarget)
                .foregroundStyle(Theme.Colors.brandInk)
                .background(Theme.Colors.brandSoft)
                .clipShape(Capsule())
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityLabel(Text("platform.licenses.edit.open.a11y \(row.clubName)"))
    }

    @ViewBuilder
    private func tierPill(_ row: PlatformEntitlementRow) -> some View {
        if hasLicense(row) {
            RSMStatusPill(text: "platform.licenses.tier.pro", kind: .success)
        } else {
            RSMStatusPill(text: "platform.licenses.tier.free", kind: .neutral)
        }
    }

    /// Der Status kommt als Freitext aus dem Contract (`String?`) — bekannte
    /// Werte werden übersetzt, unbekannte durchgereicht statt verschluckt.
    private func statusText(_ raw: String?) -> Text {
        switch raw {
        case "active": return Text("platform.licenses.status.active")
        case "trialing": return Text("platform.licenses.status.trialing")
        case "past_due": return Text("platform.licenses.status.pastDue")
        case "canceled", "cancelled": return Text("platform.licenses.status.canceled")
        case "expired": return Text("platform.licenses.status.expired")
        default: return PlatformFormat.text(raw)
        }
    }

    private func sourceText(_ source: PlatformEntitlementRowSource?) -> Text {
        switch source {
        case .stripe: return Text("platform.licenses.source.stripe")
        case .revenuecat: return Text("platform.licenses.source.revenuecat")
        case .manual: return Text("platform.licenses.source.manual")
        case nil: return Text(verbatim: "–")
        }
    }
}

/// `Identifiable` für `.sheet(item:)` — die `clubId` ist je Zeile eindeutig.
/// (Der generierte Contract-Typ bleibt unangetastet; Konformanz per Extension.)
extension PlatformEntitlementRow: Identifiable {
    public var id: String { clubId }
}
