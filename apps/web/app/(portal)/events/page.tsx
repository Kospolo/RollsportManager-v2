import type { Metadata } from "next";
import { RegionalEventsScreen } from "./_components/RegionalEventsScreen";

export const metadata: Metadata = { title: "Überregionale Events" };

export default function EventsPage() {
  return <RegionalEventsScreen />;
}
