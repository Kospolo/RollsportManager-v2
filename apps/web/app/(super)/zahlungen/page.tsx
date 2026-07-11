import type { Metadata } from "next";
import { ZahlungenClient } from "./ZahlungenClient";

export const metadata: Metadata = { title: "Zahlungen" };

export default function ZahlungenPage() {
  return <ZahlungenClient />;
}
