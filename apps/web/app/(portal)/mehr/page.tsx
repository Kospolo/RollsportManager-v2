import type { Metadata } from "next";
import { MehrHub } from "./MehrHub";

export const metadata: Metadata = { title: "Mehr" };

export default function MehrPage() {
  return <MehrHub />;
}
