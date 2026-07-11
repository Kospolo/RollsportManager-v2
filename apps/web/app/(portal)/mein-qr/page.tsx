import type { Metadata } from "next";
import { MyQrScreen } from "./_components/MyQrScreen";

export const metadata: Metadata = { title: "Mein QR-Code" };

export default function MeinQrPage() {
  return <MyQrScreen />;
}
