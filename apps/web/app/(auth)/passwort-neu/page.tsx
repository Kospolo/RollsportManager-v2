import type { Metadata } from "next";
import { PasswordResetCard } from "./PasswordResetCard";

export const metadata: Metadata = {
  title: "Passwort zurücksetzen",
  description: "Neues Passwort für dein RollsportManager-Konto setzen.",
  robots: { index: false, follow: false },
};

/**
 * Passwort-Seite. Der Token kommt als ?token= aus dem Link der Reset-E-Mail
 * (${APP_BASE_URL}/passwort-neu?token=...). Wir lesen ihn serverseitig aus
 * searchParams und reichen ihn an die Karte — kein useSearchParams, damit die
 * Seite ohne Suspense-Grenze rendert.
 *
 * MIT Token -> neues Passwort setzen. OHNE Token -> Link anfordern.
 */
export default async function PasswortNeuPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = params.token;
  const token = Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
  return <PasswordResetCard token={token} />;
}
