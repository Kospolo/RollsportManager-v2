import type { Metadata } from "next";
import { RoutineDetail } from "./_components/RoutineDetail";

/**
 * Kür-Detail /kueren/[id] — die Daten kommen client-seitig aus der
 * Daten-Facade (lib/data). Server-seitig gibt es keine Datenquelle mehr
 * (keine Mock-Direktimporte), daher: statischer Titel, kein
 * generateStaticParams; „nicht gefunden" rendert der Client als EmptyState.
 */

export const metadata: Metadata = { title: "Küren" };

export default async function RoutineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RoutineDetail routineId={id} />;
}
