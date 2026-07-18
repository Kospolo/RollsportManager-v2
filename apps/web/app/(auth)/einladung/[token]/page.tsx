import type { Metadata } from "next";
import { AcceptInvitationCard } from "./AcceptInvitationCard";

/**
 * Annahme einer E-Mail-Einladung `/einladung/[token]`.
 *
 * Der Token kommt aus dem Annahme-Link der Einladungs-Mail. Die Vorschau
 * (Vereinsname + Rolle) laedt der Client oeffentlich (getInvitation ->
 * GET /public/invitations/{token}, ohne Bearer). Die ANNAHME selbst braucht ein
 * Konto — die Mitgliedschaft gehoert zur angemeldeten Person.
 *
 * `robots: noindex` — Token-Links gehoeren nicht in Suchmaschinen.
 */
export const metadata: Metadata = {
  title: "Einladung annehmen",
  description: "Eine Vereins-Einladung annehmen.",
  robots: { index: false, follow: false },
};

export default async function EinladungPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <AcceptInvitationCard token={token} />;
}
