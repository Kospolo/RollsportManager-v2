import type { Metadata } from "next";
import { VereinSettingsClient } from "./VereinSettingsClient";

export const metadata: Metadata = { title: "Vereins-Einstellungen" };

export default function VereinSettingsPage() {
  return <VereinSettingsClient />;
}
