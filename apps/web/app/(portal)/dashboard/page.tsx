import type { Metadata } from "next";
import { DashboardClient } from "./_components/DashboardClient";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Trainer-Dashboard — Startseite des Portals (app/page.tsx leitet
 * bereits per redirect auf /dashboard). Daten: ausschließlich über
 * die Daten-Facade lib/data (Mock oder api, siehe MIGRATION.md).
 */
export default function DashboardPage() {
  return <DashboardClient />;
}
