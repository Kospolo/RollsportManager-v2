import SwiftUI

/// „Selbst einchecken": jedes Mitglied trägt sich für seinen heutigen/nächsten
/// Termin ein (createCheckin, `method = .manual`, memberId = eigenes Mitglied).
/// Serverseitig erlaubt fürs eigene Mitglied ODER den Trainerstab; ein 403 kommt
/// als Klartext-Hinweis zurück. Vorbelegt ist der erste heutige Termin.
struct SelfCheckinCard: View {
    @ObservedObject var model: CheckinViewModel

    @State private var eventId = ""
    @State private var didInitEvent = false
    @State private var submitting = false
    @State private var status: CheckinActionStatus?

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
            CheckinSectionHeader(title: "checkin.self.title", subtitle: "checkin.self.sub")
            RSMCard {
                VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                    CheckinEventMenu(
                        selection: $eventId,
                        today: model.todayEvents,
                        upcoming: model.upcomingEvents
                    )
                    if model.checkedInToday {
                        Text("checkin.self.todayNote")
                            .font(Theme.Fonts.caption.weight(.semibold))
                            .foregroundStyle(Theme.Colors.success)
                    }
                    if let status { CheckinStatusLine(tone: status.tone, text: status.text) }
                    RSMPrimaryButton(title: "checkin.self.cta", isLoading: submitting, action: submit)
                }
            }
        }
        .onAppear {
            guard !didInitEvent else { return }
            didInitEvent = true
            eventId = model.defaultEventId
        }
    }

    private func submit() {
        guard !submitting else { return }
        submitting = true
        status = nil
        _Concurrency.Task { @MainActor in
            do {
                try await model.submitCheckin(memberId: model.myMemberId, eventId: eventId)
                status = CheckinActionStatus(tone: .success, text: Text("checkin.self.doneToast"))
            } catch {
                status = CheckinActionStatus(tone: .danger, text: checkinErrorText(error))
            }
            submitting = false
        }
    }
}

/// „Mitglied einchecken" (nur Trainerstab): manuelles Einchecken eines
/// beliebigen aktiven Vereinsmitglieds (createCheckin, `method = .manual`).
/// Serverseitig darf das NUR der Trainerstab — ein 403 kommt als Hinweis
/// zurück, die Auswahl bleibt erhalten.
struct TrainerCheckinCard: View {
    @ObservedObject var model: CheckinViewModel

    @State private var memberId = ""
    @State private var eventId = ""
    @State private var memberError = false
    @State private var submitting = false
    @State private var status: CheckinActionStatus?

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
            CheckinSectionHeader(title: "checkin.trainer.title", subtitle: "checkin.trainer.sub")
            RSMCard {
                VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                    memberField
                    CheckinEventMenu(
                        selection: $eventId,
                        today: model.todayEvents,
                        upcoming: model.upcomingEvents
                    )
                    if let status { CheckinStatusLine(tone: status.tone, text: status.text) }
                    RSMPrimaryButton(title: "checkin.trainer.cta", isLoading: submitting, action: submit)
                }
            }
        }
    }

    private var memberField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text("checkin.trainer.memberLabel")
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
            Menu {
                ForEach(model.activeMembersSorted, id: \.id) { member in
                    Button {
                        memberId = member.id
                        memberError = false
                        status = nil
                    } label: {
                        checkmarkRow(CheckinViewModel.fullName(member), selected: memberId == member.id)
                    }
                }
            } label: {
                CheckinMenuLabel(title: selectedMemberName, isPlaceholder: memberId.isEmpty)
            }
            if memberError {
                Text("checkin.trainer.memberError")
                    .font(Theme.Fonts.caption.weight(.semibold))
                    .foregroundStyle(Theme.Colors.danger)
            }
        }
    }

    private var selectedMemberName: String {
        memberId.isEmpty
            ? String(localized: "checkin.trainer.memberPlaceholder")
            : model.memberName(for: memberId)
    }

    private func submit() {
        guard !submitting else { return }
        guard !memberId.isEmpty else {
            memberError = true
            return
        }
        submitting = true
        status = nil
        let name = model.memberName(for: memberId)
        _Concurrency.Task { @MainActor in
            do {
                try await model.submitCheckin(memberId: memberId, eventId: eventId)
                status = CheckinActionStatus(tone: .success, text: Text("checkin.trainer.doneToast \(name)"))
                memberId = ""
            } catch {
                status = CheckinActionStatus(tone: .danger, text: checkinErrorText(error))
            }
            submitting = false
        }
    }
}

/// Geteilte Termin-Auswahl fürs Einchecken (Selbst-Service + Trainer, Web:
/// EventSelect): „Ohne Termin" plus zwei Gruppen — heutige Termine zuerst,
/// danach die kommenden. Wert ist die Event-ID ("" = ohne Termin).
struct CheckinEventMenu: View {
    @Binding var selection: String
    let today: [Event]
    let upcoming: [Event]

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text("checkin.event.label")
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
            Menu {
                Button { selection = "" } label: {
                    checkmarkRowKey("checkin.event.none", selected: selection.isEmpty)
                }
                if !today.isEmpty {
                    Section("checkin.event.today") {
                        ForEach(today, id: \.id) { event in
                            Button { selection = event.id } label: {
                                checkmarkRow(todayLabel(event), selected: selection == event.id)
                            }
                        }
                    }
                }
                if !upcoming.isEmpty {
                    Section("checkin.event.upcoming") {
                        ForEach(upcoming, id: \.id) { event in
                            Button { selection = event.id } label: {
                                checkmarkRow(upcomingLabel(event), selected: selection == event.id)
                            }
                        }
                    }
                }
            } label: {
                CheckinMenuLabel(title: selectedLabel, isPlaceholder: false)
            }
            Text("checkin.event.hint")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkFaint)
        }
    }

    private var selectedLabel: String {
        guard !selection.isEmpty else { return String(localized: "checkin.event.none") }
        if let event = (today + upcoming).first(where: { $0.id == selection }) {
            return event.title
        }
        // Ausgewählter Termin liegt außerhalb des Auswahlfensters — sauber
        // auf „Ohne Termin" zurückfallen.
        return String(localized: "checkin.event.none")
    }

    private func todayLabel(_ event: Event) -> String {
        "\(event.title) · \(CheckinLogic.time(event.startsAt))"
    }

    private func upcomingLabel(_ event: Event) -> String {
        "\(event.title) · \(CheckinLogic.dateShort(event.startsAt))"
    }
}

/// Status einer Aktion für die Inline-Rückmeldung (Ton + fertiger Text).
struct CheckinActionStatus {
    let tone: CheckinStatusLine.Tone
    let text: Text
}

// MARK: - Menü-Zeilen (Auswahl mit Häkchen)

@ViewBuilder
private func checkmarkRow(_ title: String, selected: Bool) -> some View {
    if selected {
        Label { Text(verbatim: title) } icon: { Image(systemName: "checkmark") }
    } else {
        Text(verbatim: title)
    }
}

@ViewBuilder
private func checkmarkRowKey(_ key: LocalizedStringKey, selected: Bool) -> some View {
    if selected {
        Label(key, systemImage: "checkmark")
    } else {
        Text(key)
    }
}
