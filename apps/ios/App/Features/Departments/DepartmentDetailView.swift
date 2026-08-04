import SwiftUI

/// Detail einer Abteilung: Kopf-Karte (Beschreibung + Leitung) und die
/// Mitglieder der Abteilung. Rein lesend. Die Daten kommen aus dem bereits
/// geladenen `DepartmentsViewModel` (Web-Referenz: Mitglieder-Sheet der
/// /(portal)/abteilungen).
struct DepartmentDetailView: View {
    let departmentId: String
    @ObservedObject var viewModel: DepartmentsViewModel

    @EnvironmentObject private var session: SessionStore
    @Environment(\.dismiss) private var dismiss
    @State private var route: DepartmentSheetRoute?
    @State private var departmentToDelete: Department?

    /// Vereins-Admins verwalten die Abteilung (bearbeiten/löschen/Mitglieder).
    private var canManage: Bool { session.permissions.isClubAdmin }

    var body: some View {
        ScrollView {
            if let department = viewModel.department(id: departmentId) {
                VStack(spacing: Theme.Spacing.cardGap) {
                    if hasHeaderContent(department) {
                        RSMCard {
                            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                                if let description = department.description, !description.isEmpty {
                                    Text(verbatim: description)
                                        .font(Theme.Fonts.body)
                                        .foregroundStyle(Theme.Colors.inkSoft)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                                DepartmentLeadRow(lead: viewModel.lead(for: department))
                            }
                        }
                    }

                    RSMCard {
                        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                            HStack(alignment: .firstTextBaseline) {
                                RSMSectionHeader(
                                    eyebrow: "abteilungen.detail.membersEyebrow",
                                    title: "abteilungen.members.count \(department.memberIds.count)"
                                )
                                if canManage {
                                    Spacer(minLength: Theme.Spacing.s2)
                                    Button {
                                        route = .members(department)
                                    } label: {
                                        Text(verbatim: "Verwalten")
                                            .font(Theme.Fonts.caption.weight(.semibold))
                                            .foregroundStyle(Theme.Colors.brandInk)
                                    }
                                    .accessibilityLabel(Text(verbatim: "Mitglieder verwalten"))
                                }
                            }
                            membersBody(for: department)
                        }
                    }
                }
                .padding(Theme.Spacing.s5)
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text(verbatim: viewModel.department(id: departmentId)?.name ?? ""))
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            if canManage, let department = viewModel.department(id: departmentId) {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            route = .edit(department)
                        } label: {
                            Label {
                                Text(verbatim: "Bearbeiten")
                            } icon: {
                                Image(systemName: "pencil")
                            }
                        }
                        Button {
                            route = .members(department)
                        } label: {
                            Label {
                                Text(verbatim: "Mitglieder verwalten")
                            } icon: {
                                Image(systemName: "person.2")
                            }
                        }
                        Button(role: .destructive) {
                            departmentToDelete = department
                        } label: {
                            Label {
                                Text(verbatim: "Löschen")
                            } icon: {
                                Image(systemName: "trash")
                            }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                    .tint(Theme.Colors.brand)
                    .accessibilityLabel(Text(verbatim: "Abteilung verwalten"))
                }
            }
        }
        .sheet(item: $route) { route in
            sheet(for: route)
        }
        .confirmationDialog(
            Text(verbatim: "Abteilung löschen?"),
            isPresented: deleteConfirmBinding,
            titleVisibility: .visible,
            presenting: departmentToDelete
        ) { department in
            Button(role: .destructive) {
                _Concurrency.Task {
                    if await viewModel.delete(department, api: session.api) { dismiss() }
                }
            } label: {
                Text(verbatim: "Löschen")
            }
            Button(role: .cancel) { } label: { Text(verbatim: "Abbrechen") }
        } message: { department in
            Text(verbatim: "„\(department.name)“ wird entfernt. Die Mitglieder bleiben im Verein.")
        }
    }

    // MARK: - Sheets

    @ViewBuilder
    private func sheet(for route: DepartmentSheetRoute) -> some View {
        switch route {
        case .create:
            // Im Detail nicht erreichbar — der Vollständigkeit halber.
            DepartmentFormSheet(
                mode: .create,
                members: viewModel.allMembers,
                api: session.api,
                clubId: session.clubId,
                onSaved: { viewModel.upsert($0) }
            )
        case .edit(let department):
            DepartmentFormSheet(
                mode: .edit(department),
                members: viewModel.allMembers,
                api: session.api,
                clubId: session.clubId,
                onSaved: { viewModel.upsert($0) }
            )
        case .members(let department):
            DepartmentMembersSheet(
                department: department,
                members: viewModel.allMembers,
                api: session.api,
                onSaved: { viewModel.upsert($0) }
            )
        }
    }

    private var deleteConfirmBinding: Binding<Bool> {
        Binding(
            get: { departmentToDelete != nil },
            set: { if !$0 { departmentToDelete = nil } }
        )
    }

    /// Kopf-Karte nur zeigen, wenn es Beschreibung ODER eine (auflösbare)
    /// Leitung gibt — sonst wäre sie leer.
    private func hasHeaderContent(_ department: Department) -> Bool {
        if let description = department.description, !description.isEmpty { return true }
        return department.leadMemberId != nil
    }

    @ViewBuilder
    private func membersBody(for department: Department) -> some View {
        let roster = viewModel.roster(for: department)
        if !roster.isEmpty {
            VStack(spacing: 0) {
                ForEach(roster, id: \.id) { member in
                    DepartmentMemberRow(member: member)
                    if member.id != roster.last?.id {
                        Divider().overlay(Theme.Colors.line)
                    }
                }
            }
        } else if department.memberIds.isEmpty {
            // Wirklich leer.
            Text("abteilungen.detail.membersEmpty")
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkSoft)
                .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            // Es gibt Mitglieder, aber die Stammdaten sind für die Rolle nicht
            // sichtbar (RLS) — Zahl steht im Kopf, Namen fehlen bewusst.
            Text("abteilungen.detail.membersUnavailable")
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkSoft)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
