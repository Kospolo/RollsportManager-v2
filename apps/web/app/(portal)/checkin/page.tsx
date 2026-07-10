import type { Metadata } from "next";
import { CheckinScreen } from "./_components/CheckinScreen";

export const metadata: Metadata = { title: "Check-in" };

export default function CheckinPage() {
  return <CheckinScreen />;
}
