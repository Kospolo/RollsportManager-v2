import { redirect } from "next/navigation";

/** Einstieg: das Portal beginnt auf dem Dashboard. */
export default function RootPage() {
  redirect("/dashboard");
}
