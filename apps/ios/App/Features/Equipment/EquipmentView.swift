import SwiftUI

/// ÖFFENTLICHE ROOT-VIEW des Ausrüstung-Features: Inventar des Vereins als
/// Karten (Name · Kategorie · Zustand · verfügbar/gesamt), Selbst-Service-
/// Reservierung über ein Sheet und der Abschnitt „Meine Reservierungen“. Läuft
/// im NavigationStack des „Mehr“-Tabs; `SessionStore` kommt aus dem Environment.
/// Web-Referenz-UX: apps/web/app/(portal)/ausruestung.
struct EquipmentView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = EquipmentViewModel()
    @State private var reserveTarget: EquipmentSelection?

    var body: some View {
        Group {
            switch model.state {
            case .loading:
                loadingView
            case .error(let message):
                errorView(message)
            case .loaded:
                listView
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("ausruestung.title"))
        .navigationBarTitleDisplayMode(.large)
        .task {
            await model.loadIfNeeded(
                api: session.api,
                clubId: session.clubId,
                memberId: session.session?.profile.memberId ?? "",
                memberName: session.session?.profile.displayName ?? "",
                clubRole: session.session?.profile.clubRole
            )
#if DEBUG
            applyEquipmentDevHooks()
#endif
        }
        .sheet(item: $reserveTarget) { selection in
            EquipmentReserveSheet(
                api: session.api,
                clubId: session.clubId,
                equipment: selection.equipment,
                currentMemberId: model.currentMemberId,
                currentMemberName: model.currentMemberName,
                canSelectMember: model.canSelectMember,
                selectableMembers: model.selectableMembers,
                onReserved: { _ in
                    _Concurrency.Task { await model.refresh() }
                }
            )
        }
        .alert("ausruestung.error.refresh.title", isPresented: refreshErrorBinding) {
            Button("ausruestung.error.ok", role: .cancel) {}
        } message: {
            Text(verbatim: model.refreshErrorMessage ?? "")
        }
    }

#if DEBUG
    /// NUR DEBUG/Smoke: `-devOpenReserveEquipment YES` öffnet nach dem Laden das
    /// Reservieren-Sheet des ersten verfügbaren Gegenstands (für Screenshots).
    private func applyEquipmentDevHooks() {
        guard UserDefaults.standard.bool(forKey: "devOpenReserveEquipment") else { return }
        if let first = model.equipment.first(where: { EquipmentDisplay.availableCap($0) != 0 }) {
            reserveTarget = EquipmentSelection(equipment: first)
        }
    }
#endif

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView().tint(Theme.Colors.brand)
            Text("ausruestung.loading")
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
                    Text("ausruestung.error.title")
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text(verbatim: message)
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .multilineTextAlignment(.center)
                    RSMPrimaryButton(title: "ausruestung.error.retry") {
                        _Concurrency.Task { await model.retry() }
                    }
                    .fixedSize()
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Theme.Spacing.s4)
            }
            .padding(Theme.Spacing.s5)
        }
    }

    // MARK: - Liste

    private var listView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                if model.equipment.isEmpty {
                    RSMCard {
                        RSMEmptyState(
                            systemImage: "shippingbox",
                            title: "ausruestung.empty.title",
                            message: "ausruestung.empty.message"
                        )
                    }
                } else {
                    if model.showFilter {
                        filterChips
                    }
                    inventorySection
                    myReservationsSection
                }
            }
            .padding(Theme.Spacing.s5)
        }
        .refreshable { await model.refresh() }
    }

    @ViewBuilder
    private var inventorySection: some View {
        let items = model.visibleEquipment
        if items.isEmpty {
            RSMCard {
                RSMEmptyState(
                    systemImage: "line.3.horizontal.decrease.circle",
                    title: "ausruestung.filter.empty.title",
                    message: "ausruestung.filter.empty.message",
                    actionTitle: "ausruestung.filter.empty.cta",
                    action: { model.filter = .all }
                )
            }
        } else {
            ForEach(items, id: \.id) { item in
                RSMCard {
                    EquipmentCardView(equipment: item) {
                        reserveTarget = EquipmentSelection(equipment: item)
                    }
                }
            }
        }
    }

    private var myReservationsSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            RSMSectionHeader(
                eyebrow: "ausruestung.myres.subtitle",
                title: "ausruestung.myres.title"
            )
            .padding(.top, Theme.Spacing.s2)

            let mine = model.myReservations
            if mine.isEmpty {
                RSMCard {
                    RSMEmptyState(
                        systemImage: "bookmark",
                        title: "ausruestung.myres.empty.title",
                        message: "ausruestung.myres.empty.message"
                    )
                }
            } else {
                ForEach(mine, id: \.id) { reservation in
                    RSMCard {
                        MyReservationRow(
                            reservation: reservation,
                            equipmentName: model.equipmentName(for: reservation.equipmentId)
                        )
                    }
                }
            }
        }
    }

    // MARK: - Kategorie-Chips

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.s2) {
                chip(.all, label: Text("ausruestung.filter.all"))
                ForEach(model.categories, id: \.self) { category in
                    chip(.category(category), label: Text(verbatim: category))
                }
                if model.hasUncategorized {
                    chip(.uncategorized, label: Text("ausruestung.filter.uncategorized"))
                }
            }
            .padding(.horizontal, Theme.Spacing.s1)
        }
    }

    private func chip(_ value: EquipmentCategoryFilter, label: Text) -> some View {
        let selected = model.filter == value
        return Button {
            model.filter = value
        } label: {
            HStack(spacing: Theme.Spacing.s1) {
                label
                Text(verbatim: "\(model.count(for: value))")
                    .monospacedDigit()
                    .foregroundStyle(selected ? Theme.Colors.brandContrast.opacity(0.8) : Theme.Colors.inkFaint)
            }
            .font(Theme.Fonts.caption.weight(.semibold))
            .foregroundStyle(selected ? Theme.Colors.brandContrast : Theme.Colors.inkSoft)
            .padding(.horizontal, Theme.Spacing.s3)
            .padding(.vertical, Theme.Spacing.s2)
            .background(selected ? Theme.Colors.brand : Theme.Colors.bgSunken)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    private var refreshErrorBinding: Binding<Bool> {
        Binding(
            get: { model.refreshErrorMessage != nil },
            set: { if !$0 { model.refreshErrorMessage = nil } }
        )
    }
}

/// Zeile in „Meine Reservierungen“: Gegenstand · Status-Chip · Menge · Zeitraum.
/// Read-only — die Web-Aktionen Zurückgeben/Stornieren brauchen einen
/// Update-Endpunkt (`PATCH /equipment-reservations/{id}`), der in
/// `Endpoints.swift` (Shared, read-only) noch fehlt. Siehe offene Punkte.
private struct MyReservationRow: View {
    let reservation: EquipmentReservation
    let equipmentName: String

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            HStack(spacing: Theme.Spacing.s2) {
                Text(verbatim: equipmentName)
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                Spacer(minLength: 0)
                RSMStatusPill(
                    text: EquipmentDisplay.statusLabel(reservation.status),
                    kind: EquipmentDisplay.statusKind(reservation.status)
                )
            }
            HStack(spacing: Theme.Spacing.s2) {
                if let quantity = reservation.quantity {
                    Text("ausruestung.res.qty \(quantity)")
                        .font(Theme.Fonts.caption.weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text(verbatim: "·")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkFaint)
                }
                Text(verbatim: EquipmentDisplay.periodText(from: reservation.fromAt, to: reservation.toAt))
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
    }
}

/// Sheet-Auswahl ohne `Identifiable`-Konformanz auf dem Contracts-Typ
/// (Konformanz-Kollisionen zwischen parallelen Feature-Teams vermeiden).
struct EquipmentSelection: Identifiable {
    let equipment: Equipment
    var id: String { equipment.id }
}
