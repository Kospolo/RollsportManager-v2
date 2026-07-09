import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export const metadata: Metadata = { title: "Wettkampf" };

export default function CompetitionPage() {
  return <PlaceholderPage titleKey="navCompetition" subKey="pageCompetitionSub" icon="competition" />;
}
