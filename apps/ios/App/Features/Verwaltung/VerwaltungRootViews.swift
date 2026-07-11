import SwiftUI

// ============================================================================
// Platzhalter-Root-Views der vier Verwaltungs-Bereiche.
//
// Stabile Aufrufpunkte (analog NewsRootView & Co.): der „Mehr"-Deeplink und
// der Verwaltungs-Hub verdrahten diese Typen; die jeweiligen Fach-Teams
// ersetzen den `ModuleScaffoldView`-Body durch ihre echte Umsetzung. Endpoints
// (updateMember/changeMemberRole/createTeam/updateTeam/deleteTeam/
// setTeamMembers/updateClubSettings) und das Gating (`permissions()`) stehen
// bereit — hier fehlt bewusst nur noch die Fach-UI.
// ============================================================================

/// Mitglieder-Verwaltung — Stammdaten pflegen (Endpoint `updateMember`).
/// Web-Referenz: /(portal)/verwaltung/mitglieder.
struct MembersAdminRootView: View {
    var body: some View {
        AdminMembersView()
    }
}

/// Rollen & Rechte — Rollenwechsel (Endpoint `changeMemberRole`) + Rechte-Matrix.
/// Web-Referenz: /(portal)/verwaltung/rollen.
struct RolesRootView: View {
    var body: some View {
        AdminRolesView()
    }
}

/// Teams — anlegen/umbenennen/löschen + Roster (createTeam/updateTeam/
/// deleteTeam/setTeamMembers). Web-Referenz: /(portal)/verwaltung/teams.
struct TeamsAdminRootView: View {
    var body: some View {
        AdminTeamsView()
    }
}

/// Vereins-Einstellungen — Stammdaten/`settings` (Endpoint `updateClubSettings`).
/// Web-Referenz: /(portal)/verwaltung/verein.
struct ClubSettingsRootView: View {
    var body: some View {
        AdminClubSettingsView()
    }
}
