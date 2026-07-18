import SwiftUI

/// Kür teilen (nur Trainer:innen — serverseitig is_club_trainer, hier reine
/// Sichtbarkeit). Erzeugt öffentliche Token-Links (`/wettkampf/kuer/{token}`),
/// die man per QR abscannen, kopieren, über das System-Teilen weitergeben,
/// öffnen und wieder widerrufen kann. Web-Referenz:
/// kueren/[id]/ShareRoutineDialog. QR über CoreImage (RSMQRCodeView), Teilen
/// über SwiftUI `ShareLink` (UIActivityViewController).
struct ShareRoutineDialog: View {
    let routineId: String
    let routineTitle: String

    @EnvironmentObject private var session: SessionStore
    @StateObject private var viewModel = ShareRoutineViewModel()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    Text("share.intro")
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)

                    createCard
                    sharesSection
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text("share.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("share.done") { dismiss() }
                }
            }
            .alert("share.error.title", isPresented: errorBinding) {
                Button("routines.common.ok", role: .cancel) {}
            } message: {
                Text(verbatim: viewModel.errorMessage ?? "")
            }
#if DEBUG
            // NUR DEBUG/Smoke-Test: `-devAutoShare YES` erzeugt beim Öffnen
            // sofort einen Link, damit der Parity-Screenshot QR + URL zeigt.
            .task {
                if UserDefaults.standard.bool(forKey: "devAutoShare"),
                   viewModel.shares.isEmpty {
                    await viewModel.create(api: session.api, routineId: routineId)
                }
            }
#endif
        }
    }

    // MARK: - Link erstellen

    private var createCard: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                RSMSectionHeader(eyebrow: "share.eyebrow", title: "share.create.title")
                Picker("share.expiry.label", selection: $viewModel.expiry) {
                    ForEach(ShareRoutineViewModel.Expiry.allCases) { expiry in
                        Text(expiryLabel(expiry)).tag(expiry)
                    }
                }
                .pickerStyle(.segmented)

                RSMPrimaryButton(title: "share.create", isLoading: viewModel.isCreating) {
                    _Concurrency.Task {
                        await viewModel.create(api: session.api, routineId: routineId)
                    }
                }
            }
        }
    }

    // MARK: - Erzeugte Links

    @ViewBuilder
    private var sharesSection: some View {
        if viewModel.shares.isEmpty {
            RSMEmptyState(
                systemImage: "link",
                title: "share.empty.title",
                message: "share.empty.message"
            )
        } else {
            VStack(spacing: Theme.Spacing.s3) {
                ForEach(viewModel.shares, id: \.token) { share in
                    ShareLinkRow(
                        url: viewModel.fullURL(for: share),
                        expiresAt: share.expiresAt,
                        onRevoke: {
                            _Concurrency.Task {
                                await viewModel.revoke(
                                    api: session.api,
                                    routineId: routineId,
                                    token: share.token
                                )
                            }
                        }
                    )
                }
            }
        }
    }

    private func expiryLabel(_ expiry: ShareRoutineViewModel.Expiry) -> LocalizedStringKey {
        switch expiry {
        case .never: return "share.expiry.never"
        case .oneDay: return "share.expiry.1day"
        case .sevenDays: return "share.expiry.7days"
        case .thirtyDays: return "share.expiry.30days"
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(
            get: { viewModel.errorMessage != nil },
            set: { if !$0 { viewModel.errorMessage = nil } }
        )
    }
}

/// Eine Link-Zeile: QR + URL-Feld + Aktionen (Kopieren/Teilen/Öffnen/Widerrufen).
private struct ShareLinkRow: View {
    let url: String
    let expiresAt: String?
    let onRevoke: () -> Void

    @State private var copied = false

    var body: some View {
        RSMCard(padding: Theme.Spacing.s4) {
            VStack(spacing: Theme.Spacing.s3) {
                HStack(alignment: .top, spacing: Theme.Spacing.s3) {
                    RSMQRCodeView(value: url, size: 96)
                        .padding(Theme.Spacing.s1)
                        .background(Theme.Colors.bgSurface)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.s, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: Theme.Radius.s, style: .continuous)
                                .stroke(Theme.Colors.line, lineWidth: 1)
                        )

                    VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                        Text(verbatim: url)
                            .font(Theme.Fonts.monoCaption)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                            .lineLimit(3)
                            .textSelection(.enabled)
                        Text(expiresLabel)
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkSoft)
                    }
                    Spacer(minLength: 0)
                }

                HStack(spacing: Theme.Spacing.s2) {
                    Button {
                        UIPasteboard.general.string = url
                        copied = true
                    } label: {
                        Label(copied ? "share.copied" : "share.copy", systemImage: copied ? "checkmark" : "doc.on.doc")
                            .font(Theme.Fonts.caption.weight(.bold))
                    }
                    .buttonStyle(.bordered)

                    if let shareURL = URL(string: url) {
                        ShareLink(item: shareURL) {
                            Label("share.share", systemImage: "square.and.arrow.up")
                                .font(Theme.Fonts.caption.weight(.bold))
                        }
                        .buttonStyle(.bordered)
                    }

                    Spacer(minLength: 0)

                    Button(role: .destructive, action: onRevoke) {
                        Label("share.revoke", systemImage: "trash")
                            .font(Theme.Fonts.caption.weight(.bold))
                            .labelStyle(.iconOnly)
                    }
                    .buttonStyle(.bordered)
                    .tint(Theme.Colors.danger)
                    .accessibilityLabel(Text("share.revoke"))
                }
            }
        }
    }

    private var expiresLabel: LocalizedStringKey {
        expiresAt == nil ? "share.neverExpires" : "share.hasExpiry"
    }
}
