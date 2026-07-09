import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export const metadata: Metadata = { title: "Termine" };

export default function EventsPage() {
  return <PlaceholderPage titleKey="navEvents" subKey="pageEventsSub" icon="events" />;
}
