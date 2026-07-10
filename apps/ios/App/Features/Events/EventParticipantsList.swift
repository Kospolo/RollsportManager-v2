import SwiftUI

/// Teilnehmer-Karte im Termin-Detail: Antwort-Balken mit Klartext-Zählung,
/// pro Person Avatar · Name · Status-Pill · Absagegrund-Zitat — und in der
/// Trainer-Sicht ein Anwesenheits-Menü (PUT attendance, optimistisch).
struct EventParticipantsList: View {
    @ObservedObject var model: EventDetailViewModel

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(
                    eyebrow: "events.participants.eyebrow",
                    title: "events.participants.title"
                )

                VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                    RSMResponseBar(
                        going: model.counts.going,
                        declined: model.counts.declined,
                        open: model.counts.open + model.counts.maybe
                    )
                    EventsDisplay.countsText(model.counts)
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                }

                if model.participants.isEmpty {
                    Text("events.participants.empty")
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkFaint)
                } else {
                    VStack(spacing: 0) {
                        ForEach(model.participants) { participant in
                            participantRow(participant)
                            if participant.id != model.participants.last?.id {
                                Divider().overlay(Theme.Colors.line)
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Zeile

    private func participantRow(_ participant: EventParticipant) -> some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s3) {
            RSMAvatarView(
                name: participant.displayName ?? "?",
                personId: participant.memberId,
                size: 36
            )
            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                nameText(participant)
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                if let comment = declineComment(participant) {
                    quoteBubble(comment)
                }
            }
            Spacer(minLength: Theme.Spacing.s2)
            VStack(alignment: .trailing, spacing: Theme.Spacing.s1) {
                RSMStatusPill(
                    text: EventsDisplay.rsvpLabelKey(participant.rsvp?.status),
                    kind: EventsDisplay.rsvpPillKind(participant.rsvp?.status)
                )
                if model.canMarkAttendance {
                    attendanceMenu(participant)
                }
            }
        }
        .padding(.vertical, Theme.Spacing.s3)
        .frame(minHeight: Theme.Size.touchTarget)
    }

    private func nameText(_ participant: EventParticipant) -> Text {
        if let name = participant.displayName {
            Text(verbatim: name)
        } else {
            Text("events.participant.unknown")
        }
    }

    /// Absagegrund als Zitat-Blase (Mulden-Fläche, Radius M) —
    /// nur bei Absage/Krank mit Kommentar.
    private func declineComment(_ participant: EventParticipant) -> String? {
        guard let rsvp = participant.rsvp,
              rsvp.status == .declined || rsvp.status == .sick,
              let comment = rsvp.comment,
              !comment.isEmpty
        else { return nil }
        return comment
    }

    private func quoteBubble(_ comment: String) -> some View {
        Text(verbatim: "„\(comment)“")
            .font(Theme.Fonts.caption)
            .italic()
            .foregroundStyle(Theme.Colors.inkSoft)
            .padding(.horizontal, Theme.Spacing.s3)
            .padding(.vertical, Theme.Spacing.s2)
            .background(Theme.Colors.bgSunken)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
    }

    // MARK: - Anwesenheit (Trainer-Sicht)

    private func attendanceMenu(_ participant: EventParticipant) -> some View {
        let current = model.attendanceByMember[participant.memberId]?.status
        return Menu {
            ForEach(AttendanceStatus.allCases, id: \.rawValue) { status in
                Button {
                    _Concurrency.Task {
                        await model.setAttendance(
                            memberId: participant.memberId,
                            status: status
                        )
                    }
                } label: {
                    Label(
                        EventsDisplay.attendanceLabelKey(status),
                        systemImage: EventsDisplay.attendanceIcon(status)
                    )
                }
            }
        } label: {
            HStack(spacing: Theme.Spacing.s1) {
                if let current {
                    RSMStatusPill(
                        text: EventsDisplay.attendanceLabelKey(current),
                        kind: EventsDisplay.attendancePillKind(current)
                    )
                } else {
                    RSMStatusPill(text: "events.attendance.none", kind: .neutral)
                }
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Theme.Colors.inkFaint)
                    .accessibilityHidden(true)
            }
            .frame(minHeight: Theme.Size.touchTarget - Theme.Spacing.s3)
            .contentShape(Rectangle())
        }
        .accessibilityLabel(
            Text("events.attendance.menu.a11y \(participant.displayName ?? "…")")
        )
    }
}
