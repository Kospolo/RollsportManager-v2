"use client";

import { useState } from "react";
import { useT, type Dict } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Badge, DunningBadge } from "@/components/ui/Badge";
import { FilterChips } from "@/components/ui/FilterChips";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { IconTile } from "@/components/ui/IconTile";
import { members, dunningPipeline, openInvoices } from "@/lib/mock";
import { Spec, SpecRow } from "./Spec";

const dict = {
  de: {
    buttons: "Button",
    variants: "Varianten (min-height 44)",
    small: "Größe sm (36 — nur Tabellenzeilen & Karten-Köpfe)",
    states: "Zustände",
    primary: "Termin anlegen",
    secondary: "Küren öffnen",
    ghost: "Woche ansehen",
    danger: "Mitglied löschen",
    disabled: "Deaktiviert",
    remind: "Jetzt erinnern",
    details: "Details",
    badges: "Badge / StatusPill",
    tones: "Semantische Töne (immer Farbe + Wort)",
    dunning: "Mahnstufen-Ampel (Neutral → Info → Warn → Danger)",
    honeyNote: "Honig — AUSSCHLIESSLICH Musik/Küren",
    tNeutral: "Training",
    tBrand: "Kür B",
    tInfo: "Erinnerung",
    tSuccess: "bezahlt",
    tWarn: "Frist",
    tDanger: "überfällig",
    tHoney: "im Loop",
    filter: "FilterChips",
    filterLabel: "Offene Posten filtern",
    fAll: "Alle",
    fOpen: "Offen",
    fReminded: "Erinnert",
    fDunned: "Gemahnt",
    filterHint: "Single-Select mit Anzahl-Badges — Zählwerte aus dunningPipeline, nie hart codiert.",
    tabs: "Tabs",
    tabsLabel: "Kür-Ansicht wählen",
    tabOverview: "Übersicht",
    tabMarkers: "Markierungen",
    tabScores: "Wertungen",
    panelOverview: "Inhalt der Übersicht — Panels sind per Pfeiltasten erreichbar.",
    panelMarkers: "Zeitmarken mit RollArt-Kürzeln (2S, SSp, StSq).",
    panelScores: "RollArt-Verlauf über die Saison.",
    avatars: "Avatar & AvatarStack",
    sizes: "Größen s / m / l — 6 Töne deterministisch per Hash",
    stack: "Stapel mit Überlauf",
    stackLegend: "Rein visuell — der Klartext daneben trägt die Information.",
    iconTiles: "IconTile (Organisationen)",
    iconTilesRow: "radius-org 9 px — nie Pseudo-Monogramme",
    orgCity: "Stadt Neckarsulm",
    orgSepa: "SEPA-Sammellauf",
    orgMail: "Verband (Post)",
    orgDeadline: "Frist Kassenprüfung",
  },
  en: {
    buttons: "Button",
    variants: "Variants (min-height 44)",
    small: "Size sm (36 — table rows & card headers only)",
    states: "States",
    primary: "Create event",
    secondary: "Open routines",
    ghost: "View week",
    danger: "Delete member",
    disabled: "Disabled",
    remind: "Remind now",
    details: "Details",
    badges: "Badge / StatusPill",
    tones: "Semantic tones (always colour + word)",
    dunning: "Dunning ladder (neutral → info → warn → danger)",
    honeyNote: "Honey — music/routines context ONLY",
    tNeutral: "Training",
    tBrand: "Routine B",
    tInfo: "Reminder",
    tSuccess: "paid",
    tWarn: "Deadline",
    tDanger: "overdue",
    tHoney: "in loop",
    filter: "FilterChips",
    filterLabel: "Filter open items",
    fAll: "All",
    fOpen: "Open",
    fReminded: "Reminded",
    fDunned: "Dunned",
    filterHint: "Single-select with count badges — counts derived from dunningPipeline, never hard-coded.",
    tabs: "Tabs",
    tabsLabel: "Choose routine view",
    tabOverview: "Overview",
    tabMarkers: "Markers",
    tabScores: "Scores",
    panelOverview: "Overview content — panels are reachable via arrow keys.",
    panelMarkers: "Time markers with RollArt codes (2S, SSp, StSq).",
    panelScores: "RollArt trend across the season.",
    avatars: "Avatar & AvatarStack",
    sizes: "Sizes s / m / l — 6 tones, deterministic by hash",
    stack: "Stack with overflow",
    stackLegend: "Purely visual — the plain text next to it carries the information.",
    iconTiles: "IconTile (organisations)",
    iconTilesRow: "radius-org 9 px — never pseudo monograms",
    orgCity: "City of Neckarsulm",
    orgSepa: "SEPA batch run",
    orgMail: "Federation (mail)",
    orgDeadline: "Audit deadline",
  },
} satisfies Dict;

type FilterValue = "alle" | "offen" | "erinnert" | "gemahnt";
type TabValue = "overview" | "markers" | "scores";

export function SectionsBasics() {
  const t = useT(dict);
  const [filter, setFilter] = useState<FilterValue>("alle");
  const [tab, setTab] = useState<TabValue>("overview");

  const filterOptions = [
    { value: "alle" as const, label: t("fAll"), count: openInvoices.length },
    { value: "offen" as const, label: t("fOpen"), count: dunningPipeline[0].count },
    { value: "erinnert" as const, label: t("fReminded"), count: dunningPipeline[1].count },
    {
      value: "gemahnt" as const,
      label: t("fDunned"),
      count: dunningPipeline[2].count + dunningPipeline[3].count,
    },
  ];

  const tabItems = [
    { value: "overview" as const, label: t("tabOverview") },
    { value: "markers" as const, label: t("tabMarkers"), count: 5 },
    { value: "scores" as const, label: t("tabScores"), count: 3 },
  ];

  return (
    <div className="grid gap-5">
      <Spec title={t("buttons")} importPath='import { Button, ButtonLink } from "@/components/ui/Button"'>
        <SpecRow label={t("variants")}>
          <Button icon="plus">{t("primary")}</Button>
          <Button variant="secondary" icon="routines">
            {t("secondary")}
          </Button>
          <Button variant="ghost" icon="events">
            {t("ghost")}
          </Button>
          <Button variant="danger">{t("danger")}</Button>
        </SpecRow>
        <SpecRow label={t("small")}>
          <Button size="sm" variant="secondary">
            {t("remind")}
          </Button>
          <Button size="sm" variant="ghost">
            {t("details")}
          </Button>
        </SpecRow>
        <SpecRow label={t("states")}>
          <Button disabled>{t("disabled")}</Button>
          <Button variant="ghost" disabled>
            {t("disabled")}
          </Button>
        </SpecRow>
      </Spec>

      <Spec title={t("badges")} importPath='import { Badge, StatusPill, DunningBadge } from "@/components/ui/Badge"'>
        <SpecRow label={t("tones")}>
          <Badge>{t("tNeutral")}</Badge>
          <Badge tone="brand">{t("tBrand")}</Badge>
          <Badge tone="info">{t("tInfo")}</Badge>
          <Badge tone="success" icon="check">
            {t("tSuccess")}
          </Badge>
          <Badge tone="warn" icon="clock">
            {t("tWarn")}
          </Badge>
          <Badge tone="danger">{t("tDanger")}</Badge>
        </SpecRow>
        <SpecRow label={t("honeyNote")}>
          <Badge tone="honey" icon="routines">
            {t("tHoney")}
          </Badge>
        </SpecRow>
        <SpecRow label={t("dunning")}>
          <DunningBadge level={0} />
          <DunningBadge level={1} />
          <DunningBadge level={2} />
          <DunningBadge level={3} />
        </SpecRow>
      </Spec>

      <Spec title={t("filter")} importPath='import { FilterChips } from "@/components/ui/FilterChips"'>
        <FilterChips options={filterOptions} value={filter} onChange={setFilter} label={t("filterLabel")} />
        <p className="text-caption text-ink-faint">{t("filterHint")}</p>
      </Spec>

      <Spec title={t("tabs")} importPath='import { Tabs, TabPanel } from "@/components/ui/Tabs"'>
        <Tabs tabs={tabItems} value={tab} onChange={setTab} label={t("tabsLabel")} idBase="sg-tabs" />
        <TabPanel value="overview" active={tab} idBase="sg-tabs" className="text-body text-ink-soft">
          {t("panelOverview")}
        </TabPanel>
        <TabPanel value="markers" active={tab} idBase="sg-tabs" className="text-body text-ink-soft">
          {t("panelMarkers")}
        </TabPanel>
        <TabPanel value="scores" active={tab} idBase="sg-tabs" className="text-body text-ink-soft">
          {t("panelScores")}
        </TabPanel>
      </Spec>

      <Spec
        title={t("avatars")}
        importPath='import { Avatar } from "@/components/ui/Avatar" · import { AvatarStack } from "@/components/ui/AvatarStack"'
      >
        <SpecRow label={t("sizes")}>
          {members.slice(6, 12).map((member) => (
            <Avatar
              key={member.id}
              personId={member.id}
              firstName={member.firstName}
              lastName={member.lastName}
              size="s"
            />
          ))}
          <Avatar personId={members[0].id} firstName={members[0].firstName} lastName={members[0].lastName} size="m" />
          <Avatar personId={members[2].id} firstName={members[2].firstName} lastName={members[2].lastName} size="l" />
        </SpecRow>
        <SpecRow label={t("stack")}>
          <AvatarStack
            people={members.slice(6, 15).map((m) => ({
              personId: m.id,
              firstName: m.firstName,
              lastName: m.lastName,
            }))}
          />
          <span className="text-caption text-ink-faint">{t("stackLegend")}</span>
        </SpecRow>
      </Spec>

      <Spec title={t("iconTiles")} importPath='import { IconTile } from "@/components/ui/IconTile"'>
        <SpecRow label={t("iconTilesRow")}>
          <IconTile icon="bank" label={t("orgCity")} />
          <IconTile icon="zap" label={t("orgSepa")} />
          <IconTile icon="mail" size="m" label={t("orgMail")} />
          <IconTile icon="clock" size="m" tone="warn" label={t("orgDeadline")} />
        </SpecRow>
      </Spec>
    </div>
  );
}
