import type { Metadata } from "next";
import { ChatClient } from "./ChatClient";

export const metadata: Metadata = { title: "Nachrichten" };

export default function ChatPage() {
  return <ChatClient />;
}
