import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export const metadata: Metadata = { title: "Küren" };

export default function RoutinesPage() {
  return <PlaceholderPage titleKey="navRoutines" subKey="pageRoutinesSub" icon="routines" />;
}
