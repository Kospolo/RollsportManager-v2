"use client";

import Link from "next/link";
import { useLocale, useT, type Dict } from "@/lib/i18n";
import { useData } from "@/lib/data/useData";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/shell/icons";
import { BrandMark, LanguageChip, LandingFooter } from "./chrome";
import { LegalMarkdown } from "./LegalMarkdown";
import { DEFAULT_LEGAL, LEGAL_TITLE, type LegalKind } from "./legal-defaults";

/**
 * Öffentliche Rechtstexte (Impressum, Datenschutz, AGB) — eine Hülle für alle
 * drei. Schlanke Topbar, Artikel-Spalte, Landing-Footer.
 *
 * ### WOHER DER TEXT KOMMT — ZWEI QUELLEN, EINE VORRANGREGEL ###
 * 1. Der BETREIBER kann jeden Text im (super)-Bereich pflegen. Dieser Override
 *    kommt über GET /public/legal (data.getPublicLegal) — ohne Login, nur die
 *    Rechtstexte.
 * 2. Ist der Override für dieses Dokument und diese Sprache LEER, zeigt die
 *    Seite den eingebauten Standard (legal-defaults.ts, aus v1 übernommen).
 *
 * Leer heißt also „zeig den gepflegten Standard", nicht „kein Text". So steht
 * nie eine leere Rechtsseite im Netz, und der Betreiber überschreibt den
 * Standard nur bewusst.
 *
 * ### SICHERHEIT ###
 * Der Text (Standard ODER Betreiber-Eingabe) wird über LegalMarkdown gerendert,
 * das ausschließlich React-Elemente erzeugt und NIE HTML aus einem String. Ein
 * Betreiber-Text mit `<script>` landet damit als sichtbarer Text, nicht als
 * ausgeführtes Skript — wichtig, weil diese Seite öffentlich ist.
 *
 * Ein Ladefehler des Overrides ist kein Problem: dann greift der Standard. Die
 * Rechtsseite ist nie von einem erreichbaren Server abhängig.
 */

const legalDict = {
  de: {
    reviewPending: "Noch nicht anwaltlich geprüft",
    backHome: "Zur Startseite",
    updated: "Stand: Juli 2026",
    draftNote:
      "Dieser Text beschreibt die Verarbeitung zutreffend, ist aber noch nicht anwaltlich geprüft. Vor dem öffentlichen Start lassen wir ihn prüfen.",
    draftNoteAgb:
      "Diese Bedingungen sind aus der Vorgängerversion übernommen und an den heutigen Funktionsumfang angepasst, aber noch nicht anwaltlich geprüft.",
  },
  en: {
    reviewPending: "Not yet reviewed by a lawyer",
    backHome: "Back to homepage",
    updated: "Last updated: July 2026",
    draftNote:
      "This text describes the processing accurately but has not yet been reviewed by a lawyer. We will have it reviewed before the public launch.",
    draftNoteAgb:
      "These terms are carried over from the previous version and adapted to today's feature set, but have not yet been reviewed by a lawyer.",
  },
} satisfies Dict;

/** Für welche Dokumente der „noch nicht geprüft"-Hinweis erscheint. */
const NEEDS_REVIEW_NOTE: Record<LegalKind, boolean> = {
  impressum: false, // reine Anbieterangaben — kein Entwurf
  datenschutz: true,
  agb: true,
};

export function LegalPage({ kind }: { kind: LegalKind }) {
  const t = useT(legalDict);
  const { locale } = useLocale();

  // Override des Betreibers (leer = Standard). Fehlt/lädt/scheitert die Antwort,
  // bleibt override leer und der eingebaute Standard greift — Absicht.
  const publicLegal = useData((repo) => repo.getPublicLegal());
  const override = publicLegal.data?.[kind]?.[locale]?.trim() ?? "";
  const body = override.length > 0 ? override : DEFAULT_LEGAL[kind][locale];

  const title = LEGAL_TITLE[kind][locale];
  const showNote = NEEDS_REVIEW_NOTE[kind];

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <BrandMark />
          <div className="ml-auto flex items-center gap-2.5">
            <ThemeToggle />
            <LanguageChip />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
          {showNote ? <Badge tone="info">{t("reviewPending")}</Badge> : null}
          <h1
            className={`font-display text-[28px] font-extrabold leading-9 tracking-tight text-ink ${
              showNote ? "mt-3" : ""
            }`.trim()}
          >
            {title}
          </h1>
          <p className="mt-1 text-caption text-ink-faint">{t("updated")}</p>

          {showNote ? (
            <p className="mt-5 rounded-lg border border-line bg-surface p-4 text-body leading-[23px] text-ink-soft shadow-card">
              {t(kind === "agb" ? "draftNoteAgb" : "draftNote")}
            </p>
          ) : null}

          <div className="mt-2">
            <LegalMarkdown text={body} />
          </div>

          <Link
            href="/"
            className="mt-10 inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand-ink no-underline hover:underline"
          >
            <Icon name="chevronRight" className="ic h-4 w-4 rotate-180" />
            {t("backHome")}
          </Link>
        </article>
      </main>

      <LandingFooter />
    </div>
  );
}
