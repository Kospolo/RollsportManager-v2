"use client";

import Link from "next/link";
import { useT, type Dict } from "@/lib/i18n";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/shell/icons";
import { BrandMark, LanguageChip, LandingFooter } from "./chrome";

/**
 * Gemeinsame Hülle + Inhalte für die Rechtstexte (Impressum & Datenschutz).
 * Schlanke öffentliche Topbar ohne Anker-Navigation, Artikel-Spalte,
 * Landing-Footer.
 *
 * HERKUNFT DER TEXTE (24.07.2026): Beide stammen aus der PRODUKTIVSEITE von
 * v1 (`RollsportManager/rollsportmanager-backend/www/`), wo sie seit Januar
 * 2026 öffentlich stehen. Vorher lag hier Blindtext mit „Musterstraße 1" und
 * „Max Mustermann" — auf einer Seite, die bereits erreichbar war.
 *
 * Das Impressum ist wörtlich übernommen: Es sind Angaben über den Betreiber,
 * und der ist derselbe geblieben.
 *
 * Die Datenschutzerklärung NICHT. v1 nennt dort nur Mitglieder-, Trainings-,
 * Küren- und Chat-Daten. v2 verarbeitet mehr, und zwar Heikleres:
 * Gesundheitsdaten (Krankmeldung mit Freitext, Art. 9), interne Notizen des
 * Trainerstabs über Mitglieder, Fotos mit Einwilligung, Telefonnummern für
 * Fahrgemeinschaften. Eine übernommene Erklärung, die das verschweigt, wäre
 * schlechter als ein Platzhalter — sie behauptete Vollständigkeit. Deshalb
 * steht das alles im Abschnitt „Welche Daten verarbeitet werden" ausdrücklich
 * drin. Wer hier ein Feature ergänzt, das neue Datenarten anfasst, gehört in
 * diesen Abschnitt.
 */

const legalDict = {
  de: {
    reviewPending: "Noch nicht anwaltlich geprüft",
    backHome: "Zur Startseite",
    updated: "Stand: Juli 2026",
    draftNote:
      "Dieser Text beschreibt die Verarbeitung zutreffend, ist aber noch nicht anwaltlich geprüft. Vor dem öffentlichen Start lassen wir ihn prüfen.",

    // Impressum: WÖRTLICH aus der Produktivseite von v1 übernommen
    // (rollsportmanager-backend/www/impressum.html). Es sind Angaben über den
    // Betreiber, und der ist derselbe — hier gibt es nichts zu formulieren,
    // nur zu übertragen.
    impTitle: "Impressum",
    impProviderHead: "Angaben gemäß § 5 TMG",
    impProviderBody: "Marcel Goldfuss\nBeethovenstr. 24\n74172 Neckarsulm\nDeutschland",
    impRepresentHead: "Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV",
    impRepresentBody: "Marcel Goldfuss\nBeethovenstr. 24\n74172 Neckarsulm",
    impContactHead: "Kontakt",
    impContactBody: "Telefon: +49 7132 7049229\nE-Mail: info@rollsportmanager.de",
    impDisputeHead: "EU-Streitschlichtung",
    impDisputeBody:
      "Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: https://ec.europa.eu/consumers/odr/\n\nUnsere E-Mail-Adresse finden Sie oben im Impressum. Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",
    impLiabilityHead: "Haftung für Inhalte und Links",
    impLiabilityBody:
      "Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen.\n\nUnser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter verantwortlich. Bei Bekanntwerden von Rechtsverletzungen entfernen wir derartige Links umgehend.",
    impCopyrightHead: "Urheberrecht",
    impCopyrightBody:
      "Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Downloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet. Soweit Inhalte nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter beachtet.",

    // Datenschutz: auf Grundlage von v1 (www/datenschutz.html), aber
    // ANGEPASST. Die v1-Fassung nennt nur Mitglieder-, Trainings-, Küren- und
    // Chat-Daten. v2 verarbeitet mehr — darunter Gesundheitsdaten (Art. 9:
    // Krankmeldung mit Freitext), interne Trainer-Notizen über Mitglieder,
    // Fotos mit Einwilligung und Telefonnummern für Fahrgemeinschaften. Eine
    // Erklärung, die das verschweigt, wäre unvollständig — deshalb steht es
    // hier ausdrücklich drin.
    dsTitle: "Datenschutzerklärung",
    dsIntroHead: "Auf einen Blick",
    dsIntroBody:
      "RollsportManager verarbeitet Vereinsdaten ausschließlich, um die Vereinsverwaltung zu ermöglichen — sparsam und zweckgebunden. Ein großer Teil der Nutzenden sind Kinder; deren Daten behandeln wir entsprechend eng.\n\nWer welche Daten sehen darf, entscheidet nicht die Oberfläche, sondern die Datenbank selbst: Die Trennung der Vereine und die Rechte innerhalb eines Vereins sind dort erzwungen.",
    dsControllerHead: "Verantwortliche Stelle",
    dsControllerBody:
      "Marcel Goldfuss\nBeethovenstr. 24\n74172 Neckarsulm\nDeutschland\n\nTelefon: +49 7132 7049229\nE-Mail: info@rollsportmanager.de",
    dsDataHead: "Welche Daten verarbeitet werden",
    dsDataBody:
      "Bei der Registrierung: E-Mail-Adresse, Passwort (verschlüsselt), Name, Vereinszugehörigkeit.\n\nIm laufenden Betrieb je nach genutzten Modulen: Mitgliederdaten, Teams und Sparten, Termine und Anwesenheiten, Küren samt Musikdateien, Wettkampfergebnisse, Beiträge und Rechnungen, Nachrichten, Dokumente und Fotos.\n\nBesonders geschützte Daten, ausdrücklich benannt:\n• Krankmeldungen zu Terminen können einen Freitext enthalten und sind damit Gesundheitsdaten (Art. 9 DSGVO). Sie sind auf die Familie selbst, den Vorstand und das Trainerteam des betroffenen Mitglieds beschränkt — nicht auf den Verein insgesamt.\n• Interne Notizen des Trainerstabs über ein Mitglied sind für die betroffene Familie nicht sichtbar und nur dem Trainerteam dieses Mitglieds sowie der Vereinsleitung zugänglich.\n• Fotos, auf denen Mitglieder markiert sind, werden nur mit hinterlegter Einwilligung angezeigt.\n• Telefonnummern für Fahrgemeinschaften sind ausschließlich für die unmittelbar Beteiligten sichtbar.",
    dsHostingHead: "Hosting & Datenstandort",
    dsHostingBody:
      "Die Daten werden in einem Rechenzentrum in Deutschland gespeichert und gesichert. Hosting, Auftragsverarbeitung nach Art. 28 DSGVO und Datenexport halten wir mit jedem Verein vertraglich fest.",
    dsCookiesHead: "Cookies & Tracking",
    dsCookiesBody:
      "Wir setzen keine Tracking-Cookies und binden keine Werbe- oder Analysedienste ein. Gespeichert werden technisch notwendige Angaben für die Anmeldung sowie lokale Einstellungen wie Sprache und Farbschema.",
    dsRightsHead: "Ihre Rechte",
    dsRightsBody:
      "Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch sowie auf Widerruf erteilter Einwilligungen (Art. 15–21 DSGVO). Wenden Sie sich dazu an die oben genannte Kontaktadresse. Ihnen steht außerdem ein Beschwerderecht bei einer Aufsichtsbehörde zu.",
  },
  en: {
    reviewPending: "Not yet reviewed by a lawyer",
    backHome: "Back to homepage",
    updated: "Last updated: July 2026",
    draftNote:
      "This text describes the processing accurately but has not yet been reviewed by a lawyer. We will have it reviewed before the public launch.",

    impTitle: "Legal notice",
    impProviderHead: "Information according to § 5 TMG (German Telemedia Act)",
    impProviderBody: "Marcel Goldfuss\nBeethovenstr. 24\n74172 Neckarsulm\nGermany",
    impRepresentHead: "Responsible for content according to § 55 Abs. 2 RStV",
    impRepresentBody: "Marcel Goldfuss\nBeethovenstr. 24\n74172 Neckarsulm",
    impContactHead: "Contact",
    impContactBody: "Phone: +49 7132 7049229\nEmail: info@rollsportmanager.de",
    impDisputeHead: "EU dispute resolution",
    impDisputeBody:
      "The European Commission provides a platform for online dispute resolution (ODR): https://ec.europa.eu/consumers/odr/\n\nYou can find our email address in the legal notice above. We are not willing or obliged to participate in dispute resolution proceedings before a consumer arbitration board.",
    impLiabilityHead: "Liability for content and links",
    impLiabilityBody:
      "As a service provider we are responsible for our own content on these pages under general law pursuant to § 7 Abs. 1 TMG. Under §§ 8 to 10 TMG we are not obliged to monitor transmitted or stored third-party information.\n\nOur website contains links to external third-party sites over whose content we have no influence. The respective provider is always responsible for the content of linked pages. We remove such links immediately upon becoming aware of legal violations.",
    impCopyrightHead: "Copyright",
    impCopyrightBody:
      "Content and works created by the site operators on these pages are subject to German copyright law. Downloads and copies of this page are permitted for private, non-commercial use only. Where content was not created by the operator, third-party copyrights are respected.",

    dsTitle: "Privacy policy",
    dsIntroHead: "At a glance",
    dsIntroBody:
      "RollsportManager processes club data solely to make club management possible — minimal and purpose-bound. A large share of our users are children; their data is treated accordingly narrowly.\n\nWho may see which data is not decided by the interface but by the database itself: separation between clubs and permissions within a club are enforced there.",
    dsControllerHead: "Controller",
    dsControllerBody:
      "Marcel Goldfuss\nBeethovenstr. 24\n74172 Neckarsulm\nGermany\n\nPhone: +49 7132 7049229\nEmail: info@rollsportmanager.de",
    dsDataHead: "Which data is processed",
    dsDataBody:
      "On registration: email address, password (encrypted), name, club membership.\n\nDuring use, depending on the modules in use: member data, teams and divisions, events and attendance, routines including music files, competition results, fees and invoices, messages, documents and photos.\n\nSpecially protected data, named explicitly:\n• Sickness notices for events may contain free text and are therefore health data (Art. 9 GDPR). They are limited to the family itself, the board and the coaching team of the member concerned — not to the club as a whole.\n• Internal notes by the coaching staff about a member are not visible to the family concerned and are accessible only to that member's coaching team and the club leadership.\n• Photos in which members are tagged are only shown where consent is on file.\n• Phone numbers for carpools are visible only to those directly involved.",
    dsHostingHead: "Hosting & data location",
    dsHostingBody:
      "Data is stored and backed up in a data centre in Germany. Hosting, the data processing agreement under Art. 28 GDPR and data export are contractually agreed with each club.",
    dsCookiesHead: "Cookies & tracking",
    dsCookiesBody:
      "We set no tracking cookies and embed no advertising or analytics services. We store technically necessary information for signing in as well as local preferences such as language and colour scheme.",
    dsRightsHead: "Your rights",
    dsRightsBody:
      "You have the right to access, rectification, erasure, restriction of processing, data portability and objection, as well as to withdraw consent given (Art. 15–21 GDPR). Please use the contact address above. You also have the right to lodge a complaint with a supervisory authority.",
  },
} satisfies Dict;

type LegalKey = keyof (typeof legalDict)["de"];
type SectionDef = { head: LegalKey; body: LegalKey; pre?: boolean };

const SECTIONS: Record<"impressum" | "datenschutz", { title: LegalKey; sections: SectionDef[] }> = {
  impressum: {
    title: "impTitle",
    sections: [
      { head: "impProviderHead", body: "impProviderBody", pre: true },
      { head: "impRepresentHead", body: "impRepresentBody", pre: true },
      { head: "impContactHead", body: "impContactBody", pre: true },
      { head: "impDisputeHead", body: "impDisputeBody", pre: true },
      { head: "impLiabilityHead", body: "impLiabilityBody", pre: true },
      { head: "impCopyrightHead", body: "impCopyrightBody" },
    ],
  },
  datenschutz: {
    title: "dsTitle",
    sections: [
      { head: "dsIntroHead", body: "dsIntroBody", pre: true },
      { head: "dsControllerHead", body: "dsControllerBody", pre: true },
      // Der ausfuehrlichste Abschnitt, und das mit Absicht: Hier stehen die
      // Gesundheitsdaten, die Trainer-Notizen und die Foto-Einwilligung.
      { head: "dsDataHead", body: "dsDataBody", pre: true },
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
          {/*
            Das Impressum ist KEIN Platzhalter mehr: Es sind Angaben über den
            Betreiber, wörtlich aus der Produktivseite von v1 übernommen — dort
            stehen sie seit Januar 2026 öffentlich.

            Der Datenschutz behält einen Hinweis, aber einen ehrlichen: Der Text
            beschreibt die Verarbeitung zutreffend (inklusive Gesundheitsdaten
            und Trainer-Notizen), ist aber nicht anwaltlich geprüft. Das ist
            etwas anderes als „Blindtext" — und es so zu nennen wäre falsch.
          */}
          {kind === "datenschutz" ? <Badge tone="info">{t("reviewPending")}</Badge> : null}
          <h1
            className={`font-display text-[28px] font-extrabold leading-9 tracking-tight text-ink ${
              kind === "datenschutz" ? "mt-3" : ""
            }`.trim()}
          >
            {t(page.title)}
          </h1>
          <p className="mt-1 text-caption text-ink-faint">{t("updated")}</p>

          {kind === "datenschutz" ? (
            <p className="mt-5 rounded-lg border border-line bg-surface p-4 text-body leading-[23px] text-ink-soft shadow-card">
              {t("draftNote")}
            </p>
          ) : null}

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
