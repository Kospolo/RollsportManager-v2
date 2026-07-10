import type { Metadata } from "next";
import { TermineScreen } from "./_components/TermineScreen";

export const metadata: Metadata = { title: "Termine" };

export default function EventsPage() {
  return <TermineScreen />;
}
