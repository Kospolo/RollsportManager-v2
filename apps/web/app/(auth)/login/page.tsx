import type { Metadata } from "next";
import { DATA_SOURCE } from "@/lib/data/config";
import { LoginCard } from "./LoginCard";
import { DevLoginCard } from "./DevLoginCard";

export const metadata: Metadata = {
  title: "Anmelden",
  description: "Anmeldung zum Vereinsportal von RollsportManager (Demo-Modus).",
};

/**
 * Login außerhalb der Portal-Shell.
 * mock-Modus (Default): Demo — jede Eingabe führt zu /dashboard.
 * api-Modus (nur Dev): echter Dev-Login über Persona-Karten gegen den
 * lokalen Stack (POST /dev/login).
 */
export default function LoginPage() {
  return DATA_SOURCE === "api" ? <DevLoginCard /> : <LoginCard />;
}
