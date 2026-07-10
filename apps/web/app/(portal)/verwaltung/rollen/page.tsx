import type { Metadata } from "next";
import { RollenClient } from "./RollenClient";

export const metadata: Metadata = { title: "Rollen & Rechte" };

export default function RollenPage() {
  return <RollenClient />;
}
