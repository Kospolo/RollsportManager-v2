import SwiftUI

/// Ein Balken-Datum der Verteilungen: bereits aufgelöstes Klartext-Label
/// (Rollen-Bezeichnung bzw. Team-Name) und die Zahl dahinter.
struct ReportsBarDatum: Identifiable {
    let id: String
    let label: String
    let value: Int
}

/// Ableitung der Verteilungs-Daten aus der `ReportSummary` — Rollen- und
/// Team-Reihenfolge bleibt die des Servers.
enum ReportsDistribution {
    static func roles(_ summary: ReportSummary) -> [ReportsBarDatum] {
        summary.membersByRole.map {
            ReportsBarDatum(id: $0.role.rawValue, label: roleLabel($0.role), value: $0.count ?? 0)
        }
    }

    static func teams(_ summary: ReportSummary) -> [ReportsBarDatum] {
        summary.membersByTeam.map {
            ReportsBarDatum(id: $0.teamId, label: $0.teamName, value: $0.memberCount ?? 0)
        }
    }

    /// Vereinsrolle → menschenlesbares Label (lokalisiert, DE/EN).
    static func roleLabel(_ role: ClubRole) -> String {
        switch role {
        case .owner: String(localized: "auswertung.role.owner")
        case .admin: String(localized: "auswertung.role.admin")
        case .moderator: String(localized: "auswertung.role.moderator")
        case .treasurer: String(localized: "auswertung.role.treasurer")
        case .coach: String(localized: "auswertung.role.coach")
        case .guestCoach: String(localized: "auswertung.role.guest")
        case .member: String(localized: "auswertung.role.member")
        }
    }
}

/// Horizontale Verteilungs-Balken (reine SwiftUI-Formen, keine Chart-Library):
/// je Zeile das Label und die Zahl als Mono-Klartext, darunter ein Balken,
/// dessen Breite relativ zum größten Wert skaliert. Die Zahl steht immer als
/// Text — der Balken ist rein visuell (für VoiceOver ausgeblendet), die
/// Information liegt nie nur in der Farbe.
struct ReportsBarList: View {
    let eyebrow: LocalizedStringKey
    let title: LocalizedStringKey
    let data: [ReportsBarDatum]
    /// Balkenfarbe (Design-Ton), z. B. `Theme.Colors.brand` / `.info`.
    let tone: Color
    /// Einheit hinter der Zahl für die VoiceOver-Zeile („Mitglieder“).
    let unitText: String

    private var maxValue: Int { data.map(\.value).max() ?? 0 }

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(eyebrow: eyebrow, title: title)
                if data.isEmpty {
                    Text("auswertung.dist.empty")
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                } else {
                    VStack(spacing: Theme.Spacing.s3) {
                        ForEach(data) { item in
                            row(item)
                        }
                    }
                }
            }
        }
    }

    private func row(_ item: ReportsBarDatum) -> some View {
        VStack(spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s3) {
                Text(verbatim: item.label)
                    .font(Theme.Fonts.caption.weight(.medium))
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .lineLimit(1)
                    .truncationMode(.tail)
                Spacer(minLength: 0)
                Text(verbatim: "\(item.value)")
                    .font(Theme.Fonts.monoCaption.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkPrimary)
            }
            bar(for: item.value)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: "\(item.label): \(item.value) \(unitText)"))
    }

    private func bar(for value: Int) -> some View {
        GeometryReader { geo in
            let fraction = maxValue > 0 ? Double(value) / Double(maxValue) : 0
            // Sichtbarer Mindeststummel für Werte > 0 (analog zur Web-Referenz).
            let width = value > 0 ? max(geo.size.width * fraction, geo.size.width * 0.06) : 0
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.Colors.bgSunken)
                Capsule().fill(tone).frame(width: width)
            }
        }
        .frame(height: 8)
        .accessibilityHidden(true)
    }
}
