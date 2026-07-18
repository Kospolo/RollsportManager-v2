import SwiftUI

// ============================================================================
// Bausteine des Abteilungen-Features: Anzeige-/Format-Helfer, Leitungs-Zeile,
// Avatar-Stapel, Abteilungs-Karte und Mitglieder-Zeile.
// Alle Typen sind mit „Department…“ präfixiert (Kollisionsschutz Parallel-Teams).
// ============================================================================

extension ClubMember {
    /// Anzeigename „Vorname Nachname“ — eigener Name wg. Kollisionsschutz
    /// (das Mitglieder-Feature bringt sein `membersFullName` separat mit).
    var departmentsDisplayName: String { "\(firstName) \(lastName)" }
}

// MARK: - Format-Helfer

enum DepartmentsFormat {
    /// Zweitzeile einer Mitglieder-Zeile: E-Mail, sonst Geburtsjahr, sonst „—“
    /// (Contracts liefern `birthDate` als ISO-String `yyyy-MM-dd…`).
    static func memberSubtitle(_ member: ClubMember) -> String {
        if let email = member.email, !email.isEmpty { return email }
        if let birth = member.birthDate, birth.count >= 4 { return String(birth.prefix(4)) }
        return "—"
    }
}

// MARK: - Leitungs-Zeile

/// Kleine Leitungs-Zeile: Avatar (oder Platzhalter) + Eyebrow „Leitung“ + Name.
struct DepartmentLeadRow: View {
    let lead: ClubMember?

    var body: some View {
        HStack(spacing: Theme.Spacing.s3) {
            if let lead {
                RSMAvatarView(name: lead.departmentsDisplayName, personId: lead.id, size: 28)
            } else {
                ZStack {
                    Circle().fill(Theme.Colors.bgSunken)
                    Text(verbatim: "—")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
                .frame(width: 28, height: 28)
                .accessibilityHidden(true)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text("abteilungen.lead.label")
                    .font(Theme.Fonts.eyebrow)
                    .tracking(Theme.Fonts.eyebrowTracking)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.Colors.inkFaint)
                if let lead {
                    Text(verbatim: lead.departmentsDisplayName)
                        .font(Theme.Fonts.caption.weight(.semibold))
                        .foregroundStyle(Theme.Colors.inkPrimary)
                        .lineLimit(1)
                } else {
                    Text("abteilungen.lead.none")
                        .font(Theme.Fonts.caption.weight(.semibold))
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Avatar-Stapel

/// Überlappende Mitglieder-Avatare mit optionalem „+N“-Rest (Web-Referenz:
/// AvatarStack). Rein dekorativ — die Zahl steht als Text daneben.
struct DepartmentAvatarStack: View {
    let members: [ClubMember]
    var maxShown: Int = 5
    var size: CGFloat = 28

    var body: some View {
        let shown = Array(members.prefix(maxShown))
        let overflow = members.count - shown.count
        HStack(spacing: -(size * 0.34)) {
            ForEach(shown, id: \.id) { member in
                RSMAvatarView(name: member.departmentsDisplayName, personId: member.id, size: size)
                    .overlay(Circle().stroke(Theme.Colors.bgSurface, lineWidth: 2))
            }
            if overflow > 0 {
                ZStack {
                    Circle().fill(Theme.Colors.bgSunken)
                    Text(verbatim: "+\(overflow)")
                        .font(Theme.Fonts.body(size: size * 0.36, weight: .bold))
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
                .frame(width: size, height: size)
                .overlay(Circle().stroke(Theme.Colors.bgSurface, lineWidth: 2))
            }
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Abteilungs-Karte

/// Karte einer Abteilung: Name, optionale Beschreibung, Leitung und
/// Mitgliederzahl mit Avatar-Stapel. Rein visuell — die ganze Karte ist im
/// Listen-View ein `NavigationLink` in die Mitglieder-Sicht.
struct DepartmentCardView: View {
    let department: Department
    let lead: ClubMember?
    let roster: [ClubMember]

    private var memberCount: Int { department.memberIds.count }

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    @ViewBuilder
    private var memberCountLabel: some View {
        if memberCount == 0 {
            Text("abteilungen.members.none")
                .font(Theme.Fonts.caption.weight(.semibold))
                .foregroundStyle(Theme.Colors.inkSoft)
        } else {
            Text("abteilungen.members.count \(memberCount)")
                .font(Theme.Fonts.caption.weight(.semibold))
                .foregroundStyle(Theme.Colors.inkSoft)
        }
    }

    private var openLabel: some View {
        HStack(spacing: Theme.Spacing.s1) {
            Text("abteilungen.open")
                .font(Theme.Fonts.caption.weight(.semibold))
                .foregroundStyle(Theme.Colors.brandInk)
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Colors.inkFaint)
        }
        .accessibilityHidden(true)
    }

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                    Text(verbatim: department.name)
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    if let description = department.description, !description.isEmpty {
                        Text(verbatim: description)
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkSoft)
                            // Bei grosser Schrift passt die Beschreibung nicht
                            // in zwei Zeilen — lieber umbrechen als abschneiden.
                            .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)
                    }
                }

                DepartmentLeadRow(lead: lead)

                Divider().overlay(Theme.Colors.line)

                // Bei den Accessibility-Stufen ist fuer Avatare, Anzahl UND
                // „Mitglieder ansehen“ nebeneinander kein Platz — dann wuerde
                // jedes Wort einzeln umbrechen („Mit-glie-der anse-hen“).
                // Darum untereinander statt nebeneinander.
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                        if !roster.isEmpty {
                            DepartmentAvatarStack(members: roster)
                        }
                        memberCountLabel
                        openLabel
                    }
                } else {
                    HStack(spacing: Theme.Spacing.s3) {
                        if !roster.isEmpty {
                            DepartmentAvatarStack(members: roster)
                        }
                        memberCountLabel
                        Spacer(minLength: Theme.Spacing.s2)
                        openLabel
                    }
                }
            }
        }
        .contentShape(Rectangle())
    }
}

// MARK: - Mitglieder-Zeile (Detail)

/// Zeile der Abteilungs-Mitglieder im Detail: Avatar · Name · E-Mail/Jahr.
struct DepartmentMemberRow: View {
    let member: ClubMember

    var body: some View {
        HStack(spacing: Theme.Spacing.s3) {
            RSMAvatarView(name: member.departmentsDisplayName, personId: member.id, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: member.departmentsDisplayName)
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .lineLimit(1)
                Text(verbatim: DepartmentsFormat.memberSubtitle(member))
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .lineLimit(1)
            }
            Spacer(minLength: Theme.Spacing.s2)
        }
        .frame(minHeight: Theme.Size.listRow)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}
