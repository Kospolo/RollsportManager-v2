import SwiftUI

// ============================================================================
// Interne Trainer-Notizen im Mitglieder-Detail.
// Web-Referenz: apps/web/app/(portal)/mitglieder/[id]/CoachNoteSheet.tsx
//
// ### DIE KARTE ERSCHEINT NICHT FÜR JEDE ROLLE — UND NIE ÜBER SICH SELBST ###
// Client-seitig wird sie nur dem Trainerstab und der Vereinsleitung gezeigt
// und über die EIGENE Person gar nicht. Das ist Menüführung, kein Schutz: die
// verbindliche Regel steht in `app.can_read_coach_note` (0069) und beginnt mit
// `not app.can_act_for_member(...)` — betroffene Person und Eltern sind IMMER
// aussen vor, auch wenn sie Vorstand sind.
//
// ### WARUM DIE KARTE ANSAGT, WER MITLIEST ###
// Wer hier schreibt, muss ohne Nachdenken wissen, dass Kind und Eltern das
// NICHT lesen — und dass die Vereinsleitung es sehr wohl kann. Ein Satz über
// dem Eingabefeld ist billiger als eine Notiz, die im falschen Ton verfasst
// wurde, weil jemand ein anderes Publikum vermutet hat.
// ============================================================================

struct CoachNotesSection: View {
    let member: ClubMember
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = CoachNotesViewModel()

    @State private var draft = ""
    @State private var isComposing = false
    @State private var editing: MemberCoachNote?
    @State private var pendingDeletion: MemberCoachNote?

    private var myMemberId: String? { session.session?.profile.memberId }

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(
                    eyebrow: "members.coachNotes.eyebrow",
                    title: "members.coachNotes.title"
                )
                confidentialityNote
                content
                if !isComposing {
                    RSMSecondaryButton(title: "members.coachNotes.add") {
                        draft = ""
                        editing = nil
                        withAnimation(.easeOut(duration: Theme.Motion.fast)) { isComposing = true }
                    }
                }
            }
        }
        .task {
            await model.loadIfNeeded(
                api: session.api,
                clubId: session.clubId,
                memberId: member.id
            )
        }
        .sheet(isPresented: $isComposing) {
            CoachNoteEditor(
                title: editing == nil
                    ? "members.coachNotes.editor.newTitle"
                    : "members.coachNotes.editor.editTitle",
                memberName: member.membersFullName,
                text: $draft,
                isSaving: model.isSaving
            ) {
                _Concurrency.Task {
                    let ok: Bool
                    if let editing {
                        ok = await model.update(note: editing, body: draft, api: session.api)
                    } else {
                        ok = await model.add(
                            body: draft,
                            api: session.api,
                            clubId: session.clubId,
                            memberId: member.id
                        )
                    }
                    if ok {
                        isComposing = false
                        editing = nil
                        draft = ""
                    }
                }
            } onCancel: {
                isComposing = false
                editing = nil
                draft = ""
            }
        }
        .alert(
            "members.coachNotes.error.title",
            isPresented: Binding(
                get: { model.actionError != nil },
                set: { if !$0 { model.actionError = nil } }
            ),
            presenting: model.actionError
        ) { _ in
            Button("members.alert.ok", role: .cancel) {}
        } message: { message in
            Text(verbatim: message)
        }
        .confirmationDialog(
            "members.coachNotes.delete.confirm",
            isPresented: Binding(
                get: { pendingDeletion != nil },
                set: { if !$0 { pendingDeletion = nil } }
            ),
            presenting: pendingDeletion
        ) { note in
            Button("members.coachNotes.delete.action", role: .destructive) {
                _Concurrency.Task { await model.delete(note: note, api: session.api) }
            }
            Button("members.coachNotes.delete.cancel", role: .cancel) {}
        }
    }

    // MARK: - Bausteine

    /// Wer liest mit — der Satz, der die Tonlage der Notiz bestimmt.
    private var confidentialityNote: some View {
        Label("members.coachNotes.confidential", systemImage: "eye.slash.fill")
            .font(Theme.Fonts.caption)
            .foregroundStyle(Theme.Colors.inkSoft)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Theme.Spacing.s3)
            .background(Theme.Colors.bgSunken)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
            .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var content: some View {
        switch model.state {
        case .loading:
            ProgressView()
                .tint(Theme.Colors.brand)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Theme.Spacing.s4)
        case .failed(let message):
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                Text(verbatim: message)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.danger)
                    .fixedSize(horizontal: false, vertical: true)
                RSMSecondaryButton(title: "routines.common.retry") {
                    _Concurrency.Task {
                        await model.load(
                            api: session.api,
                            clubId: session.clubId,
                            memberId: member.id
                        )
                    }
                }
            }
        case .loaded(let notes):
            if notes.isEmpty {
                Text("members.coachNotes.empty")
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                VStack(spacing: Theme.Spacing.s3) {
                    ForEach(notes, id: \.id) { note in
                        noteRow(note)
                    }
                }
            }
        }
    }

    private func noteRow(_ note: MemberCoachNote) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text(verbatim: note.body)
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkPrimary)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: Theme.Spacing.s3) {
                PlatformFormat.dateTime(note.createdAt)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkFaint)
                if note.updatedAt != note.createdAt {
                    Text("members.coachNotes.edited")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkFaint)
                }
                Spacer(minLength: 0)
                if isMine(note) {
                    Button {
                        draft = note.body
                        editing = note
                        isComposing = true
                    } label: {
                        Image(systemName: "square.and.pencil")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.Colors.brandInk)
                    }
                    .buttonStyle(.plain)
                    .frame(width: Theme.Size.touchTarget, height: Theme.Size.touchTarget)
                    .accessibilityLabel(Text("members.coachNotes.edit.a11y"))

                    Button {
                        pendingDeletion = note
                    } label: {
                        Image(systemName: "trash")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.Colors.danger)
                    }
                    .buttonStyle(.plain)
                    .frame(width: Theme.Size.touchTarget, height: Theme.Size.touchTarget)
                    .accessibilityLabel(Text("members.coachNotes.delete.a11y"))
                }
            }
        }
        .padding(Theme.Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Colors.bgSunken)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
    }

    /// Ändern/Löschen zeigt die App der Autor:in. Die Vereinsleitung darf es
    /// serverseitig ebenfalls (`coach_notes:manage`) — sie bekommt die Knöpfe
    /// hier bewusst nicht: eine fremde Notiz umzuschreiben ist kein Handgriff,
    /// den man nebenbei im Vorbeigehen macht.
    private func isMine(_ note: MemberCoachNote) -> Bool {
        note.authorMemberId == myMemberId
    }
}

/// Eingabeblatt für eine Notiz — eigenes Sheet statt Inline-Feld, damit der
/// Text Platz hat und die Tastatur nichts verdeckt.
struct CoachNoteEditor: View {
    let title: LocalizedStringKey
    let memberName: String
    @Binding var text: String
    let isSaving: Bool
    let onSave: () -> Void
    let onCancel: () -> Void

    @FocusState private var isFocused: Bool

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                Text("members.coachNotes.editor.about \(memberName)")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)

                TextEditor(text: $text)
                    .focused($isFocused)
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .scrollContentBackground(.hidden)
                    .padding(Theme.Spacing.s3)
                    .background(Theme.Colors.bgSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous)
                            .stroke(Theme.Colors.line, lineWidth: 1)
                    )
                    .frame(minHeight: 180)
                    .accessibilityLabel(Text("members.coachNotes.editor.a11y"))

                Label("members.coachNotes.confidential", systemImage: "eye.slash.fill")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)

                Spacer(minLength: 0)
            }
            .padding(Theme.Spacing.s5)
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text(title))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("members.coachNotes.editor.cancel", action: onCancel)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    if isSaving {
                        ProgressView()
                    } else {
                        Button("members.coachNotes.editor.save", action: onSave)
                            .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
            }
            .onAppear { isFocused = true }
        }
    }
}
