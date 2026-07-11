import SwiftUI

/// Detail einer Abteilung: Kopf-Karte (Beschreibung + Leitung) und die
/// Mitglieder der Abteilung. Rein lesend. Die Daten kommen aus dem bereits
/// geladenen `DepartmentsViewModel` (Web-Referenz: Mitglieder-Sheet der
/// /(portal)/abteilungen).
struct DepartmentDetailView: View {
    let departmentId: String
    @ObservedObject var viewModel: DepartmentsViewModel

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
                            RSMSectionHeader(
                                eyebrow: "abteilungen.detail.membersEyebrow",
                                title: "abteilungen.members.count \(department.memberIds.count)"
                            )
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
