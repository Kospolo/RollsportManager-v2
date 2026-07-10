import SwiftUI

/// Detail-Sheet eines Termins: Meta-Karte, eigene Rückmeldung (optimistisch,
/// Kommentar bei Absage), Teilnehmerliste mit Status-Pills und — für die
/// Trainer-Sicht — Anwesenheits-Erfassung.
struct EventDetailSheet: View {
    @StateObject private var model: EventDetailViewModel
    @Environment(\.dismiss) private var dismiss

    init(
        event: Event,
        api: APIClient,
        clubId: String,
        myMemberId: String,
        clubRole: ClubRole?,
        teamsById: [String: Team],
        membersById: [String: ClubMember],
        onEventUpdated: @escaping (Event) -> Void
    ) {
        _model = StateObject(wrappedValue: EventDetailViewModel(
            event: event,
            api: api,
            clubId: clubId,
            myMemberId: myMemberId,
            clubRole: clubRole,
            teamsById: teamsById,
            membersById: membersById,
            onEventUpdated: onEventUpdated
        ))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    metaCard
                    rsvpCard
                    EventParticipantsList(model: model)
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text("events.detail.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("events.detail.close") { dismiss() }
                        .font(Theme.Fonts.bodyStrong)
                        .tint(Theme.Colors.brand)
                        .accessibilityLabel(Text("events.detail.a11y.close"))
                }
            }
            .task { await model.loadAttendanceIfNeeded() }
            .alert("events.error.title", isPresented: errorBinding) {
                Button("events.error.ok", role: .cancel) {}
            } message: {
                Text(verbatim: model.errorMessage ?? "")
            }
        }
        .presentationDragIndicator(.visible)
    }

    private var errorBinding: Binding<Bool> {
        Binding(
            get: { model.errorMessage != nil },
            set: { if !$0 { model.errorMessage = nil } }
        )
    }

    // MARK: - Meta

    private var metaCard: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                RSMStatusPill(
                    text: EventsDisplay.typeLabelKey(model.event.type),
                    kind: EventsDisplay.typePillKind(model.event.type)
                )
                Text(verbatim: model.event.title)
                    .font(Theme.Fonts.h2)
                    .foregroundStyle(Theme.Colors.inkPrimary)

                VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                    if let start = EventsISO.date(from: model.event.startsAt) {
                        metaLine(
                            icon: "calendar",
                            text: start.formatted(date: .complete, time: .omitted)
                        )
                    }
                    metaLine(icon: "clock", text: timeRange)
                    if let location = model.event.location, !location.isEmpty {
                        metaLine(icon: "mappin.and.ellipse", text: location)
                    }
                }

                if !model.eventTeams.isEmpty {
                    HStack(spacing: Theme.Spacing.s1) {
                        ForEach(model.eventTeams, id: \.id) { team in
                            RSMStatusPill(text: "\(team.name)", kind: .neutral)
                        }
                    }
                }

                if let note = model.event.note, !note.isEmpty {
                    noteBubble(note)
                }
            }
        }
    }

    private var timeRange: String {
        "\(EventsDisplay.time(model.event.startsAt)) – \(EventsDisplay.time(model.event.endsAt))"
    }

    private func metaLine(icon: String, text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s2) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Theme.Colors.inkFaint)
                .frame(width: 18)
                .accessibilityHidden(true)
            Text(verbatim: text)
                .font(Theme.Fonts.body)
                .monospacedDigit()
                .foregroundStyle(Theme.Colors.inkSoft)
        }
        .accessibilityElement(children: .combine)
    }

    private func noteBubble(_ note: String) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            Text("events.detail.note.title")
                .font(Theme.Fonts.caption.weight(.semibold))
                .foregroundStyle(Theme.Colors.inkFaint)
            Text(verbatim: note)
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.Spacing.s3)
        .background(Theme.Colors.bgSunken)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
    }

    // MARK: - Eigene Rückmeldung

    private var rsvpCard: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(eyebrow: "events.rsvp.eyebrow", title: "events.rsvp.title")
                HStack(spacing: Theme.Spacing.s2) {
                    rsvpChoice(.going)
                    rsvpChoice(.maybe)
                    rsvpChoice(.declined)
                }
                if model.isDeclineExpanded {
                    declineArea
                }
            }
        }
    }

    private func rsvpChoice(_ status: RsvpStatus) -> some View {
        let isSelected = model.myRsvp?.status == status
            || (status == .declined && model.myRsvp?.status == .sick)
        return Button {
            _Concurrency.Task { await model.selectStatus(status) }
        } label: {
            HStack(spacing: Theme.Spacing.s1) {
                Image(systemName: choiceIcon(status))
                    .font(.system(size: 12, weight: .semibold))
                Text(choiceLabelKey(status))
                    .font(Theme.Fonts.bodyStrong)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, minHeight: Theme.Size.touchTarget)
            .foregroundStyle(isSelected ? choiceForeground(status) : Theme.Colors.inkSoft)
            .background(isSelected ? choiceBackground(status) : Theme.Colors.bgSunken)
            .clipShape(Capsule())
        }
        .buttonStyle(RSMPressableButtonStyle())
        .disabled(model.isSavingRsvp)
        .accessibilityLabel(Text(choiceA11yKey(status)))
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }

    private var declineArea: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            TextField(
                "events.rsvp.comment.placeholder",
                text: $model.declineComment,
                axis: .vertical
            )
            .font(Theme.Fonts.body)
            .foregroundStyle(Theme.Colors.inkPrimary)
            .lineLimit(2...4)
            .padding(Theme.Spacing.s3)
            .background(Theme.Colors.bgSunken)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
            .accessibilityLabel(Text("events.rsvp.comment.a11y"))

            Button {
                _Concurrency.Task { await model.sendDecline() }
            } label: {
                HStack(spacing: Theme.Spacing.s2) {
                    if model.isSavingRsvp {
                        ProgressView().tint(Theme.Colors.danger)
                    }
                    Text("events.rsvp.comment.send")
                        .font(Theme.Fonts.bodyStrong)
                }
                .frame(maxWidth: .infinity, minHeight: Theme.Size.touchTarget)
                .foregroundStyle(Theme.Colors.danger)
                .background(Theme.Colors.dangerSoft)
                .clipShape(Capsule())
            }
            .buttonStyle(RSMPressableButtonStyle())
            .disabled(model.isSavingRsvp)
        }
    }

    private func choiceLabelKey(_ status: RsvpStatus) -> LocalizedStringKey {
        switch status {
        case .going: "events.rsvp.going"
        case .maybe: "events.rsvp.maybe"
        default: "events.rsvp.declined"
        }
    }

    private func choiceA11yKey(_ status: RsvpStatus) -> LocalizedStringKey {
        switch status {
        case .going: "events.rsvp.a11y.going"
        case .maybe: "events.rsvp.a11y.maybe"
        default: "events.rsvp.a11y.declined"
        }
    }

    private func choiceIcon(_ status: RsvpStatus) -> String {
        switch status {
        case .going: "checkmark"
        case .maybe: "questionmark"
        default: "xmark"
        }
    }

    private func choiceForeground(_ status: RsvpStatus) -> Color {
        switch status {
        case .going: Theme.Colors.success
        case .maybe: Theme.Colors.info
        default: Theme.Colors.danger
        }
    }

    private func choiceBackground(_ status: RsvpStatus) -> Color {
        switch status {
        case .going: Theme.Colors.successSoft
        case .maybe: Theme.Colors.infoSoft
        default: Theme.Colors.dangerSoft
        }
    }
}
