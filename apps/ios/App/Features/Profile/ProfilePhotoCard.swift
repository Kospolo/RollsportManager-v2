import SwiftUI
import PhotosUI

// ============================================================================
// „Dein Bild" — das EIGENE Profilbild setzen und entfernen.
//
// DER BEFUND: „wenn ich als Mitglied auf Profil editieren gehe kann ich nicht
// mal ein Bild einfuegen." Stimmte — der Weg gab es serverseitig seit Migration
// 0020 (`POST`/`DELETE /me/photo`), im iOS-Client aber nirgends.
//
// WARUM DIESE KARTE HIER STEHT UND NIRGENDS SONST: der Server laesst ueber
// diesen Weg AUSSCHLIESSLICH das eigene Bild zu (`where profile_id = auth.uid()`
// plus RLS `club_members_update_self`). Es gibt gar keine Route, ueber die
// jemand das Bild einer anderen Person setzen koennte — auch der Vorstand
// nicht. Die Karte gehoert deshalb ins eigene Profil und hat in der
// Mitglieder-Verwaltung nichts verloren.
//
// DER EHRLICHE SATZ UNTER DEM KNOPF ist kein Beiwerk: in einem Verein voller
// Kinder muss VOR dem Antippen klar sein, wer das Bild danach sieht (alle
// aktiven Vereinsmitglieder in der App — nicht das Internet).
// ============================================================================
struct ProfilePhotoCard: View {
    @ObservedObject var viewModel: ProfileViewModel
    let displayName: String
    /// Stabile ID fuer den Monogramm-Farbton (Mitglieds-ID).
    let personId: String?
    let onPick: (Data) -> Void
    let onRemove: () -> Void

    @State private var pickedItem: PhotosPickerItem?
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(eyebrow: "profil.photo.eyebrow", title: "profil.photo.title")

                let layout = dynamicTypeSize.isAccessibilitySize
                    ? AnyLayout(VStackLayout(alignment: .leading, spacing: Theme.Spacing.s4))
                    : AnyLayout(HStackLayout(alignment: .top, spacing: Theme.Spacing.s4))

                layout {
                    portrait
                    VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                        Text("profil.photo.intro")
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkSoft)
                            .fixedSize(horizontal: false, vertical: true)
                        buttons
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                if let error = viewModel.photoError {
                    Text(verbatim: error)
                        .font(Theme.Fonts.caption.weight(.semibold))
                        .foregroundStyle(Theme.Colors.danger)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .onChange(of: pickedItem) { loadPickedItem() }
    }

    // MARK: - Bild oder Monogramm

    @ViewBuilder
    private var portrait: some View {
        ZStack {
            if let key = viewModel.photoKey {
                Color.clear
                    .frame(width: 84, height: 84)
                    .overlay { MediaImage(key: key, placeholderSystemImage: "person.fill") }
                    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                            .stroke(Theme.Colors.line, lineWidth: 1)
                    )
            } else {
                RSMMonogramTile(name: displayName, personId: personId, size: 84)
            }
            if viewModel.isSavingPhoto {
                RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                    .fill(Theme.Colors.bgSunken.opacity(0.75))
                    .frame(width: 84, height: 84)
                    .overlay { ProgressView().tint(Theme.Colors.brand) }
            }
        }
        .accessibilityHidden(true) // Zustand steht im Knopf-Text
    }

    // MARK: - Aktionen

    private var buttons: some View {
        MembersFlowRow(spacing: Theme.Spacing.s2, lineSpacing: Theme.Spacing.s2) {
            PhotosPicker(
                selection: $pickedItem,
                matching: .images,
                photoLibrary: .shared()
            ) {
                Label(
                    viewModel.hasPhoto ? "profil.photo.replace" : "profil.photo.choose",
                    systemImage: "photo.on.rectangle.angled"
                )
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.brandContrast)
                .padding(.horizontal, Theme.Spacing.s4)
                .frame(minHeight: Theme.Size.touchTarget)
                .background(Theme.Colors.brand)
                .clipShape(Capsule())
            }
            .disabled(viewModel.isSavingPhoto)

            if viewModel.hasPhoto {
                Button(role: .destructive) {
                    onRemove()
                } label: {
                    Label("profil.photo.remove", systemImage: "trash")
                        .font(Theme.Fonts.bodyStrong)
                        .foregroundStyle(Theme.Colors.danger)
                        .padding(.horizontal, Theme.Spacing.s4)
                        .frame(minHeight: Theme.Size.touchTarget)
                        .background(Theme.Colors.dangerSoft)
                        .clipShape(Capsule())
                }
                .buttonStyle(RSMPressableButtonStyle())
                .disabled(viewModel.isSavingPhoto)
            }
        }
    }

    /// Die gewaehlte Datei als Bytes holen. `loadTransferable` liefert die
    /// ORIGINAL-Datei (HEIC, mehrere MB) — verkleinert wird erst im ViewModel,
    /// damit der Umrechnungs-Weg an genau einer Stelle liegt.
    private func loadPickedItem() {
        guard let pickedItem else { return }
        _Concurrency.Task {
            if let data = try? await pickedItem.loadTransferable(type: Data.self) {
                onPick(data)
            } else {
                viewModel.photoError = String(localized: "profil.photo.err.notAnImage")
            }
            // Zuruecksetzen, damit dieselbe Datei erneut gewaehlt werden kann.
            self.pickedItem = nil
        }
    }
}
