import SwiftUI

// ============================================================================
// Rechte-Matrix (ORIGINAL-APP-REFERENZ 1.3) als lesbare Tabelle:
// Rollen (Zeilen) × Fähigkeiten (Spalten), ✓ / – / eingeschränkt.
// Reine Anzeige — die Durchsetzung passiert serverseitig. Web-Referenz:
// apps/web/app/(portal)/verwaltung/rollen/PermissionMatrix.tsx.
//
// Die Tabelle ist bewusst horizontal scrollbar (7 Rollen × 5 Spalten passen auf
// iPhone-Breite nicht ohne Quetschen — analog `overflow-x-auto` im Web).
// ============================================================================

struct RolesMatrixView: View {
    private let roleColumnWidth: CGFloat = 172
    private let capColumnWidth: CGFloat = 68
    /// Rolle + 5 Fähigkeiten = 6 Spalten (für die durchgehenden Trennlinien).
    private let columnCount = 1 + RolesCapability.allCases.count

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(
                    eyebrow: "rollen.matrix.eyebrow",
                    title: "rollen.matrix.title"
                )
                ScrollView(.horizontal, showsIndicators: false) {
                    matrixGrid
                }
                footnotes
            }
        }
    }

    // MARK: - Tabelle

    private var matrixGrid: some View {
        Grid(
            alignment: .center,
            horizontalSpacing: Theme.Spacing.s2,
            verticalSpacing: Theme.Spacing.s3
        ) {
            GridRow {
                headerText("rollen.col.role")
                    .frame(width: roleColumnWidth, alignment: .leading)
                ForEach(RolesCapability.allCases, id: \.self) { capability in
                    headerText(RolesL10n.capHeaderKey(capability))
                        .frame(width: capColumnWidth)
                }
            }
            Divider().overlay(Theme.Colors.line).gridCellColumns(columnCount)

            ForEach(rolesRoleOrder, id: \.self) { role in
                GridRow {
                    roleCell(role)
                        .frame(width: roleColumnWidth, alignment: .leading)
                    ForEach(RolesCapability.allCases, id: \.self) { capability in
                        RolesCapCell(
                            state: rolesCapState(role, capability),
                            mark: rolesFootnoteMark(role, capability)
                        )
                        .frame(width: capColumnWidth)
                    }
                }
                if role != rolesRoleOrder.last {
                    Divider().overlay(Theme.Colors.line).gridCellColumns(columnCount)
                }
            }
        }
    }

    private func headerText(_ key: LocalizedStringKey) -> some View {
        Text(key)
            .font(Theme.Fonts.eyebrow)
            .tracking(Theme.Fonts.eyebrowTracking)
            .textCase(.uppercase)
            .foregroundStyle(Theme.Colors.inkFaint)
    }

    private func roleCell(_ role: ClubRole) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            RSMStatusPill(
                text: RolesL10n.roleLabelKey(role),
                kind: RolesL10n.roleTone(role)
            )
            Text(RolesL10n.roleDescKey(role))
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.vertical, Theme.Spacing.s1)
    }

    // MARK: - Fußnoten & Plattform-Hinweis

    private var footnotes: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            footnote(mark: "*", key: "rollen.fn.moderator")
            footnote(mark: "†", key: "rollen.fn.guest")
            HStack(alignment: .top, spacing: Theme.Spacing.s2) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Colors.inkFaint)
                    .accessibilityHidden(true)
                Text("rollen.platform.note")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
        .padding(.top, Theme.Spacing.s1)
    }

    private func footnote(mark: String, key: LocalizedStringKey) -> some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s2) {
            Text(verbatim: mark)
                .font(Theme.Fonts.caption.weight(.bold))
                .foregroundStyle(Theme.Colors.warn)
                .accessibilityHidden(true)
            Text(key)
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
    }
}

// MARK: - Zelle

/// Eine Matrix-Zelle: ✓ (grün) / eingeschränkt (Warn-Haken + Marker) / – (faint).
/// „Status nie nur über Farbe“: jede Zelle trägt ein Screenreader-Wort.
struct RolesCapCell: View {
    let state: RolesCapState
    let mark: String?

    var body: some View {
        content
            .frame(maxWidth: .infinity)
            .accessibilityLabel(Text(a11yKey))
    }

    @ViewBuilder private var content: some View {
        switch state {
        case .yes:
            Image(systemName: "checkmark")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Theme.Colors.success)
        case .partial:
            HStack(alignment: .top, spacing: 1) {
                Image(systemName: "checkmark")
                    .font(.system(size: 13, weight: .bold))
                if let mark {
                    Text(verbatim: mark)
                        .font(.system(size: 10, weight: .bold))
                }
            }
            .foregroundStyle(Theme.Colors.warn)
        case .no:
            Text(verbatim: "–")
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkFaint)
        }
    }

    private var a11yKey: LocalizedStringKey {
        switch state {
        case .yes: "rollen.a11y.yes"
        case .no: "rollen.a11y.no"
        case .partial: "rollen.a11y.partial"
        }
    }
}
