import SwiftUI

// ============================================================================
// Bausteine des Familie-Features: Name-/Beziehungs-Helfer, Team-Chip,
// Personen-Zeile und Sektions-Karte.
// Alle Typen sind mit „Family…“ präfixiert (Kollisionsschutz Parallel-Teams).
// ============================================================================

extension ClubMember {
    /// Anzeigename „Vorname Nachname“ — eigener Name wg. Kollisionsschutz.
    var familyFullName: String { "\(firstName) \(lastName)" }
}

// MARK: - Lokalisierungs-Helfer

enum FamilyL10n {

    /// Beziehungscode → Label (DE/EN via String Catalog). Bekannte Codes der
    /// Contracts (parent/guardian/other) plus „grandparent“; Unbekanntes fällt
    /// auf die generische Bezugsperson zurück.
    static func relationKey(_ relation: String) -> LocalizedStringKey {
        switch relation {
        case "parent": return "familie.relation.parent"
        case "grandparent": return "familie.relation.grandparent"
        case "guardian": return "familie.relation.guardian"
        default: return "familie.relation.other"
        }
    }

    /// Jahrgang aus dem Wire-Datum (`yyyy-MM-dd`) — nil, wenn nicht parsebar.
    static func birthYear(_ birthDate: String?) -> Int? {
        guard let birthDate else { return nil }
        return Int(birthDate.prefix(4))
    }
}

// MARK: - Team-Chip

/// Neutraler Chip mit dem Team-Namen (Laufzeit-String ⇒ `verbatim`, keine
/// Lokalisierung). Echo des Web-Team-Badges im Heimspiel-Look.
struct FamilyTeamChip: View {
    let name: String

    var body: some View {
        Text(verbatim: name)
            .font(Theme.Fonts.caption.weight(.semibold))
            .foregroundStyle(Theme.Colors.inkSoft)
            .padding(.horizontal, Theme.Spacing.s3)
            .padding(.vertical, Theme.Spacing.s1)
            .background(Theme.Colors.bgSunken)
            .clipShape(Capsule())
    }
}

// MARK: - Personen-Zeile

/// Zeile einer Familien-Sektion: Avatar · Name · Untertitel (Jahrgang bzw.
/// Beziehung) · Team-Chips. Rein informativ (lesender Batch, keine Navigation).
struct FamilyMemberRow: View {
    let entry: FamilyViewModel.FamilyMember

    private var fullName: String { entry.member.familyFullName }

    /// Untertitel: bei Kindern der Jahrgang (falls bekannt), sonst die
    /// Beziehung; bei Bezugspersonen immer die Beziehung.
    private var subtitle: Text {
        if entry.kind == .child, let year = FamilyL10n.birthYear(entry.member.birthDate) {
            return Text("familie.bornYear \(year)")
        }
        return Text(FamilyL10n.relationKey(entry.relation))
    }

    var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s3) {
            RSMAvatarView(name: fullName, personId: entry.member.id, size: 44)
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(verbatim: fullName)
                        .font(Theme.Fonts.bodyStrong)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                        .lineLimit(1)
                    subtitle
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .lineLimit(1)
                }
                if !entry.teamNames.isEmpty {
                    HStack(spacing: Theme.Spacing.s2) {
                        ForEach(entry.teamNames, id: \.self) { FamilyTeamChip(name: $0) }
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .frame(minHeight: Theme.Size.listRow)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Sektions-Karte

/// Eine Familien-Sektion als Karte: H3-Titel + Anzahl, darunter die Personen
/// mit Hairline-Trennern. Titel kommt als `LocalizedStringKey` (DE/EN).
struct FamilySectionCard: View {
    let title: LocalizedStringKey
    let entries: [FamilyViewModel.FamilyMember]

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s2) {
                    Text(title)
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text("familie.count \(entries.count)")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
                VStack(spacing: 0) {
                    ForEach(entries) { entry in
                        FamilyMemberRow(entry: entry)
                        if entry.id != entries.last?.id {
                            Divider().overlay(Theme.Colors.line)
                        }
                    }
                }
            }
        }
    }
}
