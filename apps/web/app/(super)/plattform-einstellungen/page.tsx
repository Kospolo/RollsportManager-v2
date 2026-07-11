import type { Metadata } from "next";
import { EinstellungenClient } from "./EinstellungenClient";

export const metadata: Metadata = { title: "Einstellungen" };

export default function PlatformSettingsPage() {
  return <EinstellungenClient />;
}
