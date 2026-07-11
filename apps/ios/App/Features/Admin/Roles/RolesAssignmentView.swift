import SwiftUI

// ============================================================================
// Rollen-Schnellzuweisung: Mitgliederliste mit aktueller Rolle und Inline-
// Auswahl über `changeMemberRole`. Sichtbarkeit/Interaktivität richten sich
// nach der Rolle des aktuellen Users (Anzeige-Gate über `permissions()`); der
// Server bleibt die Wahrheit. Web-Referenz:
// apps/web/app/(portal)/verwaltung/rollen/RoleAssignment.tsx.
// ============================================================================

struct RolesAssignmentSection: View {
    let members: [ClubMember]
    /// Rechte des aktuellen Users (aus `SessionStore.permissions`).
    let perms: Permissions
    /// Eigene Mitglieds-ID — die eigene Rolle ist nie zuweisbar.
    let selfMemberId: String?
    /// Ein Wechsel läuft gerade ⇒ Auswahl kurz sperren.
    let isChanging: Bool
    /// Wechsel anstoßen (der Root-View verdrahtet das ViewModel).
    let onChange: (ClubMember, AssignableClubRole) -> Void

    /// owner/admin/moderator dürfen zuweisen (Anzeige-Gate).
    private var canAssign: Bool { perms.isClubAdmin }
    private var options: [AssignableClubRole] { rolesAssignableRoles(for: perms.role) }

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(
                    eyebrow: "rollen.assign.eyebrow",
                    title: "rollen.assign.title"
                )
                if !canAssign { lockedBanner }
                Text("rollen.assign.sub")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)

                if members.isEmpty {
                    RSMEmptyState(
                        systemImage: "person.2",
                        title: "rollen.empty.title",
                        message: "rollen.empty.message"
                    )
                } else {
                    rows
                }
            }
        }
    }

    // MARK: - Sperr-Hinweis (Rolle ohne Zuweisungsrecht)

    private var lockedBanner: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s3) {
            Image(systemName: "lock.fill")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.Colors.info)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                Text("rollen.assign.locked.title")
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                Text("rollen.assign.locked.body \(perms.role.map(RolesL10n.roleLabelString) ?? "—")")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.Spacing.s3)
        .background(Theme.Colors.infoSoft)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
    }

    // MARK: - Zeilen

    private var rows: some View {
        VStack(spacing: 0) {
            ForEach(members, id: \.id) { member in
                RolesAssignmentRow(
                    member: member,
                    isSelf: member.id == selfMemberId,
                    canAssign: canAssign,
                    canChangeTarget: perms.canChangeRole(member),
                    options: options,
                    isChanging: isChanging,
                    onChange: { onChange(member, $0) }
                )
                if member.id != members.last?.id {
                    Divider().overlay(Theme.Colors.line)
                }
            }
        }
    }
}

// MARK: - Einzelne Zeile

private struct RolesAssignmentRow: View {
    let member: ClubMember
    let isSelf: Bool
    let canAssign: Bool
    let canChangeTarget: Bool
    let options: [AssignableClubRole]
    let isChanging: Bool
    let onChange: (AssignableClubRole) -> Void

    private var fullName: String { "\(member.firstName) \(member.lastName)" }

    var body: some View {
        HStack(spacing: Theme.Spacing.s3) {
            RSMAvatarView(name: fullName, personId: member.id, size: 40)
            identity
            Spacer(minLength: Theme.Spacing.s2)
            trailing
        }
        .frame(minHeight: Theme.Size.listRow)
    }

    private var identity: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: Theme.Spacing.s2) {
                Text(verbatim: fullName)
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .lineLimit(1)
                if isSelf {
                    RSMStatusPill(text: "rollen.you", kind: .brand)
                }
            }
            currentRole
        }
    }

    private var currentRole: some View {
        HStack(spacing: Theme.Spacing.s2) {
            Text(RolesL10n.roleLabelKey(member.role))
                .font(Theme.Fonts.caption.weight(.semibold))
                .foregroundStyle(Theme.Colors.inkSoft)
            if member.role == .guestCoach, let until = member.validUntil {
                Text("rollen.guest.until \(RolesFormat.day(until))")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.warn)
            }
        }
    }

    @ViewBuilder private var trailing: some View {
        if canAssign {
            if isSelf || !canChangeTarget {
                // Anzeige-Gate (Referenz 1.3): eigene Rolle nie, Höhergestellte nie.
                HStack(spacing: Theme.Spacing.s1) {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 11, weight: .semibold))
                        .accessibilityHidden(true)
                    Text(isSelf ? "rollen.reason.self" : "rollen.reason.protected")
                        .font(Theme.Fonts.caption)
                }
                .foregroundStyle(Theme.Colors.inkFaint)
            } else {
                RolesInlineRolePicker(
                    current: member.role,
                    options: options,
                    disabled: isChanging,
                    memberName: fullName,
                    onSelect: onChange
                )
            }
        }
    }
}

// MARK: - Inline-Auswahl (Menü)

/// Kompaktes Rollen-Menü in Muldenfarbe. Zeigt die aktuelle Rolle als Label
/// (auch `owner`, das selbst nicht zuweisbar ist) und listet die zuweisbaren
/// Ziele; die aktive Rolle trägt einen Haken. Ein Tap auf die gleiche Rolle ist
/// im ViewModel ein No-op.
struct RolesInlineRolePicker: View {
    let current: ClubRole
    let options: [AssignableClubRole]
    let disabled: Bool
    let memberName: String
    let onSelect: (AssignableClubRole) -> Void

    var body: some View {
        Menu {
            ForEach(options, id: \.self) { role in
                Button {
                    onSelect(role)
                } label: {
                    if role.rawValue == current.rawValue {
                        Label(RolesL10n.roleLabelKey(role), systemImage: "checkmark")
                    } else {
                        Text(RolesL10n.roleLabelKey(role))
                    }
                }
            }
        } label: {
            HStack(spacing: Theme.Spacing.s1) {
                Text(RolesL10n.roleLabelKey(current))
                    .font(Theme.Fonts.caption.weight(.semibold))
                    .foregroundStyle(Theme.Colors.inkPrimary)
                Image(systemName: "chevron.down")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Colors.inkFaint)
            }
            .padding(.horizontal, Theme.Spacing.s3)
            .frame(minHeight: Theme.Size.touchTarget)
            .background(Theme.Colors.bgSunken)
            .clipShape(Capsule())
            .opacity(disabled ? 0.45 : 1)
        }
        .disabled(disabled)
        .accessibilityLabel(Text("rollen.select.a11y \(memberName)"))
    }
}
