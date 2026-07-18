import SwiftUI

/// „Meine Stunden“-Karte: Soll (aus der Pflichtstunden-Kaskade) gegen Ist
/// (Summe der eigenen Einträge) als KPI-Trio + Fortschrittsbalken + Rest.
/// Ohne aktive Regel zeigt die Karte einen Hinweis statt eines leeren Balkens —
/// geleistete Stunden werden trotzdem beziffert. Web-Referenz: MyHoursCard.tsx.
struct MyHoursCard: View {
    let progress: DutyProgress

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(
                    eyebrow: "pflichtstunden.mine.eyebrow",
                    title: "pflichtstunden.mine.title"
                )
                if progress.hasSoll {
                    withSoll
                } else {
                    noSoll
                }
            }
        }
    }

    // MARK: - Mit aktivem Soll

    private var withSoll: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
            HStack(alignment: .top, spacing: Theme.Spacing.s2) {
                DutyKpiTile(
                    eyebrow: "pflichtstunden.kpi.soll",
                    value: DutyHoursFormat.hours(progress.soll),
                    caption: DutyHoursFormat.sollCaption(
                        level: progress.level, seasonLabel: progress.seasonLabel
                    )
                )
                DutyKpiTile(
                    eyebrow: "pflichtstunden.kpi.ist",
                    value: DutyHoursFormat.hours(progress.ist),
                    caption: progress.istApproved < progress.ist
                        ? DutyHoursFormat.approvedCaption(istApproved: progress.istApproved)
                        : nil,
                    valueColor: Theme.Colors.info
                )
                DutyKpiTile(
                    eyebrow: "pflichtstunden.kpi.rest",
                    value: DutyHoursFormat.hours(progress.rest),
                    caption: progress.pending > 0
                        ? DutyHoursFormat.pendingCaption(count: progress.pending)
                        : nil,
                    valueColor: progress.fulfilled ? Theme.Colors.success : Theme.Colors.warn
                )
            }

            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                HStack {
                    Text(verbatim: DutyHoursFormat.progressCaption(ist: progress.ist, soll: progress.soll))
                        .font(Theme.Fonts.caption.weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(Theme.Colors.inkSoft)
                    Spacer(minLength: Theme.Spacing.s2)
                    RSMStatusPill(
                        text: progress.fulfilled ? "pflichtstunden.badge.fulfilled" : "pflichtstunden.badge.open",
                        kind: progress.fulfilled ? .success : .neutral
                    )
                }
                DutyProgressBar(fraction: progress.fraction, fulfilled: progress.fulfilled)
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel(Text(verbatim: DutyHoursFormat.progressCaption(ist: progress.ist, soll: progress.soll)))
        }
    }

    // MARK: - Ohne Soll

    private var noSoll: some View {
        HStack(alignment: .center, spacing: Theme.Spacing.s4) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                Text("pflichtstunden.sollNone.title")
                    .font(Theme.Fonts.h3)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                Text("pflichtstunden.sollNone.body")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            DutyKpiTile(
                eyebrow: "pflichtstunden.kpi.ist",
                value: DutyHoursFormat.hours(progress.ist),
                caption: progress.pending > 0
                    ? DutyHoursFormat.pendingCaption(count: progress.pending)
                    : nil
            )
            .frame(maxWidth: 140)
        }
    }
}

/// KPI-Kachel der Pflichtstunden: Eyebrow → Display-Zahl → Klartext-Caption.
/// Feature-lokal (wie `MineSummaryView`), weil die Caption ein Laufzeit-String
/// mit eingesetzten Werten ist; Optik folgt `RSMKpiTile`/Theme-Tokens.
struct DutyKpiTile: View {
    let eyebrow: LocalizedStringKey
    /// Bereits formatierter Wert („12,5 h“).
    let value: String
    var caption: String? = nil
    var valueColor: Color = Theme.Colors.inkPrimary

    /// Die KPI-Zahl haengt an der Schrift, nicht am Layout: @ScaledMetric laesst
    /// die 21 pt mit den Systemeinstellungen mitwachsen (Font.system(size:) allein
    /// wuerde sie einfrieren).
    @ScaledMetric(relativeTo: .title3) private var valueSize: CGFloat = 21

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            Text(eyebrow)
                .font(Theme.Fonts.eyebrow)
                .tracking(Theme.Fonts.eyebrowTracking)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.inkFaint)
            Text(verbatim: value)
                .font(Theme.Fonts.display(size: valueSize))
                .monospacedDigit()
                .minimumScaleFactor(0.9)
                .lineLimit(1)
                .foregroundStyle(valueColor)
            if let caption {
                Text(verbatim: caption)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(Theme.Spacing.s3)
        .background(Theme.Colors.bgCanvas)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

/// Einfacher Fortschrittsbalken (8 pt): Mulde + gefüllter Anteil. REIN visuell
/// (`accessibilityHidden`) — die Zahl trägt die Klartext-Zeile daneben.
struct DutyProgressBar: View {
    /// 0…1.
    let fraction: Double
    let fulfilled: Bool

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.Colors.bgSunken)
                Capsule()
                    .fill(fulfilled ? Theme.Colors.success : Theme.Colors.brand)
                    .frame(width: fraction > 0 ? max(geo.size.width * fraction, 6) : 0)
            }
        }
        .frame(height: 8)
        .clipShape(Capsule())
        .accessibilityHidden(true)
    }
}

/// Zeile der eigenen Einträge: Stunden (mono) · Art-Pille · Status-Pille,
/// darunter Datum · Notiz. Web-Referenz: MyEntryList.tsx.
struct DutyEntryRow: View {
    let entry: DutyEntry

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            HStack(spacing: Theme.Spacing.s2) {
                Text(verbatim: DutyHoursFormat.hours(entry.hours ?? 0))
                    .font(Theme.Fonts.monoTable.weight(.bold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkPrimary)
                RSMStatusPill(
                    text: DutyHoursFormat.kindLabelKey(entry.kind),
                    kind: DutyHoursFormat.kindTone(entry.kind)
                )
                Spacer(minLength: Theme.Spacing.s2)
                RSMStatusPill(
                    text: entry.approved ? "pflichtstunden.status.approved" : "pflichtstunden.status.pending",
                    kind: entry.approved ? .success : .neutral
                )
            }
            Text(verbatim: DutyHoursFormat.entryLine(date: entry.activityDate, note: entry.note))
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}
