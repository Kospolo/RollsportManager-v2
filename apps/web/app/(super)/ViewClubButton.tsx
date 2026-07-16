"use client";

import { useRouter } from "next/navigation";
import { setOperatorClub, type OperatorClub } from "@/lib/data/operator-club";
import { useT, type Dict } from "@/lib/i18n";
import { Icon } from "@/components/shell/icons";

/**
 * „Diesen Verein ansehen" — der Vereins-Umschalter, an jeder Vereinszeile.
 *
 * ### Was der Klick tut ###
 * Er merkt sich EINEN Verein (lib/data/operator-club.ts) und springt ins
 * Portal. Ab da tragen alle Portal-Aufrufe dessen club_id (client.ts →
 * activeClubId), der Server lässt den Betreiber hinein (Migration 0051) und
 * protokolliert jeden einzelnen Zugriff. Das Band oben (OperatorBanner) steht,
 * bis die Einsicht beendet wird.
 *
 * ### Warum das Ziel /mitglieder ist und nicht /dashboard ###
 * Weil der Betreiber nicht „mal reinschauen" will, sondern eine Frage hat —
 * und die betrifft fast immer Menschen oder Küren. Das Dashboard eines fremden
 * Vereins ist für ihn eine Seite ohne Aussage. Aufrufer können ein anderes Ziel
 * setzen (z. B. die Küren-Moderation schickt auf /kueren).
 *
 * ### Warum hier NICHT gewarnt wird ###
 * Ein Bestätigungsdialog („willst du wirklich?") wäre Theater: der Betreiber
 * will ja, er hat gerade geklickt. Die Ehrlichkeit sitzt dort, wo sie wirkt —
 * im dauerhaften Band, das ihn nicht mehr vergessen lässt, wer er hier ist.
 */

const viewClubDict = {
  de: { view: "Ansehen", viewLong: "Diesen Verein ansehen" },
  en: { view: "View", viewLong: "View this club" },
} satisfies Dict;

export function ViewClubButton({
  club,
  target = "/mitglieder",
  variant = "compact",
}: {
  club: OperatorClub;
  /** Portal-Pfad, auf dem die Einsicht startet. */
  target?: string;
  variant?: "compact" | "full";
}) {
  const t = useT(viewClubDict);
  const router = useRouter();

  function view() {
    setOperatorClub(club);
    router.push(target);
  }

  return (
    <button
      type="button"
      onClick={view}
      aria-label={`${t("viewLong")}: ${club.name}`}
      className="inline-flex min-h-9 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border border-line-strong bg-surface px-3 text-[13px] font-bold text-ink transition-colors duration-150 hover:bg-sunken"
    >
      <Icon name="chevronRight" className="ic h-4 w-4" />
      {variant === "full" ? t("viewLong") : t("view")}
    </button>
  );
}
