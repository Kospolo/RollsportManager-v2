import type { Metadata } from "next";
import { SupportOpsClient } from "./SupportOpsClient";

export const metadata: Metadata = { title: "Support" };

export default function SupportOpsPage() {
  return <SupportOpsClient />;
}
