import type { Metadata } from "next";
import { PublicRoutineView } from "./_components/PublicRoutineView";

/**
 * Öffentliche Kür-Ansicht `/wettkampf/kuer/[token]` — die EINZIGE login-freie
 * Seite. Der Token kommt aus dem Teilen-Link (createRoutineShare); die Daten
 * lädt der Client über die Facade (getPublicRoutine → publicApiClient OHNE
 * Bearer). Nur minimale, NICHT personenbezogene Kür-Daten werden gezeigt.
 *
 * `robots: noindex` — Token-Links sollen nicht in Suchmaschinen landen.
 */
export const metadata: Metadata = {
  title: "Kür",
  robots: { index: false, follow: false },
};

export default async function PublicRoutinePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicRoutineView token={token} />;
}
