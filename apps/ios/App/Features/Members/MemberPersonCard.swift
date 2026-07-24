import SwiftUI

// ============================================================================
// DIE PERSONEN-KARTE — was ein Mitglied von einem anderen Menschen sieht.
//
// DER BEFUND, DER SIE AUSGELOEST HAT (am iPhone gesehen): wer als einfaches
// Mitglied eine fremde Person oeffnete, bekam ein DATENBLATT — „Stammdaten ·
// E-Mail: Nicht hinterlegt · Geburtsdatum: Nicht hinterlegt · Im Verein seit:
// Nicht hinterlegt · Familie: keine sichtbar". Der Server hatte voellig richtig
// geschwiegen (alle vier Felder kamen als `null`); die App hat aus dem
// Schweigen ein Formular gemacht und damit den Eindruck geweckt, hier wuerde
// etwas ueber einen anderen Menschen ausgebreitet.
//
// EIN LEERES FELD IST KEINE DISKRETION, ES IST EIN AKTENDECKEL. Wer etwas nicht
// sehen darf, bekommt die Zeile GAR NICHT — nicht ihre leere Huelle. Uebrig
// bleibt, was eine Person freiwillig ueber sich gesagt hat:
//
//   Bild-oder-Monogramm · veroeffentlichte Beschreibung · freigegebene
//   Galerie-Bilder · „Nachricht senden"
//
// Alle vier haengen an SERVER-Signalen (self_profile_visible, photos != null,
// /chat/recipients), nicht an einer Rollenabfrage im Client.
// ============================================================================

/// Kopf der Personen-Detailseite: Bild oder Monogramm, Name, Rolle/Status.
///
/// Das PERSONEN-BILD ist die einzige Stelle, an der diese App ueber den
/// Mitglieder-Pfad ueberhaupt ein Gesicht zeigt — und nur, wenn
/// `MemberProfileViewModel.personPhotoKey` es freigibt (Einwilligung bzw.
/// eigene Person). In allen anderen Faellen kommt die Identitaet wie ueberall
/// sonst ueber Monogramm + Farbton.
struct MemberPersonHero: View {
    let member: ClubMember
    /// Medien-Key des freigegebenen Bildes; `nil` ⇒ Monogramm-Kachel.
    let photoKey: String?
    /// Beitragsampel — nur fuer Berechtigte, sonst `nil`.
    var feeStatus: MembersViewModel.FeeStatus?
    var isSelf: Bool = false

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        RSMCard {
            // Ab den Accessibility-Stufen steht das Bild UEBER dem Namen —
            // nebeneinander bliebe fuer den Namen keine Breite mehr.
            let layout = dynamicTypeSize.isAccessibilitySize
                ? AnyLayout(VStackLayout(alignment: .leading, spacing: Theme.Spacing.s4))
                : AnyLayout(HStackLayout(alignment: .top, spacing: Theme.Spacing.s4))

            layout {
                portrait
                VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                    Text(verbatim: member.membersFullName)
                        .font(Theme.Fonts.h2)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                    MembersFlowRow(spacing: Theme.Spacing.s2, lineSpacing: Theme.Spacing.s2) {
                        RSMStatusPill(
                            text: MembersL10n.roleKey(member.role),
                            kind: MembersL10n.roleKind(member.role)
                        )
                        RSMStatusPill(
                            text: MembersL10n.statusKey(member.status),
                            kind: MembersL10n.statusKind(member.status)
                        )
                        if isSelf {
                            RSMStatusPill(text: "members.card.you", kind: .brand)
                        }
                        if let feeStatus {
                            MembersFeePill(status: feeStatus)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    @ViewBuilder
    private var portrait: some View {
        if let photoKey {
            Color.clear
                .frame(width: 72, height: 72)
                .overlay { MediaImage(key: photoKey, placeholderSystemImage: "person.fill") }
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous)
                        .stroke(Theme.Colors.line, lineWidth: 1)
                )
                .accessibilityHidden(true) // der Name steht daneben
        } else {
            RSMMonogramTile(name: member.membersFullName, personId: member.id, size: 72)
        }
    }
}

/// „Das eigene Wort" — Motto, Lieblingsdisziplin, „laeuft seit".
///
/// Erscheint NUR, wenn `self_profile_visible` gilt UND wirklich etwas da ist.
/// Ein Abschnitt mit drei Platzhaltern waere genau der Aktendeckel, den diese
/// Seite loswerden soll.
struct MemberAboutCard: View {
    let items: [MemberProfileViewModel.AboutItem]

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(
                    eyebrow: "members.person.about.eyebrow",
                    title: "members.person.about.title"
                )
                VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                    ForEach(items) { item in
                        row(item)
                    }
                }
            }
        }
    }

    private func row(_ item: MemberProfileViewModel.AboutItem) -> some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s3) {
            Image(systemName: item.systemImage)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Colors.brandInk)
                .frame(width: 30, height: 30)
                .background(Theme.Colors.brandSoft)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(item.labelKey)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                Text(verbatim: item.value)
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
    }
}

/// Freigegebene Galerie-Bilder DIESER Person.
///
/// Die Einwilligung ist hier serverseitig geprueft (0056: `photo_tags` +
/// `app.has_internal_photo_consent`) — anders als bei `avatar_url`. Deshalb
/// duerfen diese Bilder gezeigt werden, wo ein Roster-Foto es nicht darf.
struct MemberGalleryCard: View {
    let photos: [MemberPhoto]

    /// Identifizierbare Huelle fuer `.sheet(item:)`. Bewusst KEINE
    /// `Identifiable`-Konformitaet am Contract-Typ: die generierten Structs
    /// bleiben unangetastet (sie werden neu erzeugt, jede Ergaenzung waere weg).
    private struct OpenedPhoto: Identifiable {
        let photo: MemberPhoto
        var id: String { photo.tagId }
    }

    @State private var openedPhoto: OpenedPhoto?

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(
                    eyebrow: "members.person.gallery.eyebrow",
                    title: "members.person.gallery.title"
                )
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Theme.Spacing.s3) {
                        ForEach(photos, id: \.tagId) { photo in
                            tile(photo)
                        }
                    }
                    .padding(.horizontal, 1) // Rahmen nicht abschneiden
                }
            }
        }
        .sheet(item: $openedPhoto) { opened in
            MemberPhotoSheet(photo: opened.photo)
        }
    }

    private func tile(_ photo: MemberPhoto) -> some View {
        Button {
            openedPhoto = OpenedPhoto(photo: photo)
        } label: {
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                Color.clear
                    .frame(width: 132, height: 132)
                    .overlay {
                        MediaImage(key: photo.thumbnailKey ?? photo.storageKey, contentMode: .fill)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous)
                            .stroke(Theme.Colors.line, lineWidth: 1)
                    )
                Text(verbatim: photo.album ?? photo.title)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .lineLimit(1)
                    .frame(width: 132, alignment: .leading)
            }
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityLabel(Text(verbatim: photo.title))
    }
}

/// Ein Galerie-Bild gross — bewusst schlicht (kein zweiter Lightbox-Pfad mit
/// Teilen/Loeschen; das gehoert in die Galerie und nicht auf eine Personenseite).
struct MemberPhotoSheet: View {
    let photo: MemberPhoto
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                    MediaImage(key: photo.storageKey, contentMode: .fit)
                        .frame(maxWidth: .infinity)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
                    VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                        if let album = photo.album {
                            Text(verbatim: album)
                                .font(Theme.Fonts.eyebrow)
                                .tracking(Theme.Fonts.eyebrowTracking)
                                .textCase(.uppercase)
                                .foregroundStyle(Theme.Colors.inkFaint)
                        }
                        Text(verbatim: photo.title)
                            .font(Theme.Fonts.h3)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                    }
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text("members.person.gallery.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("common.close") { dismiss() }
                }
            }
        }
    }
}
