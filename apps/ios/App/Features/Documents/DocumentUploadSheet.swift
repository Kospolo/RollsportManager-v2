import SwiftUI
import UniformTypeIdentifiers

// „Dokument hochladen"-Sheet (Trainer+PRO, Gate im Root auf isClubAdmin).
// Spiegelt den Web-Dialog DocumentUploadDialog.tsx: Datei waehlen (der Server
// erzwingt die echte Allowlist), Titel (aus dem Dateinamen vorbelegt), optionale
// Kategorie. Der Upload ist zweistufig — POST /media/upload, dann POST /documents
// (siehe Endpoints+DocumentsWrite.swift). Fehler kommen als Klartext ins Sheet:
// 402 (kein PRO), 403 (kein Trainer), 413 (> 25 MB), 415 (Dateityp).

struct DocumentUploadSheet: View {
    let api: APIClient
    let clubId: String
    /// Bereits vorhandene Kategorien — als Vorschlaege unter dem Feld.
    var categories: [String] = []
    /// Das fertig angelegte Dokument (fuer das lokale Einsortieren in die Liste).
    let onUploaded: (Document) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var fileData: Data?
    @State private var fileName = ""
    @State private var mimeType = ""
    @State private var title = ""
    @State private var category = ""
    @State private var showImporter = false
    @State private var saving = false
    @State private var errorMessage: String?

    /// Server-Grenze: 25 MB (sonst 413) — hier schon vorab abgefangen.
    private static let maxBytes = 25 * 1024 * 1024

    /// Vorschlaege fuers Auswahlfenster; der Server erzwingt die echte Allowlist.
    private static let allowedTypes: [UTType] = {
        var types: [UTType] = [.pdf, .plainText, .commaSeparatedText, .image]
        for ext in ["doc", "docx", "xls", "xlsx", "ppt", "pptx"] {
            if let type = UTType(filenameExtension: ext) { types.append(type) }
        }
        return types
    }()

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Button {
                        showImporter = true
                    } label: {
                        Text(verbatim: fileData == nil ? "Datei waehlen" : "Datei aendern")
                    }
                    .disabled(saving)
                    if let fileData {
                        HStack(spacing: Theme.Spacing.s2) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(Theme.Colors.success)
                            Text(verbatim: fileName)
                                .lineLimit(1)
                            Spacer(minLength: Theme.Spacing.s2)
                            Text(verbatim: ByteCountFormatter.string(
                                fromByteCount: Int64(fileData.count), countStyle: .file))
                                .foregroundStyle(Theme.Colors.inkSoft)
                        }
                        .font(Theme.Fonts.caption)
                    }
                } header: {
                    Text(verbatim: "Datei")
                } footer: {
                    Text(verbatim: "PDF, Office-Dokumente oder Bilder, max. 25 MB.")
                }

                Section {
                    TextField(text: $title) { Text(verbatim: "Titel") }
                    TextField(text: $category) { Text(verbatim: "Kategorie (optional)") }
                } footer: {
                    if !categories.isEmpty {
                        Text(verbatim: "Vorhanden: \(categories.joined(separator: ", "))")
                    }
                }

                if let errorMessage {
                    Section { Text(verbatim: errorMessage).foregroundStyle(Theme.Colors.danger) }
                }
            }
            .navigationTitle(Text(verbatim: "Dokument hochladen"))
#if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: { Text(verbatim: "Abbrechen") }.disabled(saving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        submit()
                    } label: {
                        saving ? AnyView(ProgressView()) : AnyView(Text(verbatim: "Hochladen"))
                    }
                    .disabled(!canSubmit || saving)
                }
            }
            .fileImporter(
                isPresented: $showImporter,
                allowedContentTypes: Self.allowedTypes,
                allowsMultipleSelection: false
            ) { result in
                handlePick(result)
            }
        }
    }

    private var canSubmit: Bool {
        fileData != nil && !title.trimmingCharacters(in: .whitespaces).isEmpty
    }

    /// Datei aus dem Importer lesen (security-scoped) und Titel vorbelegen.
    private func handlePick(_ result: Result<[URL], Error>) {
        errorMessage = nil
        switch result {
        case .failure(let error):
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        case .success(let urls):
            guard let url = urls.first else { return }
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            do {
                let data = try Data(contentsOf: url)
                if data.count > Self.maxBytes {
                    errorMessage = "Die Datei ist groesser als 25 MB."
                    return
                }
                fileData = data
                fileName = url.lastPathComponent
                mimeType = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType
                    ?? "application/octet-stream"
                if title.trimmingCharacters(in: .whitespaces).isEmpty {
                    title = url.deletingPathExtension().lastPathComponent
                }
            } catch {
                errorMessage = "Die Datei konnte nicht gelesen werden."
            }
        }
    }

    private func submit() {
        guard canSubmit, !saving, let data = fileData else { return }
        saving = true
        errorMessage = nil
        let cleanTitle = title.trimmingCharacters(in: .whitespaces)
        let cleanCategory = category.trimmingCharacters(in: .whitespaces)
        let name = fileName
        let mime = mimeType
        _Concurrency.Task {
            do {
                let uploaded = try await api.uploadMedia(
                    clubId: clubId, data: data, mimeType: mime, fileName: name)
                let created = try await api.createDocument(DocumentCreate(
                    clubId: clubId,
                    title: cleanTitle,
                    storageKey: uploaded.storageKey,
                    contentType: uploaded.contentType,
                    sizeBytes: uploaded.sizeBytes,
                    category: cleanCategory.isEmpty ? nil : cleanCategory
                ))
                onUploaded(created)
                dismiss()
            } catch {
                errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
            }
            saving = false
        }
    }
}
