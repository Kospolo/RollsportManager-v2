import SwiftUI

// Schlichte Anlegen-Sheets für Module, die auf iOS bisher kein Anlegen hatten.
// Ein neuer Verein kann so überall den ersten Eintrag erzeugen. Muster wie
// AdminMemberCreateSheet: Pflichtfelder minimal, Rest danach im Bearbeiten.

private func createErrorText(_ error: Error) -> String {
    (error as? APIError)?.errorDescription ?? error.localizedDescription
}

// MARK: - Kür anlegen

struct RoutineCreateSheet: View {
    let api: APIClient
    let clubId: String
    let onCreated: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var category = ""
    @State private var saving = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(text: $title) { Text(verbatim: "Titel") }
                    TextField(text: $category) { Text(verbatim: "Kategorie (optional)") }
                } footer: {
                    Text(verbatim: "Musik, Läufer:innen und Marker fügst du danach in der Kür hinzu.")
                }
                if let errorMessage { Section { Text(verbatim: errorMessage).foregroundStyle(Theme.Colors.danger) } }
            }
            .navigationTitle(Text(verbatim: "Neue Kür"))
#if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button { dismiss() } label: { Text(verbatim: "Abbrechen") }.disabled(saving) }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        guard !title.trimmingCharacters(in: .whitespaces).isEmpty, !saving else { return }
                        saving = true; errorMessage = nil
                        let c = category.trimmingCharacters(in: .whitespaces)
                        _Concurrency.Task {
                            do {
                                _ = try await api.createRoutine(RoutineCreate(clubId: clubId, title: title.trimmingCharacters(in: .whitespaces), category: c.isEmpty ? nil : c))
                                onCreated(); dismiss()
                            } catch { errorMessage = createErrorText(error) }
                            saving = false
                        }
                    } label: { saving ? AnyView(ProgressView()) : AnyView(Text(verbatim: "Anlegen")) }
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || saving)
                }
            }
        }
    }
}

// MARK: - Wettkampf anlegen

struct CompetitionCreateSheet: View {
    let api: APIClient
    let clubId: String
    let onCreated: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var location = ""
    @State private var starts = Date()
    @State private var ends = Date().addingTimeInterval(3 * 3600)
    @State private var saving = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section { TextField(text: $name) { Text(verbatim: "Name") } } header: { Text(verbatim: "Wettkampf") }
                Section {
                    DatePicker(selection: $starts) { Text(verbatim: "Beginn") }
                    DatePicker(selection: $ends, in: starts...) { Text(verbatim: "Ende") }
                    TextField(text: $location) { Text(verbatim: "Ort (optional)") }
                }
                if let errorMessage { Section { Text(verbatim: errorMessage).foregroundStyle(Theme.Colors.danger) } }
            }
            .navigationTitle(Text(verbatim: "Neuer Wettkampf"))
#if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button { dismiss() } label: { Text(verbatim: "Abbrechen") }.disabled(saving) }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        guard !name.trimmingCharacters(in: .whitespaces).isEmpty, !saving else { return }
                        saving = true; errorMessage = nil
                        let loc = location.trimmingCharacters(in: .whitespaces)
                        _Concurrency.Task {
                            do {
                                _ = try await api.createCompetition(CompetitionCreate(
                                    clubId: clubId, name: name.trimmingCharacters(in: .whitespaces),
                                    location: loc.isEmpty ? nil : loc,
                                    startsAt: QuickCreateFormat.iso(starts), endsAt: QuickCreateFormat.iso(ends)))
                                onCreated(); dismiss()
                            } catch { errorMessage = createErrorText(error) }
                            saving = false
                        }
                    } label: { saving ? AnyView(ProgressView()) : AnyView(Text(verbatim: "Anlegen")) }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || saving)
                }
            }
        }
    }
}

// MARK: - Ausrüstung anlegen

struct EquipmentCreateSheet: View {
    let api: APIClient
    let clubId: String
    let onCreated: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var quantity = 1
    @State private var saving = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section { TextField(text: $name) { Text(verbatim: "Bezeichnung") } } header: { Text(verbatim: "Ausrüstung") }
                Section { Stepper(value: $quantity, in: 1...999) { Text(verbatim: "Anzahl: \(quantity)") } }
                if let errorMessage { Section { Text(verbatim: errorMessage).foregroundStyle(Theme.Colors.danger) } }
            }
            .navigationTitle(Text(verbatim: "Neue Ausrüstung"))
#if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button { dismiss() } label: { Text(verbatim: "Abbrechen") }.disabled(saving) }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        guard !name.trimmingCharacters(in: .whitespaces).isEmpty, !saving else { return }
                        saving = true; errorMessage = nil
                        _Concurrency.Task {
                            do {
                                _ = try await api.createEquipment(EquipmentCreate(
                                    clubId: clubId, name: name.trimmingCharacters(in: .whitespaces),
                                    totalQuantity: quantity, availableQuantity: quantity))
                                onCreated(); dismiss()
                            } catch { errorMessage = createErrorText(error) }
                            saving = false
                        }
                    } label: { saving ? AnyView(ProgressView()) : AnyView(Text(verbatim: "Anlegen")) }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || saving)
                }
            }
        }
    }
}

// MARK: - Schließfach anlegen

struct LockerCreateSheet: View {
    let api: APIClient
    let clubId: String
    let onCreated: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var label = ""
    @State private var location = ""
    @State private var size: LockerSize = .mittel
    @State private var feeEuro = ""
    @State private var saving = false
    @State private var errorMessage: String?

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
                } header: { Text(verbatim: "Gebühr") } footer: { Text(verbatim: "Leer = keine Angabe · 0 = kostenlos") }
                if let errorMessage { Section { Text(verbatim: errorMessage).foregroundStyle(Theme.Colors.danger) } }
            }
            .navigationTitle(Text(verbatim: "Neues Schließfach"))
#if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button { dismiss() } label: { Text(verbatim: "Abbrechen") }.disabled(saving) }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        guard !label.trimmingCharacters(in: .whitespaces).isEmpty, !saving else { return }
                        guard let cents = LockerMoney.centsOrError(feeEuro) else {
                            errorMessage = "Gebühr bitte als Betrag (z. B. 5,00) oder leer lassen."; return
                        }
                        saving = true; errorMessage = nil
                        let loc = location.trimmingCharacters(in: .whitespaces)
                        _Concurrency.Task {
                            do {
                                _ = try await api.createLocker(LockerCreate(
                                    clubId: clubId, label: label.trimmingCharacters(in: .whitespaces),
                                    location: loc.isEmpty ? nil : loc,
                                    size: size,
                                    pricePerMonthCents: cents))
                                onCreated(); dismiss()
                            } catch { errorMessage = createErrorText(error) }
                            saving = false
                        }
                    } label: { saving ? AnyView(ProgressView()) : AnyView(Text(verbatim: "Anlegen")) }
                    .disabled(label.trimmingCharacters(in: .whitespaces).isEmpty || saving)
                }
            }
        }
    }
}

// MARK: - Übung anlegen

struct ExerciseCreateSheet: View {
    let api: APIClient
    let clubId: String
    let onCreated: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var category: ExerciseCategory = .warmup
    @State private var difficulty = 2
    @State private var saving = false
    @State private var errorMessage: String?

    private func label(_ c: ExerciseCategory) -> String {
        switch c {
        case .warmup: "Aufwärmen"; case .stretching: "Dehnen"; case .strength: "Kraft"
        case .jump: "Sprung"; case .spin: "Pirouette"; case .steps: "Schritte"; case .combination: "Kombination"
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section { TextField(text: $name) { Text(verbatim: "Name") } } header: { Text(verbatim: "Übung") }
                Section {
                    Picker(selection: $category) { ForEach(ExerciseCategory.allCases, id: \.self) { Text(verbatim: label($0)).tag($0) } } label: { Text(verbatim: "Kategorie") }
                    Stepper(value: $difficulty, in: 1...5) { Text(verbatim: "Schwierigkeit: \(difficulty)/5") }
                }
                if let errorMessage { Section { Text(verbatim: errorMessage).foregroundStyle(Theme.Colors.danger) } }
            }
            .navigationTitle(Text(verbatim: "Neue Übung"))
#if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button { dismiss() } label: { Text(verbatim: "Abbrechen") }.disabled(saving) }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        guard !name.trimmingCharacters(in: .whitespaces).isEmpty, !saving else { return }
                        saving = true; errorMessage = nil
                        _Concurrency.Task {
                            do {
                                _ = try await api.createExercise(ExerciseCreate(clubId: clubId, name: name.trimmingCharacters(in: .whitespaces), category: category, difficulty: difficulty))
                                onCreated(); dismiss()
                            } catch { errorMessage = createErrorText(error) }
                            saving = false
                        }
                    } label: { saving ? AnyView(ProgressView()) : AnyView(Text(verbatim: "Anlegen")) }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || saving)
                }
            }
        }
    }
}

// MARK: - Trainingszeit anlegen

struct TrainingSlotCreateSheet: View {
    let api: APIClient
    let clubId: String
    let onCreated: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var weekday = 0                 // 0 = Montag … 6 = Sonntag
    @State private var start = Calendar.current.date(from: DateComponents(hour: 17, minute: 0)) ?? Date()
    @State private var end = Calendar.current.date(from: DateComponents(hour: 18, minute: 30)) ?? Date()
    @State private var location = ""
    @State private var saving = false
    @State private var errorMessage: String?

    private let days = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker(selection: $weekday) { ForEach(0..<7, id: \.self) { Text(verbatim: days[$0]).tag($0) } } label: { Text(verbatim: "Wochentag") }
                    DatePicker(selection: $start, displayedComponents: .hourAndMinute) { Text(verbatim: "Beginn") }
                    DatePicker(selection: $end, displayedComponents: .hourAndMinute) { Text(verbatim: "Ende") }
                    TextField(text: $location) { Text(verbatim: "Ort (optional)") }
                } header: { Text(verbatim: "Trainingszeit") }
                if let errorMessage { Section { Text(verbatim: errorMessage).foregroundStyle(Theme.Colors.danger) } }
            }
            .navigationTitle(Text(verbatim: "Neue Trainingszeit"))
#if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button { dismiss() } label: { Text(verbatim: "Abbrechen") }.disabled(saving) }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        guard !saving else { return }
                        saving = true; errorMessage = nil
                        let loc = location.trimmingCharacters(in: .whitespaces)
                        _Concurrency.Task {
                            do {
                                _ = try await api.createTrainingSlot(TrainingSlotCreate(
                                    clubId: clubId, weekday: weekday,
                                    startsTime: QuickCreateFormat.time(start), endsTime: QuickCreateFormat.time(end),
                                    location: loc.isEmpty ? nil : loc))
                                onCreated(); dismiss()
                            } catch { errorMessage = createErrorText(error) }
                            saving = false
                        }
                    } label: { saving ? AnyView(ProgressView()) : AnyView(Text(verbatim: "Anlegen")) }
                    .disabled(saving)
                }
            }
        }
    }
}

// MARK: - Überregionaler Termin anlegen

struct RegionalEventCreateSheet: View {
    let api: APIClient
    let clubId: String
    let onCreated: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var startsOn = Date()
    @State private var location = ""
    @State private var saving = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(text: $title) { Text(verbatim: "Titel") }
                    DatePicker(selection: $startsOn, displayedComponents: .date) { Text(verbatim: "Datum") }
                    TextField(text: $location) { Text(verbatim: "Ort (optional)") }
                } header: { Text(verbatim: "Überregionaler Termin") }
                if let errorMessage { Section { Text(verbatim: errorMessage).foregroundStyle(Theme.Colors.danger) } }
            }
            .navigationTitle(Text(verbatim: "Neuer überregionaler Termin"))
#if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button { dismiss() } label: { Text(verbatim: "Abbrechen") }.disabled(saving) }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        guard !title.trimmingCharacters(in: .whitespaces).isEmpty, !saving else { return }
                        saving = true; errorMessage = nil
                        let loc = location.trimmingCharacters(in: .whitespaces)
                        _Concurrency.Task {
                            do {
                                _ = try await api.createRegionalEvent(RegionalEventCreate(
                                    clubId: clubId, title: title.trimmingCharacters(in: .whitespaces),
                                    startsOn: QuickCreateFormat.date(startsOn),
                                    location: loc.isEmpty ? nil : loc))
                                onCreated(); dismiss()
                            } catch { errorMessage = createErrorText(error) }
                            saving = false
                        }
                    } label: { saving ? AnyView(ProgressView()) : AnyView(Text(verbatim: "Anlegen")) }
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || saving)
                }
            }
        }
    }
}

// MARK: - Halle/Anlage anlegen

struct FacilityCreateSheet: View {
    let api: APIClient
    let clubId: String
    let onCreated: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var address = ""
    @State private var saving = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(text: $name) { Text(verbatim: "Name (z. B. Sporthalle Nord)") }
                    TextField(text: $address) { Text(verbatim: "Adresse (optional)") }
                } header: { Text(verbatim: "Halle / Anlage") }
                if let errorMessage { Section { Text(verbatim: errorMessage).foregroundStyle(Theme.Colors.danger) } }
            }
            .navigationTitle(Text(verbatim: "Neue Anlage"))
#if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button { dismiss() } label: { Text(verbatim: "Abbrechen") }.disabled(saving) }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        guard !name.trimmingCharacters(in: .whitespaces).isEmpty, !saving else { return }
                        saving = true; errorMessage = nil
                        let adr = address.trimmingCharacters(in: .whitespaces)
                        _Concurrency.Task {
                            do {
                                _ = try await api.createFacility(FacilityCreate(
                                    clubId: clubId, name: name.trimmingCharacters(in: .whitespaces),
                                    address: adr.isEmpty ? nil : adr))
                                onCreated(); dismiss()
                            } catch { errorMessage = createErrorText(error) }
                            saving = false
                        }
                    } label: { saving ? AnyView(ProgressView()) : AnyView(Text(verbatim: "Anlegen")) }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || saving)
                }
            }
        }
    }
}

enum QuickCreateFormat {
    static func iso(_ date: Date) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f.string(from: date)
    }
    static func date(_ date: Date) -> String {
        // LOKALER Kalender: der DatePicker zeigt/waehlt den Tag lokal — die
        // Serialisierung MUSS denselben Kalendertag ziehen, sonst rutscht das
        // Datum in DE (UTC+1/+2) einen Tag zurueck (Geburtsjahr/Termin falsch).
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 2000, c.month ?? 1, c.day ?? 1)
    }
    static func time(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
    }
}

