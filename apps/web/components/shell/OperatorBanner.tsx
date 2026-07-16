"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  clearOperatorClub,
  readOperatorClub,
  subscribeOperatorClub,
  type OperatorClub,
} from "@/lib/data/operator-club";
import { useT, type Dict } from "@/lib/i18n";
import { Icon } from "./icons";

/**
 * DAS BETREIBER-BAND — sichtbar, solange ein Plattform-Admin in einen fremden
 * Verein hineinsieht.
 *
 * ### Warum ein Band und kein Toast ###
 * Ein Toast verschwindet. Die Einsicht nicht. Wer nach zehn Minuten in der
 * Mitgliederliste steht, hat den Toast längst vergessen und hält sich für
 * „normal" unterwegs — und bearbeitet dann die Daten fremder Kinder in dem
 * Glauben, es seien die eigenen. Das Band steht deshalb dauerhaft, ganz oben,
 * über ALLEM (auch über der Konsole selbst), und es lässt sich nicht wegklicken:
 * die einzige Art, es loszuwerden, ist, die Einsicht wirklich zu beenden.
 *
 * ### Es sagt beide Wahrheiten, nicht nur die bequeme ###
 * 1. „Du bist hier nicht du" — Betreiber-Einsicht in <Verein>.
 * 2. „Das hier wird protokolliert" — jeder Zugriff landet in
 *    app.operator_audit_log (Migration 0051), und der Verein selbst kann darin
 *    nachlesen. Das ist keine Drohung, sondern der Grund, warum dieser Zugriff
 *    überhaupt zulässig ist: Marcel ist Auftragsverarbeiter der Vereine, und
 *    Art. 28 Abs. 3 lit. h DSGVO verlangt, dass er die Frage „wer hat wann
 *    unsere Mitgliederdaten angesehen?" beantworten kann.
 * Diesen zweiten Satz wegzulassen wäre die bequemere Oberfläche und die
 * unehrlichere.
 *
 * Rendert für alle anderen NICHTS (null) — für ein Mitglied, eine Trainerin
 * oder einen abgemeldeten Besucher existiert dieses Band nicht. readOperatorClub
 * ist fail-closed: ohne Plattform-Admin-Claim gibt es keinen Zustand zu zeigen.
 */

const bannerDict = {
  de: {
    eyebrow: "Betreiber-Einsicht",
    viewing: "Du siehst {club} als Plattform-Administrator — nicht als Mitglied.",
    logged: "Jeder Zugriff wird protokolliert; der Verein kann das Protokoll einsehen.",
    console: "Zur Konsole",
    end: "Einsicht beenden",
  },
  en: {
    eyebrow: "Operator access",
    viewing: "You are viewing {club} as a platform administrator — not as a member.",
    logged: "Every access is logged; the club can inspect the audit trail.",
    console: "To console",
    end: "End access",
  },
} satisfies Dict;

function serverSnapshot(): OperatorClub | null {
  return null;
}

export function OperatorBanner() {
  const t = useT(bannerDict);
  const router = useRouter();
  const club = useSyncExternalStore(subscribeOperatorClub, readOperatorClub, serverSnapshot);

  if (club === null) return null;

  const label = club.shortName ? `${club.name} (${club.shortName})` : club.name;

  function endAccess() {
    clearOperatorClub();
    // Zurück auf die Betreiber-Ebene: die Portal-Seite, auf der wir gerade
    // stehen, hätte ohne Einsicht nichts mehr zu zeigen (403/leer).
    router.push("/super");
  }

  return (
    <div
      // role="status" statt "alert": eine dauerhafte Zustandsanzeige, kein
      // Alarm — ein alert würde Screenreader bei jedem Seitenwechsel erneut
      // unterbrechen.
      role="status"
      className="sticky top-0 z-50 border-b border-warn/40 bg-warn-soft"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 lg:px-8">
        <span className="flex flex-none items-center gap-1.5 rounded-full bg-warn/15 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[.06em] text-warn">
          <Icon name="lock" className="ic h-3.5 w-3.5" />
          {t("eyebrow")}
        </span>

        <span className="min-w-0 grid gap-0.5">
          <span className="text-[13.5px] font-bold leading-tight text-ink">
            {t("viewing", { club: label })}
          </span>
          <span className="text-[12px] leading-tight text-ink-soft">{t("logged")}</span>
        </span>

        <span className="ml-auto flex flex-none items-center gap-2">
          <Link
            href="/super"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-[13px] font-bold text-ink no-underline transition-colors duration-150 hover:bg-sunken"
          >
            <Icon name="monitor" className="ic h-4 w-4" />
            {t("console")}
          </Link>
          {/* Bewusst KEINE Vollton-Fläche: --warn ist hell (Bernstein) im
              Dark- und dunkel (Braun) im Light-Theme — ein „text-warn-contrast"
              gibt es im Token-Satz nicht, und ein geratener Wert wäre in genau
              einem der beiden Themes unlesbar. Rahmen + Ton tragen die Farbe. */}
          <button
            type="button"
            onClick={endAccess}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-warn bg-surface px-3.5 text-[13px] font-bold text-warn transition-colors duration-150 hover:bg-warn-soft"
          >
            <Icon name="close" className="ic h-4 w-4" />
            {t("end")}
          </button>
        </span>
      </div>
    </div>
  );
}
