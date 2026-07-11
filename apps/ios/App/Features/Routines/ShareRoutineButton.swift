import SwiftUI

/// Wiederverwendbarer „Kür teilen“-Auslöser für die Kür-Detail-Toolbar.
///
/// Sichtbar NUR für Trainer:innen — die Rolle kommt aus dem `SessionStore`
/// (`profile.clubRole`) und spiegelt die Web-Referenz
/// `permissions(currentUser).isTrainer` = owner / admin / moderator / coach.
/// `guest_coach` ist team-/zeitgebunden und hier — wie im Web — bewusst `false`.
/// Das verbindliche Gate bleibt serverseitig (POST/DELETE `.../share` liefern
/// sonst 403); der Dialog fängt das als freundlichen Hinweis ab.
///
/// Öffnet den `ShareRoutineDialog` als Sheet. So bleibt das Kür-Detail
/// minimal-invasiv: ein einziger, in sich geschlossener Trigger.
/// Web-Referenz: kueren/[id]/RoutineDetail (`canShare`).
struct ShareRoutineButton: View {
    let routineId: String
    let routineTitle: String

    @EnvironmentObject private var session: SessionStore
    @State private var showShare = false

    /// Trainer:innen-Rollen, die Küren teilen dürfen (reines Sichtbarkeits-Gate).
    private static let trainerRoles: Set<ClubRole> = [.owner, .admin, .moderator, .coach]

    private var canShare: Bool {
        guard let role = session.session?.profile.clubRole else { return false }
        return Self.trainerRoles.contains(role)
    }

    var body: some View {
        if canShare {
            Button {
                showShare = true
            } label: {
                Image(systemName: "square.and.arrow.up")
            }
            .accessibilityLabel(Text("share.title"))
            .sheet(isPresented: $showShare) {
                ShareRoutineDialog(routineId: routineId, routineTitle: routineTitle)
                    .environmentObject(session)
            }
#if DEBUG
            // NUR DEBUG/Smoke-Test: `-devAutoShare YES` öffnet den Teilen-Dialog
            // direkt (additive Deeplink-Automation für den Parity-Screenshot).
            .onAppear {
                if UserDefaults.standard.bool(forKey: "devAutoShare") {
                    showShare = true
                }
            }
#endif
        }
    }
}
