import SwiftUI

/// Wettkampf-Countdown-Hero (Design-System §3.9): brand-soft-Tint,
/// Display-Zahl, Klartext-Meta — KEIN Gradient, KEINE Animation.
struct DashboardCountdownCard: View {
    /// Hero-Zahl des Countdowns: haengt an der Schrift, also mit @ScaledMetric
    /// mitwachsen lassen — Font.system(size:) allein wuerde sie einfrieren.
    @ScaledMetric(relativeTo: .largeTitle) private var countdownSize: CGFloat = 44

    let competition: Competition
    /// Kalendertage bis zum Start (0 = heute).
    let days: Int
    /// Gemeldete Mitglieder (nicht zurückgezogen) für den Avatar-Stack.
    let entrants: [ClubMember]

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
            HStack(spacing: Theme.Spacing.s2) {
                Image(systemName: "trophy.fill")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(WarmPalette.goldDeep)
                    .accessibilityHidden(true)
                Text("dashboard.countdown.eyebrow")
                    .font(Theme.Fonts.eyebrow)
                    .tracking(Theme.Fonts.eyebrowTracking)
                    .textCase(.uppercase)
                    .foregroundStyle(WarmPalette.goldDeep)
            }

            countdownLine

            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                Text(competition.name)
                    .font(Theme.Fonts.h3)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                Text(metaLine)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }

            if !entrants.isEmpty {
                HStack(spacing: Theme.Spacing.s3) {
                    DashboardAvatarStack(
                        members: entrants,
                        ringColor: WarmPalette.goldSoft
                    )
                    // Die Klartext-Zeile trägt die Information — der Stack
                    // ist rein visuell (accessibilityHidden).
                    Text("dashboard.countdown.entrants \(entrants.count)")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.Spacing.s5)
        .background(WarmPalette.goldSoft)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    /// „12 | Tage bis zum Start“ — bzw. „Heute ist Wettkampftag!“.
    @ViewBuilder
    private var countdownLine: some View {
        if days == 0 {
            Text("dashboard.countdown.today")
                .font(Theme.Fonts.display)
                .tracking(Theme.Fonts.displayTracking)
                .foregroundStyle(WarmPalette.goldDeep)
        } else {
            HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s2) {
                Text("\(days)")
                    .font(Theme.Fonts.display(size: countdownSize))
                    .monospacedDigit()
                    .foregroundStyle(WarmPalette.goldDeep)
                Text(days == 1
                    ? LocalizedStringKey("dashboard.countdown.unit.one")
                    : LocalizedStringKey("dashboard.countdown.unit.other"))
                    .font(Theme.Fonts.h3)
                    .foregroundStyle(Theme.Colors.inkPrimary)
            }
        }
    }

    /// „Sa. 19.7. · 08:30 · Ludwigsburg“ — Klartext-Meta unter dem Titel.
    private var metaLine: String {
        var parts: [String] = []
        if let start = DashboardFormat.parseISO(competition.startsAt) {
            parts.append(
                "\(DashboardFormat.weekdayShortText(start)) \(DashboardFormat.dayMonthText(start))"
            )
            parts.append(DashboardFormat.timeText(start))
        }
        if let location = competition.location, !location.isEmpty {
            parts.append(location)
        }
        return parts.joined(separator: " · ")
    }
}

/// Überlappende Avatar-Reihe mit „+n“-Überlauf — rein dekorativ,
/// die Information trägt immer eine Klartext-Zeile daneben.
struct DashboardAvatarStack: View {
    let members: [ClubMember]
    var ringColor: Color = Theme.Colors.bgSurface
    var maxVisible = 5
    var size: CGFloat = 28

    var body: some View {
        HStack(spacing: -size * 0.3) {
            ForEach(members.prefix(maxVisible), id: \.id) { member in
                RSMAvatarView(
                    name: "\(member.firstName) \(member.lastName)",
                    personId: member.id,
                    size: size
                )
                .overlay(Circle().stroke(ringColor, lineWidth: 2))
            }
            if members.count > maxVisible {
                ZStack {
                    Circle().fill(Theme.Colors.bgSunken)
                    Text(verbatim: "+\(members.count - maxVisible)")
                        .font(Theme.Fonts.body(size: size * 0.38, weight: .bold))
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
                .frame(width: size, height: size)
                .overlay(Circle().stroke(ringColor, lineWidth: 2))
            }
        }
        .accessibilityHidden(true)
    }
}
