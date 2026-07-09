import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <PlaceholderPage titleKey="navDashboard" subKey="pageDashboardSub" icon="dashboard" showCta={false} />
  );
}
