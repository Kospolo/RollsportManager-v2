import type { Metadata } from "next";
import { BudgetClient } from "./BudgetClient";

export const metadata: Metadata = { title: "Budget" };

/**
 * Budgetplanung /finanzen/budget (Seriositätszone) — Jahres-Plan gegen Ist je
 * Kategorie mit Abweichungs-Ampel. Daten kommen ausschließlich über die Facade
 * (lib/data, mock|api). Sichtbarkeit nur für can_manage_finance; die
 * verbindliche Durchsetzung bleibt serverseitig (RLS + DB-Check).
 */
export default function BudgetPage() {
  return <BudgetClient />;
}
