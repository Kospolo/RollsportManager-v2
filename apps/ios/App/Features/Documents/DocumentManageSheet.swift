import SwiftUI
import QuickLook

// „Dokument verwalten"-Sheet (Trainer+PRO, Gate im Root auf isClubAdmin).
// Ein Tippen auf eine Dokument-Zeile oeffnet — fuer Verwaltende — dieses Sheet.
// Es buendelt die zwei Schreib-/Lese-Aktionen an EINEM Ort, wie die Aktions-
// spalte der Web-Tabelle (DocumentsTable.tsx): „Oeffnen" laedt die Datei
// auth-tragend in eine temporaere Datei (QuickLook, dort auch Teilen), „Loeschen"
// liegt hinter einer Bestaetigung (DELETE /documents/{id}). Mitglieder ohne Recht
// laden weiterhin direkt per Tippen (Root-View), sie sehen dieses Sheet nie.

struct DocumentManageSheet: View {
    let api: APIClient
    let document: Document
    /// Anzeigename der hochladenden Person (nil ⇒ Zeile entfaellt).
    var uploaderName: String?
    /// Callback nach erfolgreichem Loeschen — die `id` der entfernten Zeile.
    let onDeleted: (String) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var downloading = false
    @State private var deleting = false
    @State private var showDeleteConfirm = false
    @State private var previewURL: URL?
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent {
                        Text(verbatim: document.title).lineLimit(2)
                    } label: {
                        Text(verbatim: "Titel")
                    }
                    LabeledContent {
                        Text(verbatim: document.category)
                    } label: {
                        Text(verbatim: "Kategorie")
                    }
                    if let bytes = document.sizeBytes {
                        LabeledContent {
                            Text(verbatim: ByteCountFormatter.string(
                                fromByteCount: Int64(bytes), countStyle: .file))
                        } label: {
                            Text(verbatim: "Groesse")
                        }
                    }
                    if let uploaderName, !uploaderName.isEmpty {
                        LabeledContent {
                            Text(verbatim: uploaderName)
                        } label: {
                            Text(verbatim: "Hochgeladen von")
                        }
                    }
                } header: {
                    Text(verbatim: "Dokument")
                }

                Section {
                    Button {
                        open()
                    } label: {
                        HStack {
                            Label {
                                Text(verbatim: "Oeffnen")
                            } icon: {
                                Image(systemName: "arrow.down.circle")
                            }
                            if downloading {
                                Spacer(minLength: Theme.Spacing.s2)
                                ProgressView()
                            }
                        }
                    }
                    .disabled(downloading || deleting)
                }

                Section {
                    Button(role: .destructive) {
                        showDeleteConfirm = true
                    } label: {
                        HStack {
                            Label {
                                Text(verbatim: "Loeschen")
                            } icon: {
                                Image(systemName: "trash")
                            }
                            if deleting {
                                Spacer(minLength: Theme.Spacing.s2)
                                ProgressView()
                            }
                        }
                    }
                    .disabled(downloading || deleting)
                }

                if let errorMessage {
                    Section { Text(verbatim: errorMessage).foregroundStyle(Theme.Colors.danger) }
                }
            }
            .navigationTitle(Text(verbatim: "Dokument verwalten"))
#if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: { Text(verbatim: "Fertig") }.disabled(deleting)
                }
            }
            .confirmationDialog(
                Text(verbatim: "Dokument loeschen?"),
                isPresented: $showDeleteConfirm,
                titleVisibility: .visible
            ) {
                Button(role: .destructive) {
                    performDelete()
                } label: {
                    Text(verbatim: "Endgueltig loeschen")
                }
                Button(role: .cancel) {} label: { Text(verbatim: "Abbrechen") }
            } message: {
                Text(verbatim: "„\(document.title)“ wird entfernt. Das lässt sich nicht rückgängig machen.")
            }
            .quickLookPreview($previewURL)
        }
    }

    /// Datei auth-tragend laden und in QuickLook zeigen.
    private func open() {
        guard !downloading, !deleting else { return }
        downloading = true
        errorMessage = nil
        _Concurrency.Task {
            do {
                previewURL = try await api.downloadMedia(
                    key: document.storageKey, suggestedName: document.title)
            } catch {
                errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
            }
            downloading = false
        }
    }

    private func performDelete() {
        guard !deleting else { return }
        deleting = true
        errorMessage = nil
        _Concurrency.Task {
            do {
                _ = try await api.deleteDocument(documentId: document.id)
                onDeleted(document.id)
                dismiss()
            } catch {
                errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
            }
            deleting = false
        }
    }
}
