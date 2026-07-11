import SwiftUI

/// ÖFFENTLICHE ROOT-VIEW des Belegungsplan-Features: Hallen/Räume des Vereins
/// als Karten mit Art-Filter, Detail-Sheet (kommende Buchungen nach Datum) und
/// „Buchen“-Sheet (→ `createBooking`, mit Überschneidungs-Hinweis). Läuft im
/// NavigationStack des „Mehr“-Tabs; `SessionStore` kommt aus dem Environment.
/// Web-Referenz-UX: apps/web/app/(portal)/belegungsplan.
struct FacilitiesView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = FacilitiesViewModel()
    @State private var detail: FacilitySelection?
    @State private var booking: BookingRequest?
    /// Vom Detail-Sheet angeforderte Vorbelegung — nach dessen Schließen zeigen
    /// wir das Buchen-Sheet (SwiftUI mag kein Sheet-über-Sheet direkt).
    @State private var pendingBookingFacilityId: String?

    var body: some View {
        Group {
            switch model.state {
            case .loading: loadingView
            case .error(let message): errorView(message)
            case .loaded: loadedView
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("belegungsplan.title"))
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            if model.state == .loaded, !model.facilities.isEmpty {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        booking = BookingRequest(facilityId: nil)
                    } label: {
                        Image(systemName: "calendar.badge.plus")
                    }
                    .tint(Theme.Colors.brand)
                    .accessibilityLabel(Text("belegungsplan.book.title"))
                }
            }
        }
        .task {
            await model.loadIfNeeded(
                api: session.api,
                clubId: session.clubId,
                memberId: session.session?.profile.memberId,
                clubRole: session.session?.profile.clubRole
            )
#if DEBUG
            applyDevHooks()
#endif
        }
        .sheet(item: $detail, onDismiss: presentPendingBookingIfNeeded) { selected in
            FacilityDetailSheet(
                facility: current(selected),
                bookings: model.bookings(for: selected.id),
                bookerName: model.bookerName,
                teamName: model.teamName,
                onBook: { requestBooking(for: selected.id) }
            )
        }
        .sheet(item: $booking) { request in
            BookingFormSheet(model: makeBookingModel(initialFacilityId: request.facilityId))
        }
        .alert("belegungsplan.error.title", isPresented: refreshErrorBinding) {
            Button("belegungsplan.error.ok", role: .cancel) {}
        } message: {
            Text(verbatim: model.refreshErrorMessage ?? "")
        }
    }

#if DEBUG
    /// NUR DEBUG/Smoke: `-devOpenBooking YES` öffnet nach dem Laden das
    /// Buchen-Sheet (für Screenshots). Ohne das Flag passiert nichts.
    private func applyDevHooks() {
        if UserDefaults.standard.bool(forKey: "devOpenBooking"), !model.facilities.isEmpty {
            booking = BookingRequest(facilityId: nil)
        }
    }
#endif

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView().tint(Theme.Colors.brand)
            Text("belegungsplan.loading")
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func errorView(_ message: String) -> some View {
        ScrollView {
            RSMCard {
                VStack(spacing: Theme.Spacing.s4) {
                    Image(systemName: "wifi.exclamationmark")
                        .font(.system(size: 40, weight: .medium))
                        .foregroundStyle(Theme.Colors.danger)
                        .accessibilityHidden(true)
                    Text("belegungsplan.error.title")
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text(verbatim: message)
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .multilineTextAlignment(.center)
                    RSMPrimaryButton(title: "belegungsplan.error.retry") {
                        _Concurrency.Task { await model.retry() }
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Theme.Spacing.s4)
            }
            .padding(Theme.Spacing.s5)
        }
    }

    private var loadedView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                Text("belegungsplan.subtitle")
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .padding(.horizontal, Theme.Spacing.s1)

                if model.facilities.isEmpty {
                    emptyState
                } else {
                    FacilitiesFilterBar(model: model)
                    if model.visibleFacilities.isEmpty {
                        filterEmptyState
                    } else {
                        ForEach(model.visibleFacilities, id: \.id) { facility in
                            FacilityCardView(
                                facility: facility,
                                upcomingCount: model.upcomingCount(for: facility.id),
                                onOpen: { detail = FacilitySelection(facility: facility) }
                            )
                        }
                    }
                }
            }
            .padding(Theme.Spacing.s5)
        }
        .refreshable { await model.refresh() }
    }

    private var emptyState: some View {
        RSMCard {
            RSMEmptyState(
                systemImage: "building.2",
                title: "belegungsplan.empty.title",
                message: "belegungsplan.empty.message"
            )
        }
    }

    private var filterEmptyState: some View {
        RSMCard {
            RSMEmptyState(
                systemImage: "magnifyingglass",
                title: "belegungsplan.filter.empty.title",
                message: "belegungsplan.filter.empty.body",
                actionTitle: "belegungsplan.filter.empty.cta",
                action: { model.filter = .all }
            )
        }
    }

    // MARK: - Buchen-Übergang (Detail → Sheet)

    private func requestBooking(for facilityId: String) {
        pendingBookingFacilityId = facilityId
        detail = nil
    }

    private func presentPendingBookingIfNeeded() {
        guard let facilityId = pendingBookingFacilityId else { return }
        pendingBookingFacilityId = nil
        booking = BookingRequest(facilityId: facilityId)
    }

    private func makeBookingModel(initialFacilityId: String?) -> BookingFormViewModel {
        BookingFormViewModel(
            initialFacilityId: initialFacilityId,
            facilities: model.facilities,
            bookings: model.bookings,
            members: model.sortedMembers,
            teams: model.bookableTeams,
            isTrainer: model.isTrainer,
            currentMemberId: model.memberId,
            clubId: session.clubId,
            api: session.api,
            onCreated: { model.insert(created: $0) }
        )
    }

    // MARK: - Helfer

    /// Fürs Detail-Sheet immer den aktuellsten Stand aus der Liste nehmen.
    private func current(_ selection: FacilitySelection) -> Facility {
        model.facilities.first { $0.id == selection.id } ?? selection.facility
    }

    private var refreshErrorBinding: Binding<Bool> {
        Binding(
            get: { model.refreshErrorMessage != nil },
            set: { if !$0 { model.refreshErrorMessage = nil } }
        )
    }
}

/// Sheet-Auswahl ohne `Identifiable`-Konformanz auf dem Contracts-Typ
/// (Konformanz-Kollisionen zwischen parallelen Feature-Teams vermeiden).
struct FacilitySelection: Identifiable {
    let facility: Facility
    var id: String { facility.id }
}

/// Auslöser für das Buchen-Sheet — `facilityId == nil` = keine Vorbelegung.
struct BookingRequest: Identifiable {
    let id = UUID()
    let facilityId: String?
}

/// Horizontaler Art-Filter (Alle · Halle · Raum · Außenbereich · Sonstiges)
/// mit Anzahl-Badge je Art. Web-Referenz: FilterChips.
private struct FacilitiesFilterBar: View {
    @ObservedObject var model: FacilitiesViewModel

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.s2) {
                chip(title: "belegungsplan.filter.all", count: model.facilities.count, filter: .all)
                ForEach(BelegungDisplay.kindOrder, id: \.self) { kind in
                    chip(
                        title: BelegungDisplay.kindLabelKey(kind),
                        count: model.count(for: kind),
                        filter: .kind(kind)
                    )
                }
            }
            .padding(.horizontal, Theme.Spacing.s1)
        }
    }

    private func chip(title: LocalizedStringKey, count: Int, filter: FacilitiesViewModel.KindFilter) -> some View {
        let selected = model.filter == filter
        return Button {
            model.filter = filter
        } label: {
            HStack(spacing: Theme.Spacing.s1) {
                Text(title)
                    .font(Theme.Fonts.caption.weight(.semibold))
                Text(verbatim: "\(count)")
                    .font(Theme.Fonts.caption.weight(.semibold))
                    .monospacedDigit()
                    .opacity(0.7)
            }
            .foregroundStyle(selected ? Theme.Colors.brandContrast : Theme.Colors.inkSoft)
            .padding(.horizontal, Theme.Spacing.s3)
            .padding(.vertical, Theme.Spacing.s2)
            .background(selected ? Theme.Colors.brand : Theme.Colors.bgSunken)
            .clipShape(Capsule())
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityAddTraits(selected ? [.isSelected] : [])
    }
}
