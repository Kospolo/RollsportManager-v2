import type { Metadata } from "next";
import { SystemConsoleClient } from "./SystemConsoleClient";

export const metadata: Metadata = { title: "System" };

export default function SystemPage() {
  return <SystemConsoleClient />;
}
