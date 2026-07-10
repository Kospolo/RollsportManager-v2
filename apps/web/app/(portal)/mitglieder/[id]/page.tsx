import type { Metadata } from "next";
import { data, fullName } from "@/lib/data";
import { MemberDetail } from "./MemberDetail";

/**
 * Mitglieder-Profil /mitglieder/[id] — Daten kommen ausschließlich über
 * die Facade (lib/data); die Interaktivität lebt im Client (MemberDetail).
 * Der Titel ist Best-Effort: im api-Modus läuft der Server-Aufruf ohne
 * Dev-Token, dann fällt er still auf „Mitglied" zurück.
 */

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const member = await data.getMemberById(id);
    return { title: member ? fullName(member) : "Mitglied" };
  } catch {
    return { title: "Mitglied" };
  }
}

export default async function MemberDetailPage({ params }: Props) {
  const { id } = await params;
  return <MemberDetail id={id} />;
}
