"use client";

import { useT, type Dict } from "@/lib/i18n";
import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionsBasics } from "./SectionsBasics";
import { SectionsData } from "./SectionsData";
import { SectionsForms } from "./SectionsForms";

const dict = {
  de: {
    eyebrow: "Design-System „Heimspiel“",
    title: "Styleguide",
    sub: "Alle UI-Komponenten in allen Varianten — visuelle Abnahme in Light und Dark.",
    tempNote: "Wird später entfernt",
    hint: "Diese Seite ist absichtlich nicht in der Navigation verdrahtet und dient nur der Abnahme der Komponentenbibliothek. Sie wird entfernt, sobald die echten Screens stehen.",
    groupBasics: "Grundbausteine",
    groupData: "Daten & Anzeige",
    groupForms: "Formulare & Overlays",
  },
  en: {
    eyebrow: "“Heimspiel” design system",
    title: "Style guide",
    sub: "Every UI component in every variant — visual sign-off in light and dark.",
    tempNote: "Will be removed later",
    hint: "This page is intentionally not wired into the navigation and only serves to sign off the component library. It will be removed once the real screens are in place.",
    groupBasics: "Building blocks",
    groupData: "Data & display",
    groupForms: "Forms & overlays",
  },
} satisfies Dict;

export function StyleguideClient() {
  const t = useT(dict);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6">
      <SectionHeader
        level={1}
        eyebrow={t("eyebrow")}
        title={t("title")}
        sub={t("sub")}
        action={<Badge tone="warn">{t("tempNote")}</Badge>}
      />
      <p className="max-w-3xl rounded-lg border border-line bg-sunken px-4 py-3 text-caption text-ink-soft">
        {t("hint")}
      </p>

      <SectionHeader title={t("groupBasics")} className="mt-2" />
      <SectionsBasics />

      <SectionHeader title={t("groupData")} className="mt-2" />
      <SectionsData />

      <SectionHeader title={t("groupForms")} className="mt-2" />
      <SectionsForms />
    </div>
  );
}
