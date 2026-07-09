import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export const metadata: Metadata = { title: "Finanzen" };

export default function FinancePage() {
  return <PlaceholderPage titleKey="navFinance" subKey="pageFinanceSub" icon="finance" />;
}
