import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export const metadata: Metadata = { title: "Mitglieder" };

export default function MembersPage() {
  return <PlaceholderPage titleKey="navMembers" subKey="pageMembersSub" icon="members" />;
}
