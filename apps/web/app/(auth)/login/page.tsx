import type { Metadata } from "next";
import { LoginCard } from "./LoginCard";

export const metadata: Metadata = {
  title: "Anmelden",
  description: "Anmeldung zum Vereinsportal von RollsportManager (Demo-Modus).",
};

/** Login außerhalb der Portal-Shell — Demo: jede Eingabe führt zu /dashboard. */
export default function LoginPage() {
  return <LoginCard />;
}
