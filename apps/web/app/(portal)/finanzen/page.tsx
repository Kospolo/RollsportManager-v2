import type { Metadata } from "next";
import { FinanceClient } from "./FinanceClient";

export const metadata: Metadata = { title: "Finanzen" };

/**
 * Beiträge & Finanzen — Admin-Screen (Seriositätszone, Mockup Screen 3).
 * Reine Mock-Daten aus lib/mock, alle Interaktionen laufen lokal im Client.
 */
export default function FinancePage() {
  return <FinanceClient />;
}
