import SwiftUI

/// Schließfach VERWALTEN — die iOS-Fassung der Web-Dialoge (LockerFormDialog +
/// AssignLockerSheet + DeleteLockerDialog). Ein Sheet für alles, was ein
/// Vereins-Admin an einem Fach tut: Bezeichnung/Ort/Größe/Status/Gebühr/Notiz
/// ändern, einem Mitglied zuordnen oder freigeben, und löschen.
///
/// Die Gebühr wird als Euro eingegeben und intern in Cent umgerechnet
/// (`price_per_month_cents`) — dieselbe Wahrheit wie im Web (derive.ts).
struct LockerManageSheet: View {
    @ObservedObject var model: LockersViewModel
    let locker: Locker
    let clubId: String
    @Environment(\.dismiss) private var dismiss

    @State private var label: String
    @State private var location: String
    @State private var size: LockerSize
    @State private var status: LockerStatus
    @State private var feeEuro: String
    @State private var note: String
    /// Zugeordnetes Mitglied ("" = frei).
    @State private var assignedMemberId: String
    @State private var saving = false
    @State private var errorMessage: String?
    @State private var showDeleteConfirm = false
    @State private var showRentSheet = false
    @State private var showEndSheet = false

    init(model: LockersViewModel, locker: Locker, clubId: String) {
        self.model = model
        self.locker = locker
        self.clubId = clubId
        _label = State(initialValue: locker.label)
        _location = State(initialValue: locker.location ?? "")
        _size = State(initialValue: locker.size)
        _status = State(initialValue: locker.status)
        _feeEuro = State(initialValue: LockerMoney.euroString(fromCents: locker.pricePerMonthCents))
        _note = State(initialValue: locker.note ?? "")
        _assignedMemberId = State(initialValue: locker.assignedMemberId ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(text: $label) { Text(verbatim: "Bezeichnung (z. B. A-12)") }
                    TextField(text: $location) { Text(verbatim: "Ort (optional)") }
                    Picker(selection: $size) { ForEach(LockerSize.allCases, id: \.self) { Text(verbatim: LockerManageSheet.sizeLabel($0)).tag($0) } } label: { Text(verbatim: "Größe") }
                } header: { Text(verbatim: "Schließfach") }

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
                } header: { Text(verbatim: "Gebühr") } footer: {
                    Text(verbatim: "Leer = keine Angabe · 0 = kostenlos")
                }

                Section {
                    Picker(selection: $assignedMemberId) {
                        Text(verbatim: "— frei —").tag("")
                        ForEach(model.sortedMembers, id: \.id) { m in
                            Text(verbatim: m.membersFullName).tag(m.id)
                        }
                    } label: { Text(verbatim: "Mitglied") }
                } header: { Text(verbatim: "Zuordnung") } footer: {
                    Text(verbatim: "Ein zugeordnetes Fach gilt als belegt.")
                }

                Section {
                    TextField(text: $note, axis: .vertical) { Text(verbatim: "Notiz (optional)") }
                        .lineLimit(1...4)
                }

                rentalSection

                if let errorMessage {
                    Section { Text(verbatim: errorMessage).foregroundStyle(Theme.Colors.danger) }
                }

                Section {
                    Button(role: .destructive) { showDeleteConfirm = true } label: {
                        Text(verbatim: "Schließfach löschen")
                    }.disabled(saving)
                }
            }
            .navigationTitle(Text(verbatim: locker.label))
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
                    .disabled(label.trimmingCharacters(in: .whitespaces).isEmpty || saving)
                }
            }
            .confirmationDialog(
                Text(verbatim: "Schließfach „\(locker.label)“ wirklich löschen?"),
                isPresented: $showDeleteConfirm, titleVisibility: .visible
            ) {
                Button(role: .destructive) { performDelete() } label: { Text(verbatim: "Löschen") }
                Button(role: .cancel) {} label: { Text(verbatim: "Abbrechen") }
            }
            .sheet(isPresented: $showRentSheet) {
                LockerRentSheet(
                    model: model, clubId: clubId, locker: locker,
                    existing: model.activeRental(for: locker.id)
                )
            }
            .sheet(isPresented: $showEndSheet) {
                if let rental = model.activeRental(for: locker.id) {
                    LockerEndRentalSheet(model: model, locker: locker, rental: rental)
                }
            }
        }
    }

    // MARK: - Vermietung

    /// Miet-Ebene über der Zuordnung: laufender Vertrag anzeigen, vermieten,
    /// bearbeiten oder beenden. Web-Referenz: RentLockerSheet + EndRentalDialog.
    @ViewBuilder
    private var rentalSection: some View {
        Section {
            if let rental = model.activeRental(for: locker.id) {
                HStack {
                    Text(verbatim: "Mieter")
                    Spacer(minLength: Theme.Spacing.s4)
                    Text(verbatim: model.memberName(forId: rental.memberId) ?? "Unbekanntes Mitglied")
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
                HStack {
                    Text(verbatim: "Monatlich")
                    Spacer(minLength: Theme.Spacing.s4)
                    Text(verbatim: LockerRentalFormat.priceLabel(rental.pricePerMonthCents))
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
                Button { showRentSheet = true } label: { Text(verbatim: "Miete bearbeiten") }
                    .disabled(saving)
                Button(role: .destructive) { showEndSheet = true } label: {
                    Text(verbatim: "Miete beenden")
                }.disabled(saving)
            } else {
                Button { showRentSheet = true } label: { Text(verbatim: "Vermieten") }
                    .disabled(saving)
            }
        } header: { Text(verbatim: "Vermietung") } footer: {
            Text(verbatim: "Vermieten regelt die Gebühr, nicht den Schlüssel — das Zuordnen bleibt getrennt.")
        }
    }

    // MARK: - Aktionen

    private func save() {
        let trimmedLabel = label.trimmingCharacters(in: .whitespaces)
        guard !trimmedLabel.isEmpty, !saving else { return }
        guard let cents = LockerMoney.centsOrError(feeEuro) else {
            errorMessage = "Gebühr bitte als Betrag (z. B. 5,00) oder leer lassen."
            return
        }
        saving = true; errorMessage = nil
        let loc = location.trimmingCharacters(in: .whitespaces)
        let noteTrimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        let targetMember = assignedMemberId
        _Concurrency.Task {
            do {
                // 1) Stammdaten ändern (Zuordnung getrennt, sie setzt Status server-seitig).
                try await model.update(lockerId: locker.id, LockerUpdate(
                    label: trimmedLabel,
                    location: loc.isEmpty ? nil : loc,
                    size: size,
                    pricePerMonthCents: cents,
                    note: noteTrimmed.isEmpty ? nil : noteTrimmed
                ))
                // 2) Zuordnung abgleichen.
                if targetMember != (locker.assignedMemberId ?? "") {
                    if targetMember.isEmpty {
                        try await model.release(lockerId: locker.id)
                    } else {
                        try await model.assign(lockerId: locker.id, memberId: targetMember)
                    }
                }
                dismiss()
            } catch {
                errorMessage = LockersViewModel.friendlyMessage(error)
            }
            saving = false
        }
    }

    private func performDelete() {
        saving = true; errorMessage = nil
        _Concurrency.Task {
            do {
                try await model.delete(lockerId: locker.id)
                dismiss()
            } catch {
                errorMessage = LockersViewModel.friendlyMessage(error)
            }
            saving = false
        }
    }

    static func sizeLabel(_ s: LockerSize) -> String {
        switch s {
        case .klein: "Klein"
        case .mittel: "Mittel"
        case .gross: "Groß"
        }
    }
}

/// Euro↔Cent-Umrechnung für die Gebühr — akzeptiert Komma und Punkt, leer =
/// „keine Angabe“ (nil). Gemeinsame Quelle für Anlegen und Verwalten.
enum LockerMoney {
    /// Cent → Euro-String fürs Eingabefeld ("" wenn nil).
    static func euroString(fromCents cents: Int?) -> String {
        guard let cents else { return "" }
        if cents % 100 == 0 { return String(cents / 100) }
        return String(format: "%.2f", Double(cents) / 100).replacingOccurrences(of: ".", with: ",")
    }

    /// Eingabe → Cent. `.some(nil)` bei leer (keine Angabe), `.some(x)` bei
    /// gültigem Betrag, `nil` bei Fehleingabe.
    static func centsOrError(_ raw: String) -> Int?? {
        let t = raw.trimmingCharacters(in: .whitespaces)
        if t.isEmpty { return Optional.some(nil) }
        let normalized = t.replacingOccurrences(of: ",", with: ".")
        // Obergrenze deckelt Fat-Finger/Paste ab: ohne sie würde Int(value*100)
        // bei sehr großen Zahlen deterministisch abstürzen (Double→Int-Trap).
        guard let value = Double(normalized), value.isFinite, value >= 0, value <= 1_000_000 else { return nil }
        return Optional.some(Int((value * 100).rounded()))
    }
}
