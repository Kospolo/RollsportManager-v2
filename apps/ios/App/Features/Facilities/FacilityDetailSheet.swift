import SwiftUI

/// Detail-Sheet einer Halle: Stammdaten (Art, Ort, Kapazität, Hinweise) und die
/// kommenden Buchungen nach Datum gruppiert. „Hier buchen“ öffnet das
/// Buchen-Sheet (Halle vorbelegt). Überschneidungen werden je Buchung als
/// Warn-Chip markiert. Buchungen sind hier bewusst nur lesbar — der Dev-Stack
/// stellt (Stand jetzt) keinen Lösch-Endpoint bereit.
/// Web-Referenz: belegungsplan/_components/FacilityDetailSheet.tsx.
struct FacilityDetailSheet: View {
    let facility: Facility
    /// Buchungen genau dieser Halle (für Liste + Überschneidungs-Markierung).
    let bookings: [FacilityBooking]
    let bookerName: (FacilityBooking) -> String?
    let teamName: (String?) -> String?
    let onBook: () -> Void

    @Environment(\.dismiss) private var dismiss

    private var days: [BelegungLogic.DayGroup] {
        BelegungLogic.groupByDay(BelegungLogic.upcomingBookings(bookings))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    RSMCard {
                        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                            cardHeader
                            metaSection
                        }
                    }
                    upcomingSection
                    RSMPrimaryButton(title: "belegungsplan.detail.bookHere", action: onBook)
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text(verbatim: facility.name))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("belegungsplan.detail.close") { dismiss() }
                        .tint(Theme.Colors.inkSoft)
                }
            }
        }
        .presentationDragIndicator(.visible)
    }

    // MARK: - Kopf + Stammdaten

    /// Eyebrow „Trainingsstätte“ über dem (dynamischen) Hallennamen — verbatim,
    /// damit der Name nicht als String-Catalog-Schlüssel behandelt wird.
    private var cardHeader: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            Text("belegungsplan.detail.eyebrow")
                .font(Theme.Fonts.eyebrow)
                .tracking(Theme.Fonts.eyebrowTracking)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.inkFaint)
            Text(verbatim: facility.name)
                .font(Theme.Fonts.h3)
                .foregroundStyle(Theme.Colors.inkPrimary)
        }
        .accessibilityElement(children: .combine)
    }

    private var metaSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            RSMStatusPill(text: BelegungDisplay.kindLabelKey(facility.kind), kind: .brand)

            if let address = facility.address, !address.isEmpty {
                metaRow(icon: "mappin.and.ellipse", label: "belegungsplan.detail.meta.address") {
                    Text(verbatim: address)
                }
            }
            if let capacity = facility.capacity {
                metaRow(icon: "person.3.fill", label: "belegungsplan.detail.meta.capacity") {
                    Text("belegungsplan.capacity \(capacity)").monospacedDigit()
                }
            }
            if let notes = facility.notes, !notes.isEmpty {
                metaRow(icon: "note.text", label: "belegungsplan.detail.meta.notes") {
                    Text(verbatim: notes)
                }
            }
        }
    }

    private func metaRow(
        icon: String,
        label: LocalizedStringKey,
        @ViewBuilder value: () -> some View
    ) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            Label {
                Text(label)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            } icon: {
                Image(systemName: icon)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Colors.inkFaint)
            }
            value()
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Kommende Buchungen

    private var upcomingSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            Text("belegungsplan.detail.upcoming")
                .font(Theme.Fonts.eyebrow)
                .tracking(Theme.Fonts.eyebrowTracking)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.inkFaint)
                .padding(.leading, Theme.Spacing.s1)

            if days.isEmpty {
                RSMCard {
                    Text("belegungsplan.detail.noUpcoming")
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
            } else {
                ForEach(days) { day in
                    dayGroup(day)
                }
            }
        }
    }

    private func dayGroup(_ day: BelegungLogic.DayGroup) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s2) {
                Text(verbatim: BelegungDisplay.absoluteDate(day.iso))
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                Text(verbatim: BelegungDisplay.relativeDate(day.iso))
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
            .padding(.leading, Theme.Spacing.s1)

            ForEach(day.bookings, id: \.id) { booking in
                bookingRow(booking)
            }
        }
    }

    private func bookingRow(_ booking: FacilityBooking) -> some View {
        RSMCard(padding: Theme.Spacing.s4) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                HStack(spacing: Theme.Spacing.s2) {
                    Text(verbatim: BelegungDisplay.timeRange(booking.startsAt, booking.endsAt))
                        .font(Theme.Fonts.monoTable)
                        .monospacedDigit()
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    RSMStatusPill(
                        text: BelegungDisplay.statusLabelKey(booking.status),
                        kind: BelegungDisplay.statusTone(booking.status)
                    )
                    if BelegungLogic.hasConflict(booking, in: bookings) {
                        RSMStatusPill(text: "belegungsplan.conflict", kind: .warn)
                    }
                }

                Text(verbatim: booking.title)
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)

                metaLine(booking)
            }
        }
    }

    private func metaLine(_ booking: FacilityBooking) -> some View {
        HStack(spacing: Theme.Spacing.s4) {
            Label {
                Text("belegungsplan.detail.bookedBy \(bookerName(booking) ?? unknownMember)")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            } icon: {
                Image(systemName: "person.fill")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Colors.inkFaint)
            }
            if let team = teamName(booking.teamId) {
                Label {
                    Text(verbatim: team)
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                } icon: {
                    Image(systemName: "person.2.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.Colors.inkFaint)
                }
            }
        }
    }

    private var unknownMember: String {
        NSLocalizedString("belegungsplan.unknownMember", comment: "Bucher nicht auflösbar")
    }
}
