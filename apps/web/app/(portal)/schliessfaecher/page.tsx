import type { Metadata } from "next";
import { LockersScreen } from "./_components/LockersScreen";

export const metadata: Metadata = { title: "Schließfächer" };

export default function SchliessfaecherPage() {
  return <LockersScreen />;
}
