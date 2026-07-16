import type { Metadata } from "next";
import { ModuleClient } from "./ModuleClient";

export const metadata: Metadata = { title: "Module" };

export default function ModulePage() {
  return <ModuleClient />;
}
