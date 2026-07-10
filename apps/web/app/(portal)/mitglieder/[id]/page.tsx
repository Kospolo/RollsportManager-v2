import type { Metadata } from "next";
import { fullName, memberById } from "@/lib/mock";
import { MemberDetail } from "./MemberDetail";

/**
 * Mitglieder-Profil /mitglieder/[id] — Daten kommen ausschließlich aus
 * lib/mock; die Interaktivität lebt im Client (MemberDetail).
 */

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const member = memberById(id);
  return { title: member ? fullName(member) : "Mitglied" };
}

export default async function MemberDetailPage({ params }: Props) {
  const { id } = await params;
  return <MemberDetail id={id} />;
}
