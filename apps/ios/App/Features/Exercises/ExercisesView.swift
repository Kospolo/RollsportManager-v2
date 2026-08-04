import SwiftUI

/// ÖFFENTLICHE ROOT-VIEW des Übungen-Features (Übungsbibliothek): Karten-Grid
/// des Trainingskatalogs mit Kategorie-Filter (Chips mit Zähler),
/// Schwierigkeits-Punkten, Video-Marker und Detail-Sheet (Anleitung/Dauer/
/// Video). Rein lesend — Anlegen bietet die iOS-API derzeit nicht an. Läuft im
/// NavigationStack des „Mehr“-Tabs; `SessionStore` kommt aus dem Environment.
/// Web-Referenz-UX: apps/web/app/(portal)/uebungen.
struct ExercisesView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = ExercisesViewModel()
    @State private var selection: ExerciseSelection?
    @State private var editSelection: ExerciseSelection?
    @State private var showCreate = false

    /// Ein Adaptiv-Grid: auf dem iPhone eine Spalte (lesbare Karten), auf
    /// breiten Layouts (iPad/Landscape) mehrspaltig — analog zum responsiven
    /// Web-Grid (sm:2 / xl:3).
    private let columns = [
        GridItem(.adaptive(minimum: 320, maximum: .infinity), spacing: Theme.Spacing.cardGap)
    ]

    var body: some View {
        Group {
            switch model.state {
            case .loading:
                loadingView
            case .error(let message):
                errorView(message)
            case .loaded:
                loadedView
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("uebungen.title"))
        .toolbar {
            if session.permissions.isTrainer {
                ToolbarItem(placement: .primaryAction) {
                    Button { showCreate = true } label: { Image(systemName: "plus") }
                        .accessibilityLabel(Text(verbatim: "Neue Übung"))
                }
            }
        }
        .sheet(isPresented: $showCreate) {
            ExerciseCreateSheet(api: session.api, clubId: session.clubId) {
                _Concurrency.Task { await model.refresh() }
            }
        }
        .navigationBarTitleDisplayMode(.large)
        .task {
            await model.loadIfNeeded(api: session.api, clubId: session.clubId)
        }
        .sheet(item: $selection) { selected in
            let item = latest(for: selected)
            ExerciseDetailSheet(exercise: item, authorName: model.authorName(for: item))
        }
        .sheet(item: $editSelection) { selected in
            let item = latest(for: selected)
            ExerciseEditSheet(
                api: session.api,
                exercise: item,
                onSaved: { _Concurrency.Task { await model.refresh() } },
                onDeleted: { _Concurrency.Task { await model.refresh() } }
            )
        }
        .alert("uebungen.error.refreshTitle", isPresented: refreshErrorBinding) {
            Button("uebungen.error.ok", role: .cancel) {}
        } message: {
            Text(verbatim: model.refreshErrorMessage ?? "")
        }
    }

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView()
                .tint(Theme.Colors.brand)
            Text("uebungen.loading")
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
                    Text("uebungen.error.title")
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text(verbatim: message)
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .multilineTextAlignment(.center)
                    RSMPrimaryButton(title: "uebungen.error.retry") {
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

    // MARK: - Geladen

    private var loadedView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.s5) {
                Text("uebungen.subtitle")
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .frame(maxWidth: .infinity, alignment: .leading)

                if model.exercises.isEmpty {
                    emptyState
                } else {
                    ExerciseFilterChips(model: model)
                    contentBody
                }
            }
            .padding(Theme.Spacing.s5)
        }
        .refreshable { await model.refresh() }
    }

    @ViewBuilder
    private var contentBody: some View {
        let visible = model.visibleExercises
        if visible.isEmpty {
            filterEmptyState
        } else {
            LazyVGrid(columns: columns, alignment: .leading, spacing: Theme.Spacing.cardGap) {
                ForEach(visible, id: \.id) { exercise in
                    RSMCard(padding: 0) {
                        ExerciseCardView(
                            exercise: exercise,
                            authorName: model.authorName(for: exercise)
                        ) {
                            if session.permissions.isTrainer {
                                editSelection = ExerciseSelection(exercise: exercise)
                            } else {
                                selection = ExerciseSelection(exercise: exercise)
                            }
                        }
                    }
                }
            }
        }
    }

    private var emptyState: some View {
        RSMCard {
            RSMEmptyState(
                systemImage: "figure.flexibility",
                title: "uebungen.empty.title",
                message: "uebungen.empty.body"
            )
        }
    }

    private var filterEmptyState: some View {
        RSMCard {
            RSMEmptyState(
                systemImage: "magnifyingglass",
                title: "uebungen.filterEmpty.title",
                message: "uebungen.filterEmpty.body",
                actionTitle: "uebungen.filterEmpty.cta",
                action: { model.selectedCategory = nil }
            )
        }
    }

    // MARK: - Helfer

    /// Fürs Sheet immer den aktuellsten Stand aus der Liste nehmen
    /// (die Auswahl ist nur ein Schnappschuss).
    private func latest(for selection: ExerciseSelection) -> Exercise {
        model.exercises.first { $0.id == selection.exercise.id } ?? selection.exercise
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
struct ExerciseSelection: Identifiable {
    let exercise: Exercise
    var id: String { exercise.id }
}
