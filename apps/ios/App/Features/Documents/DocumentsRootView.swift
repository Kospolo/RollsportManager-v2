import SwiftUI
import QuickLook

/// Dokumente (PRO). Lädt Entitlement + Liste, gate wie die Galerie. Tippen auf
/// eine Zeile lädt die Datei auth-tragend (GET /media/{key} mit Bearer) in eine
/// temporäre Datei und zeigt sie in QuickLook (dort auch Teilen). Web-Referenz:
/// /(portal)/dokumente.
struct DocumentsRootView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var viewModel = DocumentsViewModel()
    @State private var showUpload = false
    @State private var manageTarget: DocumentManageTarget?

    var body: some View {
        ScrollView {
            content
                .padding(Theme.Spacing.s5)
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("documents.title"))
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            if session.permissions.isClubAdmin, viewModel.canUpload {
                ToolbarItem(placement: .primaryAction) {
                    Button { showUpload = true } label: { Image(systemName: "plus") }
                        .accessibilityLabel(Text(verbatim: "Dokument hochladen"))
                }
            }
        }
        .task { await viewModel.loadIfNeeded(api: session.api, clubId: session.clubId) }
        .quickLookPreview($viewModel.previewURL)
        .sheet(isPresented: $showUpload) {
            DocumentUploadSheet(
                api: session.api,
                clubId: session.clubId,
                categories: viewModel.categories
            ) { created in
                viewModel.insert(created)
            }
        }
        .sheet(item: $manageTarget) { target in
            DocumentManageSheet(
                api: session.api,
                document: target.document,
                uploaderName: viewModel.uploaderName(for: target.document)
            ) { deletedId in
                viewModel.remove(documentId: deletedId)
            }
        }
        .alert("documents.download.errorTitle", isPresented: downloadErrorBinding) {
            Button("routines.common.ok", role: .cancel) {}
        } message: {
            Text(verbatim: viewModel.downloadError ?? "")
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            ProgressView()
                .tint(Theme.Colors.brand)
                .frame(maxWidth: .infinity)
                .padding(.top, Theme.Spacing.s9)
        case .proRequired:
            RSMProGateCard(
                title: "documents.pro.title",
                message: "documents.pro.message",
                systemImage: "doc.fill"
            )
        case .moduleNotBooked:
            RSMModuleNotBookedCard(moduleName: "documents.title")
        case .error(let message):
            errorCard(message)
        case .loaded(let docs):
            if docs.isEmpty {
                RSMEmptyState(
                    systemImage: "doc.fill",
                    title: "documents.empty.title",
                    message: "documents.empty.message"
                )
                .padding(.top, Theme.Spacing.s7)
            } else {
                loadedList
            }
        }
    }

    private var loadedList: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            if !viewModel.categories.isEmpty {
                categoryChips
            }
            VStack(spacing: Theme.Spacing.s2) {
                ForEach(viewModel.visibleDocuments, id: \.id) { doc in
                    Button {
                        // Verwaltende oeffnen das Verwalten-Sheet (Oeffnen +
                        // Loeschen); alle anderen laden direkt herunter.
                        if session.permissions.isClubAdmin {
                            manageTarget = DocumentManageTarget(document: doc)
                        } else {
                            _Concurrency.Task { await viewModel.open(document: doc, api: session.api) }
                        }
                    } label: {
                        DocumentRow(
                            document: doc,
                            uploaderName: viewModel.uploaderName(for: doc),
                            isLoading: viewModel.downloadingId == doc.id
                        )
                    }
                    .buttonStyle(RSMPressableButtonStyle())
                    .disabled(viewModel.downloadingId != nil)
                }
            }
        }
    }

    private var categoryChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.s2) {
                categoryChip(title: "documents.allCategories", value: nil)
                ForEach(viewModel.categories, id: \.self) { category in
                    categoryChip(title: LocalizedStringKey(category), value: category)
                }
            }
            .padding(.horizontal, 2)
        }
    }

    private func categoryChip(title: LocalizedStringKey, value: String?) -> some View {
        let isActive = viewModel.selectedCategory == value
        return Button {
            viewModel.selectedCategory = value
        } label: {
            Text(title)
                .font(Theme.Fonts.caption.weight(.bold))
                .foregroundStyle(isActive ? Theme.Colors.brandContrast : Theme.Colors.inkSoft)
                .padding(.horizontal, Theme.Spacing.s3)
                .padding(.vertical, Theme.Spacing.s2)
                .background(isActive ? Theme.Colors.brand : Theme.Colors.bgSunken)
                .clipShape(Capsule())
        }
        .buttonStyle(RSMPressableButtonStyle())
    }

    private func errorCard(_ message: String) -> some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                Text("documents.error.title")
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.danger)
                Text(verbatim: message)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                RSMSecondaryButton(title: "routines.common.retry") {
                    _Concurrency.Task { await viewModel.load(api: session.api, clubId: session.clubId) }
                }
            }
        }
    }

    private var downloadErrorBinding: Binding<Bool> {
        Binding(
            get: { viewModel.downloadError != nil },
            set: { if !$0 { viewModel.downloadError = nil } }
        )
    }
}

/// Identifiable-Wrapper fuers `.sheet(item:)` — `Document` selbst ist (wie im
/// Contract generiert) nicht Identifiable; die Liste nutzt `id: \.id`.
private struct DocumentManageTarget: Identifiable {
    let document: Document
    var id: String { document.id }
}

/// Eine Dokument-Zeile: Typ-Icon, Titel + Kategorie/Größe, „von … · Datum" und
/// Download-Chevron (Spinner während des Ladens).
struct DocumentRow: View {
    let document: Document
    /// Anzeigename der hochladenden Person (nil ⇒ nur Datum in der Meta-Zeile).
    var uploaderName: String?
    var isLoading = false

    var body: some View {
        HStack(spacing: Theme.Spacing.s3) {
            Image(systemName: iconName)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Theme.Colors.info)
                .frame(width: 40, height: 40)
                .background(Theme.Colors.infoSoft)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: document.title)
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .lineLimit(1)
                Text(verbatim: subtitle)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .lineLimit(1)
                if let meta = metaLine {
                    Text(verbatim: meta)
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
            if isLoading {
                ProgressView().tint(Theme.Colors.inkFaint)
            } else {
                Image(systemName: "arrow.down.circle")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Theme.Colors.inkFaint)
                    .accessibilityHidden(true)
            }
        }
        .padding(Theme.Spacing.s3)
        .frame(minHeight: Theme.Size.listRow)
        .background(Theme.Colors.bgSurface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous)
                .stroke(Theme.Colors.line, lineWidth: 1)
        )
    }

    private var iconName: String {
        switch document.contentType.lowercased() {
        case let t where t.contains("pdf"): return "doc.richtext.fill"
        case let t where t.hasPrefix("image/"): return "photo.fill"
        case let t where t.hasPrefix("video/"): return "film.fill"
        default: return "doc.fill"
        }
    }

    private var subtitle: String {
        var parts = [document.category]
        if let bytes = document.sizeBytes {
            parts.append(ByteCountFormatter.string(fromByteCount: Int64(bytes), countStyle: .file))
        }
        return parts.joined(separator: " · ")
    }

    /// „von {Name} · {Datum}" — ohne bekannten Namen nur das Datum, ohne
    /// lesbares Datum nur „von {Name}". Nil, wenn beides fehlt.
    private var metaLine: String? {
        let date = Self.formattedDate(document.createdAt)
        let name = uploaderName?.trimmingCharacters(in: .whitespaces)
        let by: String? = (name?.isEmpty == false)
            ? String(format: String(localized: "documents.uploadedBy"), name!)
            : nil
        switch (by, date) {
        case let (by?, date?): return "\(by) · \(date)"
        case let (by?, nil): return by
        case let (nil, date?): return date
        default: return nil
        }
    }

    /// ISO-8601 (`created_at`) → lokalisiertes mittleres Datum; nil bei Parse-Fehler.
    private static func formattedDate(_ raw: String) -> String? {
        let date = isoFractional.date(from: raw) ?? isoPlain.date(from: raw)
        return date.map { dateDisplay.string(from: $0) }
    }

    private static let isoFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let isoPlain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()
    private static let dateDisplay: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .none
        return f
    }()
}
