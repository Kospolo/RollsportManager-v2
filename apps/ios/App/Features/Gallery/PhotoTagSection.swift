import SwiftUI

// ============================================================================
// „Wer ist auf diesem Bild" — Foto-Markierung in der Lightbox.
// Web-Referenz: PhotoTagSection im Galerie-Bereich.
//
// ### WAS DIESE ANSICHT ABSICHTLICH NICHT TUT ###
// Sie zeigt KEIN Gesicht. Markierte Personen erscheinen als Monogramm +
// Farbton — dieselbe Identitätsführung wie in der Mitgliederliste. Der Grund
// steht in CLAUDE.md und in `RSMMonogramTile`: in diesem Verein sind sehr
// viele Kinder, und der Mitglieder-Pfad trägt keine Einwilligungs-Wache.
//
// Sie zeichnet auch KEINE Rahmen ins Bild. Eine Markierung ist hier die
// Aussage „diese Person ist auf dem Bild", nicht „an dieser Stelle im Bild" —
// die Datenlage (0056) kennt keine Koordinaten, und ein Rahmen würde eine
// Genauigkeit vortäuschen, die es nicht gibt.
//
// Das Recht zu markieren hat nur der Trainerstab; das Recht, eine Markierung
// zurückzunehmen, hat zusätzlich die markierte Person selbst. Beides
// entscheidet verbindlich der Server — hier wird nur passend eingeblendet.
// ============================================================================

struct PhotoTagSection: View {
    let item: GalleryItem
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = PhotoTagViewModel()
    @State private var isPickingMember = false

    /// Nur der Trainerstab darf markieren (COACH_ROLES; `isTrainer` bildet
    /// genau das ab und schliesst treasurer/guest_coach aus).
    private var canTag: Bool { session.permissions.isTrainer }

    private var myMemberId: String? { session.session?.profile.memberId }

    var body: some View {
        RSMCard(padding: Theme.Spacing.s4) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                header
                content
            }
        }
        .task {
            await model.loadIfNeeded(
                itemId: item.id,
                api: session.api,
                clubId: session.clubId
            )
        }
        .sheet(isPresented: $isPickingMember) {
            PhotoTagPicker(item: item, model: model)
        }
        .alert(
            "gallery.tags.error.title",
            isPresented: Binding(
                get: { model.actionError != nil },
                set: { if !$0 { model.actionError = nil } }
            ),
            presenting: model.actionError
        ) { _ in
            Button("routines.common.ok", role: .cancel) {}
        } message: { message in
            Text(verbatim: message)
        }
    }

    // MARK: - Kopf

    private var header: some View {
        HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s2) {
            Text("gallery.tags.title")
                .font(Theme.Fonts.h3)
                .foregroundStyle(Theme.Colors.inkPrimary)
            Spacer(minLength: 0)
            if canTag {
                Button {
                    isPickingMember = true
                } label: {
                    Label("gallery.tags.add", systemImage: "person.badge.plus")
                        .font(Theme.Fonts.caption.weight(.bold))
                        .foregroundStyle(Theme.Colors.brandInk)
                }
                .disabled(model.isMutating)
                .frame(minHeight: Theme.Size.touchTarget)
            }
        }
    }

    // MARK: - Inhalt

    @ViewBuilder
    private var content: some View {
        switch model.state {
        case .loading:
            ProgressView()
                .tint(Theme.Colors.brand)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Theme.Spacing.s4)
        case .forbidden:
            Text("gallery.tags.forbidden.read")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
        case .failed(let message):
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                Text(verbatim: message)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.danger)
                    .fixedSize(horizontal: false, vertical: true)
                RSMSecondaryButton(title: "routines.common.retry") {
                    _Concurrency.Task {
                        await model.load(itemId: item.id, api: session.api, clubId: session.clubId)
                    }
                }
            }
        case .loaded(let tags):
            if tags.isEmpty {
                Text(canTag ? "gallery.tags.empty.staff" : "gallery.tags.empty")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                VStack(spacing: Theme.Spacing.s2) {
                    ForEach(tags, id: \.id) { tag in
                        row(tag)
                    }
                }
                // Der ehrliche Satz zur unvollständigen Liste: wer nicht
                // eingewilligt hat, taucht hier nicht auf — das ist kein
                // Ladefehler, und niemand soll danach suchen.
                Text("gallery.tags.consentNote")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkFaint)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func row(_ tag: PhotoTag) -> some View {
        let name = model.name(for: tag.memberId)
        return HStack(spacing: Theme.Spacing.s3) {
            RSMAvatarView(
                name: name ?? "?",
                personId: tag.memberId,
                size: 32
            )
            if let name {
                Text(verbatim: name)
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                // Kein Name sichtbar ⇒ das Mitglied liegt ausserhalb dessen,
                // was diese Rolle sehen darf. Die UUID wäre hier eine
                // Auskunft, die die RLS gerade verweigert hat.
                Text("gallery.tags.unknownMember")
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
            Spacer(minLength: Theme.Spacing.s2)
            if canRemove(tag) {
                Button {
                    _Concurrency.Task { await model.untag(tag, api: session.api) }
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(Theme.Colors.inkFaint)
                }
                .buttonStyle(.plain)
                .disabled(model.isMutating)
                .frame(width: Theme.Size.touchTarget, height: Theme.Size.touchTarget)
                .accessibilityLabel(Text("gallery.tags.remove.a11y \(name ?? "")"))
            }
        }
        .frame(minHeight: Theme.Size.listRow)
    }

    /// Wegnehmen darf der Trainerstab — und die markierte Person selbst.
    /// (Vormünder erlaubt der Server zusätzlich; das Token trägt die
    /// Elternschaft nicht, deshalb kann der Client sie nicht vorwegnehmen.
    /// Sie bekommen den Knopf hier nicht zu sehen, aber ihr DELETE geht durch.)
    private func canRemove(_ tag: PhotoTag) -> Bool {
        canTag || tag.memberId == myMemberId
    }
}

/// Auswahl beim Markieren: durchsuchbare Mitgliederliste, bereits markierte
/// Personen sind heraus. Bewusst ein eigenes Sheet statt eines Menüs — ein
/// Verein hat schnell 200 Mitglieder, und ein Menü kann man nicht durchsuchen.
struct PhotoTagPicker: View {
    let item: GalleryItem
    @ObservedObject var model: PhotoTagViewModel
    @EnvironmentObject private var session: SessionStore
    @Environment(\.dismiss) private var dismiss
    @State private var search = ""

    var body: some View {
        NavigationStack {
            let candidates = model.selectableMembers(matching: search)
            Group {
                if candidates.isEmpty {
                    RSMEmptyState(
                        systemImage: "person.crop.circle.badge.questionmark",
                        title: "gallery.tags.picker.empty.title",
                        message: "gallery.tags.picker.empty.message"
                    )
                } else {
                    List(candidates, id: \.id) { member in
                        Button {
                            _Concurrency.Task {
                                await model.tag(
                                    memberId: member.id,
                                    itemId: item.id,
                                    clubId: session.clubId,
                                    api: session.api
                                )
                                dismiss()
                            }
                        } label: {
                            HStack(spacing: Theme.Spacing.s3) {
                                RSMAvatarView(
                                    name: member.membersFullName,
                                    personId: member.id,
                                    size: 32
                                )
                                Text(verbatim: member.membersFullName)
                                    .font(Theme.Fonts.body)
                                    .foregroundStyle(Theme.Colors.inkPrimary)
                                Spacer(minLength: 0)
                            }
                            .frame(minHeight: Theme.Size.listRow)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(Theme.Colors.bgSurface)
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text("gallery.tags.picker.title"))
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $search, prompt: Text("gallery.tags.picker.search"))
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("gallery.tags.picker.cancel") { dismiss() }
                }
            }
        }
    }
}
