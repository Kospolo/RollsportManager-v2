import SwiftUI

/// Schließfach-Karte: Nummer/Kennung (monospaced, wie die Web-Referenz),
/// Status-Chip (frei/belegt/defekt), Standort und — bei Belegung — das
/// zugeordnete Mitglied mit Avatar. Rein lesend in diesem Batch; die
/// Zuordnen/Freigeben/Verwalten-Aktionen der Web-Karte folgen später.
/// Web-Referenz: schliessfaecher/_components/LockerCard.tsx.
struct LockerCardView: View {
    let locker: Locker
    /// Aufgelöster Name des belegenden Mitglieds (oder `nil` bei Belegung ohne
    /// auflösbaren Namen → Platzhalter).
    let assignedMemberName: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            header
            locationRow

            if locker.status == .assigned {
                assignedRow
            }

            if let note = locker.note, !note.isEmpty {
                Text(verbatim: note)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .lineLimit(2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Kopf (Kennung + Status)

    private var header: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s2) {
            Text(verbatim: locker.label)
                .font(Theme.Fonts.monoTable.weight(.bold))
                .foregroundStyle(Theme.Colors.inkPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
            RSMStatusPill(
                text: LockerDisplay.statusLabel(locker.status),
                kind: LockerDisplay.statusKind(locker.status)
            )
        }
    }

    // MARK: - Standort

    private var locationRow: some View {
        HStack(spacing: Theme.Spacing.s1) {
            Image(systemName: "mappin.and.ellipse")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.Colors.inkFaint)
                .accessibilityHidden(true)
            if let location = locker.location, !location.isEmpty {
                Text(verbatim: location)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            } else {
                Text("schliessfaecher.card.noLocation")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
    }

    // MARK: - Belegung (Mitglied)

    private var assignedRow: some View {
        HStack(spacing: Theme.Spacing.s3) {
            if let name = assignedMemberName {
                RSMAvatarView(name: name, personId: locker.assignedMemberId, size: 32)
                VStack(alignment: .leading, spacing: 0) {
                    Text("schliessfaecher.card.assignedTo")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                    Text(verbatim: name)
                        .font(Theme.Fonts.caption.weight(.semibold))
                        .foregroundStyle(Theme.Colors.inkPrimary)
                        .lineLimit(1)
                }
            } else {
                Text("schliessfaecher.card.unknownMember")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Theme.Spacing.s3)
        .padding(.vertical, Theme.Spacing.s2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Colors.bgSunken)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
    }
}
