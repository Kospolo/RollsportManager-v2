import type { Metadata } from "next";
import { PlatformConsoleClient } from "./PlatformConsoleClient";

export const metadata: Metadata = { title: "Plattform" };

export default function PlatformPage() {
  return <PlatformConsoleClient />;
}
