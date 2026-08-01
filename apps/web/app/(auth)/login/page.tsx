import type { Metadata } from "next";
import { DATA_SOURCE } from "@/lib/data/config";
import { LoginCard } from "./LoginCard";
import { AccountLoginCard } from "./AccountLoginCard";

export const metadata: Metadata = {
  title: "Anmelden",
  description: "Anmeldung zum Vereinsportal von RollsportManager.",
};

/**
 * Login außerhalb der Portal-Shell.
 * mock-Modus (Default): Demo — jede Eingabe führt zu /dashboard.
 * api-Modus: echte Anmeldung mit E-Mail/Passwort (AccountLoginCard). Die
 * Dev-Personas sind dort nur ausserhalb von Produktion als Abkuerzung
 * erreichbar — in production-api niemals.
 */
export default function LoginPage() {
  return DATA_SOURCE === "api" ? <AccountLoginCard /> : <LoginCard />;
}
