"use client";

import Link from "next/link";
import { useT, type Dict } from "@/lib/i18n";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/shell/icons";
import { BrandMark, LanguageChip, LandingFooter } from "./chrome";

/**
 * Gemeinsame Hülle + Platzhalter-Inhalte für die Rechtstexte
 * (Impressum & Datenschutz). Schlanke öffentliche Topbar ohne
 * Anker-Navigation, Artikel-Spalte, Landing-Footer.
 */

const legalDict = {
  de: {
    placeholder: "Platzhalter",
    backHome: "Zur Startseite",
    updated: "Stand: Juli 2026",
    draftNote:
      "Dies ist ein Platzhaltertext für die Entwicklungsphase — die vollständigen, rechtlich geprüften Angaben folgen vor dem öffentlichen Start.",

    impTitle: "Impressum",
    impProviderHead: "Angaben gemäß § 5 DDG",
    impProviderBody:
      "RollsportManager (in Gründung)\nMusterstraße 1\n74172 Neckarsulm\nDeutschland",
    impRepresentHead: "Vertreten durch",
    impRepresentBody: "Max Mustermann (Platzhalter)",
    impContactHead: "Kontakt",
    impContactBody: "E-Mail: hallo@rollsportmanager.example\nTelefon: +49 (0) 000 000000",
    impLiabilityHead: "Haftungshinweis",
    impLiabilityBody:
      "Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte externer Links. Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber verantwortlich.",

    dsTitle: "Datenschutzerklärung",
    dsIntroHead: "Kurz gesagt",
    dsIntroBody:
      "RollsportManager verarbeitet Vereinsdaten ausschließlich, um die Vereinsverwaltung zu ermöglichen — sparsam, zweckgebunden und auf Servern in Deutschland.",
    dsControllerHead: "Verantwortlicher",
    dsControllerBody:
      "RollsportManager (in Gründung), Musterstraße 1, 74172 Neckarsulm — E-Mail: datenschutz@rollsportmanager.example (Platzhalter).",
    dsHostingHead: "Hosting & Datenstandort",
    dsHostingBody:
      "Alle Daten werden in einem Rechenzentrum in Deutschland gespeichert und täglich gesichert. Ein Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO liegt bei.",
    dsCookiesHead: "Cookies & Tracking",
    dsCookiesBody:
      "Diese Demo-Umgebung setzt keine Tracking-Cookies und bindet keine Drittanbieter-Dienste ein. Gespeichert werden lediglich technische Einstellungen wie Sprache und Farbschema — lokal in deinem Browser.",
    dsRightsHead: "Deine Rechte",
    dsRightsBody:
      "Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO). Wende dich dazu an die oben genannte Kontaktadresse.",
  },
  en: {
    placeholder: "Placeholder",
    backHome: "Back to homepage",
    updated: "Last updated: July 2026",
    draftNote:
      "This is placeholder copy for the development phase — the complete, legally reviewed information will follow before the public launch.",

    impTitle: "Legal notice",
    impProviderHead: "Information according to § 5 DDG (German Digital Services Act)",
    impProviderBody:
      "RollsportManager (in formation)\nMusterstraße 1\n74172 Neckarsulm\nGermany",
    impRepresentHead: "Represented by",
    impRepresentBody: "Max Mustermann (placeholder)",
    impContactHead: "Contact",
    impContactBody: "Email: hallo@rollsportmanager.example\nPhone: +49 (0) 000 000000",
    impLiabilityHead: "Liability note",
    impLiabilityBody:
      "Despite careful review we accept no liability for the content of external links. The operators of linked pages are solely responsible for their content.",

    dsTitle: "Privacy policy",
    dsIntroHead: "In short",
    dsIntroBody:
      "RollsportManager processes club data solely to make club management possible — minimal, purpose-bound and on servers in Germany.",
    dsControllerHead: "Controller",
    dsControllerBody:
      "RollsportManager (in formation), Musterstraße 1, 74172 Neckarsulm — email: datenschutz@rollsportmanager.example (placeholder).",
    dsHostingHead: "Hosting & data location",
    dsHostingBody:
      "All data is stored in a data centre in Germany and backed up daily. A data processing agreement under Art. 28 GDPR is included.",
    dsCookiesHead: "Cookies & tracking",
    dsCookiesBody:
      "This demo environment sets no tracking cookies and embeds no third-party services. Only technical preferences such as language and colour scheme are stored — locally in your browser.",
    dsRightsHead: "Your rights",
    dsRightsBody:
      "You have the right to access, rectification, erasure, restriction of processing, data portability and objection (Art. 15–21 GDPR). Please use the contact address above.",
  },
} satisfies Dict;

type LegalKey = keyof (typeof legalDict)["de"];
type SectionDef = { head: LegalKey; body: LegalKey; pre?: boolean };

const SECTIONS: Record<"impressum" | "datenschutz", { title: LegalKey; sections: SectionDef[] }> = {
  impressum: {
    title: "impTitle",
    sections: [
      { head: "impProviderHead", body: "impProviderBody", pre: true },
      { head: "impRepresentHead", body: "impRepresentBody" },
      { head: "impContactHead", body: "impContactBody", pre: true },
      { head: "impLiabilityHead", body: "impLiabilityBody" },
    ],
  },
  datenschutz: {
    title: "dsTitle",
    sections: [
      { head: "dsIntroHead", body: "dsIntroBody" },
      { head: "dsControllerHead", body: "dsControllerBody" },
      { head: "dsHostingHead", body: "dsHostingBody" },
      { head: "dsCookiesHead", body: "dsCookiesBody" },
      { head: "dsRightsHead", body: "dsRightsBody" },
    ],
  },
};

export function LegalPage({ kind }: { kind: "impressum" | "datenschutz" }) {
  const t = useT(legalDict);
  const page = SECTIONS[kind];

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
          <Badge tone="info">{t("placeholder")}</Badge>
          <h1 className="mt-3 font-display text-[28px] font-extrabold leading-9 tracking-tight text-ink">
            {t(page.title)}
          </h1>
          <p className="mt-1 text-caption text-ink-faint">{t("updated")}</p>

          <p className="mt-5 rounded-lg border border-line bg-surface p-4 text-body leading-[23px] text-ink-soft shadow-card">
            {t("draftNote")}
          </p>

          {page.sections.map((section) => (
            <section key={section.head} className="mt-8">
              <h2 className="font-display text-h3 tracking-[-0.01em] text-ink">
                {t(section.head)}
              </h2>
              <p
                className={`mt-2 text-body leading-[24px] text-ink-soft ${
                  section.pre ? "whitespace-pre-line" : ""
                }`.trim()}
              >
                {t(section.body)}
              </p>
            </section>
          ))}

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
