import SwiftUI

/// DAS BETREIBER-BAND — sichtbar, solange ein Plattform-Admin einen fremden
/// Verein betreten hat. Spiegel von components/shell/OperatorBanner.tsx.
///
/// ### Warum ein Band und kein Toast ###
/// Ein Toast verschwindet, die Einsicht nicht. Wer nach zehn Minuten in der
/// Mitgliederliste steht, hält sich sonst für „normal" unterwegs — und bearbeitet
/// die Daten fremder Kinder im Glauben, es seien die eigenen. Das Band steht deshalb
/// DAUERHAFT, ganz oben, über ALLEN Tabs (in `MainTabView` als `safeAreaInset`), und
/// es lässt sich nicht wegklicken: der einzige Weg, es loszuwerden, ist, die Einsicht
/// wirklich zu beenden.
///
/// ### Es sagt beide Wahrheiten, nicht nur die bequeme ###
/// 1. „Du bist hier nicht du" — Betreiber-Einsicht in <Verein>.
/// 2. „Das hier wird protokolliert" — jeder Zugriff landet append-only im
///    operator_audit_log (Migration 0051), und der Verein selbst kann darin nachlesen.
/// Diesen zweiten Satz wegzulassen wäre die bequemere Oberfläche und die unehrlichere.
///
/// Rendert für alle anderen NICHTS (`operatorClub == nil` ⇒ leerer Inset, 0 pt hoch).
/// `role`/Accessibility = STATUS, nicht Alert: eine dauerhafte Zustandsanzeige, kein
/// Alarm — ein Alert würde VoiceOver bei jedem Screen-Wechsel erneut unterbrechen.
struct OperatorBannerView: View {
    @EnvironmentObject private var session: SessionStore

    /// „Zur Konsole" — in die Betreiber-Konsole, OHNE die Einsicht zu beenden.
    let onConsole: () -> Void
    /// „Einsicht beenden" — Kontext verlassen, zurück in die Konsole.
    let onEnd: () -> Void

    var body: some View {
        if let club = session.operatorClub {
            band(club)
                .transition(.move(edge: .top).combined(with: .opacity))
        }
    }

    private func band(_ club: OperatorClub) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            HStack(spacing: Theme.Spacing.s2) {
                Label("operator.banner.eyebrow", systemImage: "lock.fill")
                    .font(Theme.Fonts.eyebrow.weight(.heavy))
                    .tracking(Theme.Fonts.eyebrowTracking)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.Colors.warn)
                    .accessibilityHidden(true)
                Spacer(minLength: 0)
            }

            Text("operator.banner.viewing \(club.label)")
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
                .fixedSize(horizontal: false, vertical: true)

            Text("operator.banner.logged")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
                .fixedSize(horizontal: false, vertical: true)

            // Beide Wege brechen bei großer Schrift untereinander um.
            ViewThatFits(in: .horizontal) {
                HStack(spacing: Theme.Spacing.s2) { actions }
                VStack(alignment: .leading, spacing: Theme.Spacing.s2) { actions }
            }
            .padding(.top, Theme.Spacing.s1)
        }
        .padding(.horizontal, Theme.Spacing.s5)
        .padding(.vertical, Theme.Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Colors.warnSoft)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Theme.Colors.warn.opacity(0.4))
                .frame(height: 1)
        }
        // STATUS, nicht Alert (s. Kopf). Beide Pflicht-Sätze in EIN Element, damit
        // VoiceOver sie zusammenhängend vorliest.
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isStaticText)
    }

    @ViewBuilder
    private var actions: some View {
        Button(action: onConsole) {
            Label("operator.banner.console", systemImage: "rectangle.on.rectangle")
                .font(Theme.Fonts.caption.weight(.bold))
                .foregroundStyle(Theme.Colors.inkPrimary)
                .padding(.horizontal, Theme.Spacing.s3)
                .frame(minHeight: Theme.Size.touchTarget)
                .background(Theme.Colors.bgSurface)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(Theme.Colors.line, lineWidth: 1))
        }
        .buttonStyle(RSMPressableButtonStyle())

        Button(action: onEnd) {
            Label("operator.banner.end", systemImage: "xmark")
                .font(Theme.Fonts.caption.weight(.bold))
                .foregroundStyle(Theme.Colors.warn)
                .padding(.horizontal, Theme.Spacing.s3)
                .frame(minHeight: Theme.Size.touchTarget)
                .background(Theme.Colors.bgSurface)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(Theme.Colors.warn, lineWidth: 1))
        }
        .buttonStyle(RSMPressableButtonStyle())
    }
}
