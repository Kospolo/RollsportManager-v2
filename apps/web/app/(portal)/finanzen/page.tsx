import type { Metadata } from "next";
import { FinanceClient } from "./FinanceClient";

export const metadata: Metadata = { title: "Finanzen" };

/**
 * Beiträge & Finanzen — Admin-Screen (Seriositätszone, Mockup Screen 3).
 * Daten kommen über die Facade (lib/data, mock|api via NEXT_PUBLIC_DATA_SOURCE);
 * die Interaktionen laufen weiterhin optimistisch lokal im Client.
 */
export default function FinancePage() {
  return <FinanceClient />;
}
