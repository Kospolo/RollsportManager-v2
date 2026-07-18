import PhotosUI
import SwiftUI

/// Karte „Vereinslogo" in den Vereins-Einstellungen (Migration 0060).
///
/// ANZEIGEN darf jede:r — die Logo-Route ist bewusst öffentlich. SETZEN und
/// ENTFERNEN nur owner/admin (`canEdit`, spiegelt `canManageClubSettings`);
/// moderator ist hier ausdrücklich NICHT dabei, weil das Logo zu den
/// Vereins-Stammdaten gehört. Der Server bleibt die Grenze: ein 403 kommt als
/// Klartext-Meldung zurück, angezeigt bleibt der alte Stand.
struct AdminClubLogoCard: View {
    let clubId: String
    let canEdit: Bool
    /// Ob der geladene Verein bereits ein Logo trägt (`club.logo_asset_id`) —
    /// steuert nur die Sichtbarkeit von „Entfernen".
    var initialHasLogo: Bool = false

    @EnvironmentObject private var session: SessionStore
    @State private var pickerItem: PhotosPickerItem?
    @State private var isWorking = false
    @State private var errorMessage: String?
    @State private var confirmRemove = false
    /// Wechselt nach jedem Schreiben — erzwingt das Neuladen der Logo-Ansicht.
    @State private var reloadToken = ""
    /// `true`, sobald in dieser Sitzung ein Logo gesetzt wurde bzw. der Server
    /// eines gemeldet hat (steuert die Sichtbarkeit von „Entfernen").
    @State private var hasLogo = false

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(eyebrow: "verein.logo.eyebrow", title: "verein.logo.title")

                HStack(spacing: Theme.Spacing.s4) {
                    RSMClubLogoView(clubId: clubId, size: 72, reloadToken: reloadToken)
                    VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                        Text("verein.logo.hint")
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkSoft)
                            .fixedSize(horizontal: false, vertical: true)
                        if isWorking {
                            HStack(spacing: Theme.Spacing.s2) {
                                ProgressView().tint(Theme.Colors.brand)
                                Text("verein.logo.working")
                                    .font(Theme.Fonts.caption)
                                    .foregroundStyle(Theme.Colors.inkSoft)
                            }
                        }
                    }
                    Spacer(minLength: 0)
                }

                if canEdit { actions } else { readOnlyNote }

                if let errorMessage {
                    Text(verbatim: errorMessage)
                        .font(Theme.Fonts.caption.weight(.semibold))
                        .foregroundStyle(Theme.Colors.danger)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .onAppear { if !hasLogo { hasLogo = initialHasLogo } }
        .task(id: pickerItem) { await handlePick() }
        .confirmationDialog(
            Text("verein.logo.remove.title"),
            isPresented: $confirmRemove,
            titleVisibility: .visible
        ) {
            Button(role: .destructive) {
                _Concurrency.Task { await remove() }
            } label: {
                Text("verein.logo.remove.confirm")
            }
            Button("verein.logo.remove.cancel", role: .cancel) {}
        } message: {
            Text("verein.logo.remove.message")
        }
    }

    // MARK: - Aktionen (nur owner/admin)

    private var actions: some View {
        HStack(spacing: Theme.Spacing.s2) {
            PhotosPicker(selection: $pickerItem, matching: .images, photoLibrary: .shared()) {
                HStack(spacing: Theme.Spacing.s1) {
                    Image(systemName: "photo.badge.plus")
                        .font(.system(size: 12, weight: .semibold))
                    Text("verein.logo.choose")
                        .font(Theme.Fonts.caption.weight(.bold))
                }
                .foregroundStyle(Theme.Colors.brandInk)
                .padding(.horizontal, Theme.Spacing.s3)
                .frame(minHeight: Theme.Size.touchTarget)
                .background(Theme.Colors.brandSoft)
                .clipShape(Capsule())
            }
            .disabled(isWorking)

            Spacer(minLength: 0)

            if hasLogo {
                Button {
                    confirmRemove = true
                } label: {
                    Text("verein.logo.remove")
                        .font(Theme.Fonts.caption.weight(.bold))
                        .foregroundStyle(Theme.Colors.danger)
                        .padding(.horizontal, Theme.Spacing.s3)
                        .frame(minHeight: Theme.Size.touchTarget)
                }
                .buttonStyle(RSMPressableButtonStyle())
                .disabled(isWorking)
            }
        }
    }

    private var readOnlyNote: some View {
        Text("verein.logo.readonly")
            .font(Theme.Fonts.caption)
            .foregroundStyle(Theme.Colors.inkSoft)
            .fixedSize(horizontal: false, vertical: true)
    }

    // MARK: - Schreiben

    private func handlePick() async {
        guard let pickerItem else { return }
        errorMessage = nil
        isWorking = true
        defer {
            isWorking = false
            self.pickerItem = nil
        }
        guard let data = try? await pickerItem.loadTransferable(type: Data.self), !data.isEmpty else {
            errorMessage = NSLocalizedString("verein.logo.err.read", comment: "Bild nicht lesbar")
            return
        }
        do {
            let club = try await session.api.uploadClubLogo(
                clubId: clubId,
                data: data,
                mimeType: Self.mimeType(for: data),
                fileName: "vereinslogo"
            )
            hasLogo = club.logoAssetId != nil
            refreshLogo()
        } catch {
            errorMessage = message(for: error)
        }
    }

    private func remove() async {
        errorMessage = nil
        isWorking = true
        defer { isWorking = false }
        do {
            let club = try await session.api.deleteClubLogo(clubId: clubId)
            hasLogo = club.logoAssetId != nil
            refreshLogo()
        } catch {
            errorMessage = message(for: error)
        }
    }

    private func refreshLogo() {
        ClubLogoStore.shared.invalidate(clubId: clubId)
        reloadToken = UUID().uuidString
    }

    private func message(for error: Error) -> String {
        error.isForbiddenAPIError
            ? NSLocalizedString("verein.logo.err.forbidden", comment: "403 beim Vereinslogo")
            : ((error as? APIError)?.errorDescription ?? error.localizedDescription)
    }

    /// Bildtyp aus den ersten Bytes (Magic Number). Der Server akzeptiert nur
    /// Bilder und prüft den Content-Type — ein falsch geratener Typ wäre ein
    /// 415, deshalb wird geraten statt pauschal „image/jpeg" behauptet.
    private static func mimeType(for data: Data) -> String {
        let bytes = [UInt8](data.prefix(12))
        if bytes.starts(with: [0xFF, 0xD8, 0xFF]) { return "image/jpeg" }
        if bytes.starts(with: [0x89, 0x50, 0x4E, 0x47]) { return "image/png" }
        if bytes.starts(with: [0x47, 0x49, 0x46]) { return "image/gif" }
        if bytes.count >= 12,
           Array(bytes[0..<4]) == [0x52, 0x49, 0x46, 0x46],
           Array(bytes[8..<12]) == [0x57, 0x45, 0x42, 0x50] {
            return "image/webp"
        }
        if bytes.count >= 12, Array(bytes[4..<8]) == [0x66, 0x74, 0x79, 0x70] {
            return "image/heic"
        }
        return "image/jpeg"
    }
}
