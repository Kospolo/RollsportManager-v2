import SwiftUI

/// ÖFFENTLICHE ROOT-VIEW des Notizen-Features (Web-Referenz: (portal)/notizen).
///
/// Integration: läuft im NavigationStack des „Mehr“-Tabs (kein eigener Stack) —
/// `NotesRootView` aus der `MehrCatalog`-Registry rendert diese View, ebenso der
/// DEBUG-Deeplink `-devMehrOpen notes`.
///
/// Private Notizen des eingeloggten Nutzers: Liste + Anlegen + Bearbeiten +
/// Löschen (mit Bestätigung). Notizen sind strikt privat (RLS) — ein ruhiger
/// Hinweis-Streifen macht „nur für dich sichtbar“ unmissverständlich. Es gibt
/// kein Trainer-Gate; die Aktionen stehen jeder:m für die eigenen Notizen offen.
struct NotesView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = NotesViewModel()
    @State private var formRequest: FormRequest?

    /// Identifizierbarer Anlegen-/Bearbeiten-Wunsch für `.sheet(item:)` —
    /// `id` = "create" bzw. die Notiz-ID, damit das Sheet je Öffnung frisch mountet.
    private struct FormRequest: Identifiable {
        let id: String
        let mode: NoteFormViewModel.Mode
    }

    var body: some View {
        Group {
            switch model.state {
            case .loading:
                loadingView
            case .moduleNotBooked:
                RSMModuleNotBookedCard(moduleName: "notizen.title")
                    .padding(Theme.Spacing.s5)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            case .error(let message):
                errorView(message)
            case .loaded:
                contentView
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("notizen.title"))
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            // Ohne gebuchtes Modul gibt es nichts anzulegen: der Server
            // beantwortet auch das POST mit 403. Ein Plus, das nur in einen
            // Fehler fuehrt, ist schlimmer als kein Plus.
            if model.state != .moduleNotBooked {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        formRequest = FormRequest(id: "create", mode: .create)
                    } label: {
                        Image(systemName: "plus")
                    }
                    .tint(Theme.Colors.brand)
                    .accessibilityLabel(Text("notizen.new.a11y"))
                }
            }
        }
        .task {
            await model.loadIfNeeded(api: session.api)
        }
        .sheet(item: $formRequest) { request in
            NoteFormSheet(mode: request.mode, api: session.api) { saved in
                model.upsert(saved)
            }
        }
        .confirmationDialog(
            deleteDialogTitle,
            isPresented: deleteDialogBinding,
            titleVisibility: .visible,
            presenting: model.deleteTarget
        ) { note in
            Button("notizen.delete.confirm", role: .destructive) {
                _Concurrency.Task { await model.confirmDelete(note) }
            }
            Button("notizen.delete.cancel", role: .cancel) {
                model.deleteTarget = nil
            }
        } message: { _ in
            Text("notizen.delete.message")
        }
        .alert("notizen.error.title", isPresented: actionErrorBinding) {
            Button("notizen.error.ok", role: .cancel) {}
        } message: {
            Text(verbatim: model.actionErrorMessage ?? "")
        }
#if DEBUG
        .task {
            // NUR DEBUG/Smoke-Test: `-devNotesOpenCreate YES` öffnet direkt das
            // Anlegen-Sheet (zusammen mit `-devPrefillNote`/`-devAutoSubmitNote`
            // fährt das einen echten POST /notes für den Screenshot-Smoke).
            guard UserDefaults.standard.bool(forKey: "devNotesOpenCreate") else { return }
            formRequest = FormRequest(id: "create", mode: .create)
        }
#endif
    }

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView()
                .tint(Theme.Colors.brand)
            Text("notizen.loading")
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
                    Text("notizen.loadError.title")
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text(verbatim: message)
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .multilineTextAlignment(.center)
                    RSMPrimaryButton(title: "notizen.retry") {
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

    // MARK: - Inhalt

    private var contentView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                subtitleText
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .frame(maxWidth: .infinity, alignment: .leading)

                privateBanner

                if model.isEmpty {
                    emptyState
                } else {
                    ForEach(model.notes, id: \.id) { note in
                        NoteCardView(
                            note: note,
                            onEdit: { formRequest = FormRequest(id: note.id, mode: .edit(note)) },
                            onDelete: { model.requestDelete(note) }
                        )
                    }
                }
            }
            .padding(Theme.Spacing.s5)
        }
        .refreshable { await model.refresh() }
    }

    /// Untertitel: Anzahl, sobald Notizen existieren — sonst der Privatheit-Satz.
    private var subtitleText: Text {
        switch model.notes.count {
        case 0: return Text("notizen.subtitle")
        case 1: return Text("notizen.count.one")
        default: return Text("notizen.count.other \(model.notes.count)")
        }
    }

    private var privateBanner: some View {
        HStack(spacing: Theme.Spacing.s2) {
            Image(systemName: "lock.fill")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Colors.inkFaint)
                .accessibilityHidden(true)
            Text("notizen.privateBanner")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Theme.Spacing.s3)
        .background(Theme.Colors.bgSurface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous)
                .stroke(Theme.Colors.line, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
    }

    private var emptyState: some View {
        RSMCard {
            RSMEmptyState(
                systemImage: "square.and.pencil",
                title: "notizen.empty.title",
                message: "notizen.empty.message",
                actionTitle: "notizen.empty.cta",
                action: { formRequest = FormRequest(id: "create", mode: .create) }
            )
        }
    }

    // MARK: - Bindings

    /// Dialogtitel mit Notiz-Name („%@ löschen?“); leer, wenn gerade keiner
    /// gewählt ist (nur während der Schließ-Animation kurz relevant).
    private var deleteDialogTitle: Text {
        model.deleteTarget.map { Text("notizen.delete.title \($0.title)") } ?? Text(verbatim: "")
    }

    private var deleteDialogBinding: Binding<Bool> {
        Binding(
            get: { model.deleteTarget != nil },
            set: { if !$0 { model.deleteTarget = nil } }
        )
    }

    private var actionErrorBinding: Binding<Bool> {
        Binding(
            get: { model.actionErrorMessage != nil },
            set: { if !$0 { model.actionErrorMessage = nil } }
        )
    }
}
