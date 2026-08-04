import SwiftUI

/// Schließfach VERMIETEN oder eine Vermietung BEARBEITEN — die iOS-Fassung des
/// Web-Dialogs RentLockerSheet.tsx. „Zuordnen“ ist die Schlüssel-Frage,
/// „Vermieten“ die Geld-Frage: hier wird der VEREINBARTE Preis erfasst (der vom
/// Listenpreis des Fachs abweichen darf). Mitglied und Fach sind serverseitig
/// unveränderlich — im Bearbeiten-Modus steht das Mitglied deshalb als Text da.
///
/// Der Preis hat DREI Zustände: leer = „nicht festgelegt“, 0 = „kostenlos“,
/// > 0 = Betrag. Die Euro↔Cent-Umrechnung teilt sich `LockerMoney`
/// (LockerManageSheet.swift) mit den anderen Fach-Formularen.
struct LockerRentSheet: View {
    @ObservedObject var model: LockersViewModel
    let clubId: String
    let locker: Locker
    /// `nil` = neuer Vertrag (vermieten), sonst bestehenden bearbeiten.
    let existing: LockerRental?
    @Environment(\.dismiss) private var dismiss

    @State private var memberId: String
    @State private var feeEuro: String
    @State private var startDate: Date
    @State private var hasEnd: Bool
    @State private var endDate: Date
    @State private var note: String
    @State private var saving = false
    @State private var errorMessage: String?

    private var isEdit: Bool { existing != nil }

    init(model: LockersViewModel, clubId: String, locker: Locker, existing: LockerRental?) {
        self.model = model
        self.clubId = clubId
        self.locker = locker
        self.existing = existing
        // Vorbelegung: Vertrag schlägt Fach (sonst überschriebe Öffnen-und-
        // Speichern still die Vereinbarung mit dem aktuellen Listenpreis).
        _memberId = State(initialValue: existing?.memberId ?? locker.assignedMemberId ?? "")
        let cents = existing != nil ? existing?.pricePerMonthCents : locker.pricePerMonthCents
        _feeEuro = State(initialValue: LockerMoney.euroString(fromCents: cents))
        _startDate = State(initialValue: LockerRentalDate.date(existing?.startOn) ?? Date())
        _hasEnd = State(initialValue: (existing?.endOn?.isEmpty == false))
        _endDate = State(initialValue: LockerRentalDate.date(existing?.endOn) ?? Date())
        _note = State(initialValue: existing?.note ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if isEdit {
                        // Mitglied ist serverseitig unveränderlich — anderes
                        // Mitglied hieße: alten Vertrag beenden, neuen anlegen.
                        HStack {
                            Text(verbatim: "Mitglied")
                            Spacer(minLength: Theme.Spacing.s4)
                            Text(verbatim: model.memberName(forId: memberId) ?? "Unbekanntes Mitglied")
                                .foregroundStyle(Theme.Colors.inkSoft)
                        }
                    } else {
                        Picker(selection: $memberId) {
                            Text(verbatim: "— bitte wählen —").tag("")
                            ForEach(model.sortedMembers, id: \.id) { m in
                                Text(verbatim: m.membersFullName).tag(m.id)
                            }
                        } label: { Text(verbatim: "Mitglied") }
                    }
                } header: { Text(verbatim: "Mieter") } footer: {
                    Text(verbatim: "Ein Fach kann nur einen laufenden Mietvertrag haben.")
                }

                Section {
                    HStack {
                        Text(verbatim: "Monatlich")
                        Spacer(minLength: Theme.Spacing.s4)
                        TextField(text: $feeEuro) { Text(verbatim: "z. B. 5,00") }
                            .multilineTextAlignment(.trailing)
#if os(iOS)
                            .keyboardType(.decimalPad)
#endif
                        Text(verbatim: "€")
                    }
                } header: { Text(verbatim: "Vereinbarte Gebühr") } footer: {
                    Text(verbatim: "Leer = nicht festgelegt · 0 = kostenlos. Der Listenpreis bleibt unberührt.")
                }

                Section {
                    DatePicker(selection: $startDate, displayedComponents: .date) {
                        Text(verbatim: "Beginn")
                    }
                    Toggle(isOn: $hasEnd) { Text(verbatim: "Enddatum festlegen") }
                    if hasEnd {
                        DatePicker(selection: $endDate, in: startDate..., displayedComponents: .date) {
                            Text(verbatim: "Ende")
                        }
                    }
                } header: { Text(verbatim: "Zeitraum") }

                Section {
                    TextField(text: $note, axis: .vertical) { Text(verbatim: "Notiz (optional)") }
                        .lineLimit(1...4)
                }

                if let errorMessage {
                    Section { Text(verbatim: errorMessage).foregroundStyle(Theme.Colors.danger) }
                }
            }
            .navigationTitle(Text(verbatim: isEdit ? "Miete bearbeiten" : "Vermieten"))
#if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: { Text(verbatim: "Abbrechen") }.disabled(saving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button { save() } label: {
                        saving ? AnyView(ProgressView()) : AnyView(Text(verbatim: "Sichern"))
                    }
                    .disabled(memberId.isEmpty || saving)
                }
            }
        }
    }

    private func save() {
        guard !memberId.isEmpty, !saving else { return }
        guard let cents = LockerMoney.centsOrError(feeEuro) else {
            errorMessage = "Gebühr bitte als Betrag (z. B. 5,00) oder leer lassen."
            return
        }
        saving = true; errorMessage = nil
        let start = LockerRentalDate.string(startDate)
        let end = hasEnd ? LockerRentalDate.string(endDate) : nil
        let noteTrimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanNote = noteTrimmed.isEmpty ? nil : noteTrimmed
        _Concurrency.Task {
            do {
                if let existing {
                    try await model.updateRental(rentalId: existing.id, LockerRentalUpdate(
                        pricePerMonthCents: cents,
                        startOn: start,
                        endOn: end,
                        note: cleanNote
                    ))
                } else {
                    try await model.createRental(LockerRentalCreate(
                        clubId: clubId,
                        lockerId: locker.id,
                        memberId: memberId,
                        pricePerMonthCents: cents,
                        startOn: start,
                        endOn: end,
                        status: .aktiv,
                        note: cleanNote
                    ))
                }
                dismiss()
            } catch {
                errorMessage = LockersViewModel.friendlyMessage(error)
            }
            saving = false
        }
    }
}

/// Eine laufende Vermietung BEENDEN — die iOS-Fassung von EndRentalDialog.tsx.
/// Ein Vertrag, den es wirklich gab, verschwindet nicht: er bekommt ein Ende
/// (Status „beendet“ oder „gekündigt“ + Enddatum). Das FACH bleibt dabei
/// zugeordnet — „Freigeben“ ist eine Schlüssel-Frage und passiert getrennt.
struct LockerEndRentalSheet: View {
    @ObservedObject var model: LockersViewModel
    let locker: Locker
    let rental: LockerRental
    @Environment(\.dismiss) private var dismiss

    @State private var how: LockerRentalStatus = .beendet
    @State private var endDate: Date = Date()
    @State private var saving = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(verbatim: "Die Vermietung wird beendet und bleibt im Verlauf nachvollziehbar.")
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                }

                Section {
                    Text(verbatim: "Das Fach bleibt dem Mitglied zugeordnet, bis es getrennt freigegeben wird.")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                }

                Section {
                    Picker(selection: $how) {
                        Text(verbatim: "Beendet").tag(LockerRentalStatus.beendet)
                        Text(verbatim: "Gekündigt").tag(LockerRentalStatus.gekuendigt)
                    } label: { Text(verbatim: "Art") }
                    DatePicker(selection: $endDate, displayedComponents: .date) {
                        Text(verbatim: "Enddatum")
                    }
                } header: { Text(verbatim: "Beenden") }

                if let errorMessage {
                    Section { Text(verbatim: errorMessage).foregroundStyle(Theme.Colors.danger) }
                }
            }
            .navigationTitle(Text(verbatim: "Miete beenden"))
#if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: { Text(verbatim: "Abbrechen") }.disabled(saving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(role: .destructive) { confirm() } label: {
                        saving ? AnyView(ProgressView()) : AnyView(Text(verbatim: "Beenden"))
                    }
                    .disabled(saving)
                }
            }
        }
    }

    private func confirm() {
        guard !saving else { return }
        saving = true; errorMessage = nil
        let end = LockerRentalDate.string(endDate)
        let status = how
        _Concurrency.Task {
            do {
                try await model.endRental(rentalId: rental.id, status: status, endOn: end)
                dismiss()
            } catch {
                errorMessage = LockersViewModel.friendlyMessage(error)
            }
            saving = false
        }
    }
}

/// ISO-Datum (YYYY-MM-DD) ↔ `Date` für die Miet-Formulare. Die API nimmt/gibt
/// Daten als String; hier wird lokal, ohne Zeitzonen-Verschiebung, gerechnet.
enum LockerRentalDate {
    static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .iso8601)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        return f
    }()

    static func string(_ date: Date) -> String { formatter.string(from: date) }

    static func date(_ iso: String?) -> Date? {
        guard let iso, !iso.isEmpty else { return nil }
        return formatter.date(from: iso)
    }
}

/// Preis-Text für die Miet-Anzeige — die drei Zustände als WORT statt „0,00 €“
/// oder „—“. Web-Referenz: derive.ts priceLabel.
enum LockerRentalFormat {
    static func priceLabel(_ cents: Int?) -> String {
        guard let cents else { return "Kein Preis festgelegt" }
        if cents == 0 { return "Kostenlos" }
        return "\(LockerMoney.euroString(fromCents: cents)) €"
    }
}
