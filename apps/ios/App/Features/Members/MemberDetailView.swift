import SwiftUI

// ============================================================================
// Die Detailseite EINER Person — in ZWEI Gestalten, entschieden vom SERVER.
//
//   PERSONEN-KARTE   Was ein Mitglied von einem anderen Menschen sieht:
//                    Bild-oder-Monogramm · veroeffentlichte Beschreibung ·
//                    freigegebene Galerie-Bilder · „Nachricht senden".
//                    KEINE Stammdaten, KEINE leeren Felder, KEIN
//                    „Nicht hinterlegt" — was nicht gezeigt werden darf,
//                    bekommt keine Zeile, nicht ihre leere Huelle.
//
//   VERWALTUNGSSICHT Zusaetzlich Stammdaten/Kontakt · Sparten · Familie ·
//                    Trainer-Notizen · Rollenwechsel — fuer die, die das
//                    duerfen (Vorstand, Trainerstab des Teams, Eltern, man
//                    selbst).
//
// WAS DIE GESTALT ENTSCHEIDET, IST NICHT DIE ROLLE IM CLIENT, SONDERN DIE
// ANTWORT DES SERVERS: `GET …/members/{id}/profile` liefert die Flags
// contact_visible / admin_contact_visible / joined_on_visible /
// self_profile_visible und setzt Sektionen, die man nicht sehen darf, auf
// `null`. `MemberProfileViewModel` leitet daraus ab, mehr passiert hier nicht.
//
// SICHERE VORGABE: solange nichts geladen ist — oder der Aufruf scheitert —
// gilt die Personen-Karte. Ein Netzfehler darf nie MEHR zeigen als erlaubt.
//
// Der Rollenwechsel (PATCH …/role) laeuft weiter optimistisch mit Rollback:
// 403 → Alert „Keine Berechtigung", alles andere → Klartext-Alert.
// ============================================================================
struct MemberDetailView: View {
    let memberId: String
    @ObservedObject var viewModel: MembersViewModel
    @EnvironmentObject private var session: SessionStore
    @StateObject private var profileModel = MemberProfileViewModel()

    var body: some View {
        ScrollView {
            if let member = viewModel.member(id: memberId) {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    MemberPersonHero(
                        member: member,
                        photoKey: profileModel.personPhotoKey(isSelf: isSelf(member)),
                        feeStatus: profileModel.showsAdministrativeSections
                            ? viewModel.feeStatus(for: member)
                            : nil,
                        isSelf: isSelf(member)
                    )

                    // --- Was die Person selbst ueber sich sagt ----------------
                    if !profileModel.aboutItems.isEmpty {
                        MemberAboutCard(items: profileModel.aboutItems)
                    }
                    if !profileModel.consentedPhotos.isEmpty {
                        MemberGalleryCard(photos: profileModel.consentedPhotos)
                    }
                    if profileModel.mayMessage == true, !isSelf(member) {
                        messageLink(member)
                    }

                    // --- Verwaltungssicht -----------------------------------
                    if profileModel.showsAdministrativeSections {
                        if !masterDataRows(member).isEmpty {
                            masterDataCard(member)
                        }
                        MemberSpartenCard(memberId: member.id, memberName: member.membersFullName)
                        familyCard(member)
                    }
                    // Interne Trainer-Notizen: nur Trainerstab/Leitung, und
                    // NIE ueber die eigene Person. Der Server entscheidet
                    // verbindlich (0069) — hier wird nur ehrlich eingeblendet.
                    if showsCoachNotes(member) {
                        CoachNotesSection(member: member)
                    }
                    if viewerIsBoard { roleCard(member) }

                    // Erklaert der Person, WARUM hier so wenig steht — statt
                    // sie raten zu lassen, ob die App kaputt ist.
                    if !profileModel.showsAdministrativeSections {
                        privacyNote
                    }
                }
                .padding(Theme.Spacing.s5)
            } else {
                RSMCard {
                    RSMEmptyState(
                        systemImage: "person.crop.circle.badge.questionmark",
                        title: "members.empty.title",
                        message: "members.empty.message"
                    )
                }
                .padding(Theme.Spacing.s5)
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text(verbatim: viewModel.member(id: memberId)?.membersFullName ?? ""))
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await profileModel.loadIfNeeded(
                memberId: memberId,
                api: session.api,
                clubId: session.clubId
            )
        }
        .alert(
            alertTitleKey,
            isPresented: Binding(
                get: { viewModel.roleChangeFailure != nil },
                set: { if !$0 { viewModel.roleChangeFailure = nil } }
            ),
            presenting: viewModel.roleChangeFailure
        ) { _ in
            Button("members.alert.ok", role: .cancel) {}
        } message: { failure in
            switch failure {
            case .forbidden:
                Text("members.roleChange.forbidden.message")
            case .other(let message):
                Text(verbatim: message)
            }
        }
    }

    // MARK: - Sichtbarkeiten

    /// Vorstand/Admin duerfen Rollen aendern — alle anderen sehen die Karte nicht.
    private var viewerIsBoard: Bool {
        let role = session.session?.profile.clubRole
        return role == .owner || role == .admin
    }

    /// „Nie sich selbst" (API-Regel) — fuer die eigene Person nur ein Hinweis.
    private func isSelf(_ member: ClubMember) -> Bool {
        session.session?.profile.memberId == member.id
    }

    /// Zeigt die Karte fuer interne Trainer-Notizen? Trainerstab oder Leitung —
    /// und nie ueber die eigene Person. Die Familie ist damit hier gar nicht
    /// erst adressiert; serverseitig schliesst `not app.can_act_for_member`
    /// sie ohnehin aus, auch wenn sie zugleich Vorstand ist.
    private func showsCoachNotes(_ member: ClubMember) -> Bool {
        let perms = session.permissions
        return (perms.isTrainer || perms.isClubAdmin) && !isSelf(member)
    }

    private var alertTitleKey: LocalizedStringKey {
        if case .forbidden = viewModel.roleChangeFailure {
            return "members.roleChange.forbidden.title"
        }
        return "members.roleChange.error.title"
    }

    // MARK: - Nachricht senden

    /// Fuehrt in den vorhandenen Direkt-Thread. Der Kanal wird hier gebaut, weil
    /// er ohne erste Nachricht noch gar nicht existiert — `ChatThreadView`
    /// braucht nur `channel_type` + `peer_member_id`, alles Weitere holt sie.
    private func messageLink(_ member: ClubMember) -> some View {
        NavigationLink {
            ChatThreadView(
                channel: ChatChannel(
                    channelType: .direct,
                    peerMemberId: member.id,
                    peerName: member.membersFullName
                ),
                api: session.api,
                clubId: session.clubId,
                myMemberId: session.session?.profile.memberId ?? "",
                namesById: [member.id: member.membersFullName]
            )
        } label: {
            Label("members.person.message", systemImage: "paperplane.fill")
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.brandContrast)
                .frame(maxWidth: .infinity, minHeight: Theme.Size.touchTarget)
                .background(Theme.Colors.brand)
                .clipShape(Capsule())
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityLabel(Text("members.person.message.a11y \(member.membersFullName)"))
    }

    /// Der ehrliche Satz zur schmalen Seite: hier steht wenig, WEIL der Verein
    /// die Daten seiner Mitglieder nicht an alle austeilt.
    private var privacyNote: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s3) {
            Image(systemName: "hand.raised.fill")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Colors.inkFaint)
                .accessibilityHidden(true)
            Text("members.person.privacyNote")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Stammdaten (nur Verwaltungssicht)

    /// Eine Stammdaten-Zeile — Beschriftung + Wert.
    private struct MasterRow: Identifiable {
        let id: String
        let label: LocalizedStringKey
        let value: Text
    }

    /// NUR die Zeilen, die der/die Betrachter:in laut Server sehen DARF.
    ///
    /// Der Unterschied, um den es geht: „darf ich nicht sehen" ⇒ die Zeile
    /// existiert nicht. „darf ich sehen, ist aber leer" ⇒ „Nicht hinterlegt" —
    /// das ist fuer Verwaltende eine Auskunft („da fehlt was"), kein Aktendeckel.
    private func masterDataRows(_ member: ClubMember) -> [MasterRow] {
        var rows: [MasterRow] = []
        if profileModel.showsContactFields {
            rows.append(MasterRow(
                id: "email",
                label: "members.detail.email",
                value: optionalText(member.email)
            ))
            rows.append(MasterRow(
                id: "birthDate",
                label: "members.detail.birthDate",
                value: optionalText(member.birthDate.map(MembersFormat.day))
            ))
        }
        if profileModel.showsAdminContactFields {
            if let phone = member.phone, !phone.isEmpty {
                rows.append(MasterRow(
                    id: "phone",
                    label: "members.detail.phone",
                    value: Text(verbatim: phone)
                ))
            }
            if let address = member.postalAddress, !address.isEmpty {
                rows.append(MasterRow(
                    id: "address",
                    label: "members.detail.address",
                    value: Text(verbatim: address)
                ))
            }
        }
        if profileModel.showsJoinedOn {
            rows.append(MasterRow(
                id: "joinedOn",
                label: "members.detail.joinedOn",
                value: optionalText(member.joinedOn.map(MembersFormat.day))
            ))
        }
        rows.append(MasterRow(
            id: "teams",
            label: "members.detail.teams",
            value: viewModel.teamNames(for: member).map { Text(verbatim: $0) }
                ?? Text("members.row.noTeam")
        ))
        return rows
    }

    private func masterDataCard(_ member: ClubMember) -> some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(
                    eyebrow: "members.detail.master.eyebrow",
                    title: "members.detail.master.title"
                )
                VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                    ForEach(masterDataRows(member)) { row in
                        MembersDetailRow(label: row.label, value: row.value)
                    }
                }
            }
        }
    }

    private func optionalText(_ value: String?) -> Text {
        value.map { Text(verbatim: $0) } ?? Text("members.detail.none")
    }

    // MARK: - Familie (nur Verwaltungssicht)

    private func familyCard(_ member: ClubMember) -> some View {
        let links = viewModel.familyLinks(of: member)
        return RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(
                    eyebrow: "members.detail.family.eyebrow",
                    title: "members.detail.family.title"
                )
                if links.isEmpty {
                    RSMEmptyState(
                        systemImage: "figure.2.and.child.holdinghands",
                        title: "members.family.empty.title",
                        message: viewerIsBoard
                            ? "members.family.emptyAdmin.message"
                            : "members.family.emptyOwn.message"
                    )
                } else {
                    VStack(spacing: 0) {
                        ForEach(links) { link in
                            familyRow(link)
                            if link.id != links.last?.id {
                                Divider().overlay(Theme.Colors.line)
                            }
                        }
                    }
                }
            }
        }
    }

    private func familyRow(_ link: MembersViewModel.FamilyLink) -> some View {
        NavigationLink {
            MemberDetailView(memberId: link.other.id, viewModel: viewModel)
        } label: {
            HStack(spacing: Theme.Spacing.s3) {
                RSMAvatarView(name: link.other.membersFullName, personId: link.other.id, size: 36)
                VStack(alignment: .leading, spacing: 2) {
                    Text(verbatim: link.other.membersFullName)
                        .font(Theme.Fonts.bodyStrong)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                        .lineLimit(1)
                    // Beziehungscode gehoert zur erziehungsberechtigten Seite.
                    if link.otherIs == .guardian {
                        MembersL10n.relationText(link.relation)
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkSoft)
                    }
                }
                Spacer(minLength: Theme.Spacing.s2)
                RSMStatusPill(
                    text: link.otherIs == .child
                        ? "members.family.childPill"
                        : "members.family.guardianPill",
                    kind: .info
                )
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Colors.inkFaint)
                    .accessibilityHidden(true)
            }
            .frame(minHeight: Theme.Size.listRow)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text("members.row.a11y \(link.other.membersFullName)"))
    }

    // MARK: - Rolle aendern (nur Vorstand/Admin)

    private func roleCard(_ member: ClubMember) -> some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(
                    eyebrow: "members.detail.role.eyebrow",
                    title: "members.detail.role.title"
                )
                if isSelf(member) {
                    Text("members.roleChange.self")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                } else {
                    roleMenu(member)
                    if member.role == .owner {
                        Text("members.roleChange.ownerHint")
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkSoft)
                    }
                }
            }
        }
    }

    private func roleMenu(_ member: ClubMember) -> some View {
        Menu {
            ForEach(AssignableClubRole.allCases, id: \.rawValue) { role in
                Button {
                    _Concurrency.Task {
                        await viewModel.changeRole(
                            of: member,
                            to: role,
                            api: session.api,
                            clubId: session.clubId
                        )
                    }
                } label: {
                    if role.rawValue == member.role.rawValue {
                        Label(MembersL10n.roleKey(role), systemImage: "checkmark")
                    } else {
                        Text(MembersL10n.roleKey(role))
                    }
                }
            }
        } label: {
            HStack(spacing: Theme.Spacing.s2) {
                if viewModel.isChangingRole {
                    ProgressView()
                        .tint(Theme.Colors.brandInk)
                }
                Text("members.roleChange.menu")
                    .font(Theme.Fonts.bodyStrong)
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 12, weight: .semibold))
                    .accessibilityHidden(true)
            }
            .foregroundStyle(Theme.Colors.brandInk)
            .padding(.horizontal, Theme.Spacing.s4)
            .frame(minHeight: Theme.Size.touchTarget)
            .background(Theme.Colors.brandSoft)
            .clipShape(Capsule())
        }
        .disabled(viewModel.isChangingRole)
        .accessibilityLabel(Text("members.roleChange.a11y"))
    }
}
