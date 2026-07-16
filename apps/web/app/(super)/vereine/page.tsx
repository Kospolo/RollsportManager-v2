import type { Metadata } from "next";
import { VereineClient } from "./VereineClient";

export const metadata: Metadata = { title: "Vereine & Nutzer" };

export default function VereinePage() {
  return <VereineClient />;
}
