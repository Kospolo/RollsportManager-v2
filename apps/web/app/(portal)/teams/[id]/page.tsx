import type { Metadata } from "next";
import { data } from "@/lib/data";
import { TeamDetail } from "./TeamDetail";

/**
 * Team-Detailseite /teams/[id] — Daten kommen ausschließlich über die Facade
 * (lib/data); die Interaktivität lebt im Client (TeamDetail). Rein lesend:
 * Kopf, Trainerstab und der ganze Kader als klickbare Karten ins 360-Profil.
 *
 * Der Titel ist Best-Effort: im api-Modus läuft der Server-Aufruf ohne
 * Dev-Token, dann fällt er still auf „Team" zurück.
 */

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const teams = await data.getTeams();
    const team = teams.find((candidate) => candidate.id === id);
    return { title: team ? team.name : "Team" };
  } catch {
    return { title: "Team" };
  }
}

export default async function TeamDetailPage({ params }: Props) {
  const { id } = await params;
  return <TeamDetail id={id} />;
}
