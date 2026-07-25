"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useModules } from "@/lib/modules";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Icon, type IconName } from "@/components/shell/icons";
import { useWaitlistWaitingCount } from "@/components/shell/useNav";
import { MehrIcon, type MehrIconName } from "./MehrIcon";
import { mehrDict, type MehrKey } from "./i18n";

/**
 * „Mehr"-Hub: Übersichts-Raster aller Vereins-Bereiche (Referenz 3.1).
 *
 * Zwei Abschnitte: „Verfügbar" verlinkt die gebauten (Termine, Mitglieder,
 * Küren, Wettkampf, Finanzen, Verwaltung) und die neuen Module (News, Notizen,
 * Übungen, Familie, Belegungsplan, Ausrüstung, Medaillen, Trainingsplan,
 * Pflichtstunden, Auswertung, Chat, Check-in, Überregionale Events, Galerie und
 * Dokumente — mit „Neu"-Badge). Galerie und Dokumente sind PRO-Funktionen und
 * tragen zusätzlich ein „PRO"-Badge; das echte Entitlement-Gate bleibt
 * serverseitig (402 club_pro_required). „Bald verfügbar" hält nur noch eine
 * dezente „Weitere Module folgen"-Zeile, solange kein Modul mehr aussteht.
 *
 * Die Verwaltungs-Kachel erscheint nur für Vereins-Admins (analog zur Nav);
 * der echte Schutz bleibt serverseitig (RLS + API). Alle Lese-Bereiche sind
 * für Mitglieder sichtbar — Schreibrechte gaten die Fach-Screens selbst.
 *
 * ### MODUL-SCHALTER (Migration 0044) ###
 * Abgeschaltete Module verschwinden hier ganz — nicht als „Bald"-Kachel, denn
 * das wäre gelogen: das Modul ist nicht bald da, der Verein benutzt es nicht.
 * Die Schalterstellung kommt vom Server (GET /clubs/{clubId}/modules); die
 * Facade-Methode `listClubModules` bedient mock UND api.
 *
 * ### SEIT 0077 WIRD AUF SICHTBARKEIT GEFILTERT, NICHT AUF `available` ###
 * `available` = eingeschaltet UND gekauft beantwortet nur, ob der VEREIN das
 * Modul hat. Deshalb sah hier jedes Mitglied alle 26 Kacheln — auch Auswertung,
 * Schließfächer, Jubiläen, Wartelisten, Gruppen und Finanzen. Maßgeblich ist
 * jetzt `isModuleVisible` aus dem ModulesProvider (GET …/modules/effective):
 * die fertig gefilterte Liste FÜR DIESE PERSON. Die Und-Kette bleibt darin
 * enthalten — ein PRO-Modul ohne Entitlement kommt gar nicht erst vor.
 *
 * ### DAS AUSBLENDEN IST KOSMETIK ###
 * Die Durchsetzung sind die restriktiven RLS-Policies aus 0044, nicht dieser
 * Filter. Ein Modul mit enforcement='menu_only' (Auswertung, Jubiläen) ist
 * hier zwar weg, seine Daten bleiben aber per API abrufbar — deshalb sagt die
 * Modul-Verwaltung das dort auch ausdrücklich dazu, statt „Aus" zu behaupten.
 * Ein Tile-Key ohne Eintrag im Katalog (z. B. eine künftige Kachel) bleibt
 * sichtbar: kein Schalter, kein Filter (fail-open wie app.module_enabled).
 */

type Tone = "neutral" | "brand" | "info" | "success" | "warn";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-sunken text-ink-soft",
  brand: "bg-brand-soft text-brand-ink",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warn: "bg-warn-soft text-warn",
};

/** Icon-Quelle: geteiltes Shell-Icon (gebaute Bereiche) oder lokales Glyph. */
type TileIcon = { shell: IconName } | { mehr: MehrIconName };

interface AvailableTile {
  key: string;
  href: string;
  icon: TileIcon;
  tone: Tone;
  titleKey: MehrKey;
  descKey: MehrKey;
  /** neue Module bekommen den „Neu"-Badge */
  isNew?: boolean;
  /** PRO-Funktion — trägt zusätzlich ein „PRO"-Badge (Gate bleibt serverseitig) */
  isPro?: boolean;
  /** nur für Vereins-Admins (owner/admin/moderator) sichtbar */
  adminOnly?: boolean;
}

interface SoonTile {
  key: string;
  icon: TileIcon;
  titleKey: MehrKey;
  descKey: MehrKey;
}

/** Neue Module zuerst (mit Badge), danach die bereits gebauten Bereiche. */
const AVAILABLE: AvailableTile[] = [
  { key: "news", href: "/news", icon: { mehr: "news" }, tone: "brand", titleKey: "news", descKey: "newsDesc", isNew: true },
  { key: "notes", href: "/notizen", icon: { mehr: "note" }, tone: "info", titleKey: "notes", descKey: "notesDesc", isNew: true },
  { key: "exercises", href: "/uebungen", icon: { mehr: "exercise" }, tone: "success", titleKey: "exercises", descKey: "exercisesDesc", isNew: true },
  { key: "family", href: "/familie", icon: { mehr: "family" }, tone: "warn", titleKey: "family", descKey: "familyDesc", isNew: true },
  { key: "facility", href: "/belegungsplan", icon: { mehr: "facility" }, tone: "info", titleKey: "facility", descKey: "facilityDesc", isNew: true },
  { key: "equipment", href: "/ausruestung", icon: { mehr: "equipment" }, tone: "success", titleKey: "equipment", descKey: "equipmentDesc", isNew: true },
  { key: "medal", href: "/medaillen", icon: { mehr: "medal" }, tone: "warn", titleKey: "medal", descKey: "medalDesc", isNew: true },
  { key: "trainingplan", href: "/trainingsplan", icon: { mehr: "trainingplan" }, tone: "brand", titleKey: "trainingplan", descKey: "trainingplanDesc", isNew: true },
  { key: "hours", href: "/pflichtstunden", icon: { mehr: "hours" }, tone: "info", titleKey: "hours", descKey: "hoursDesc", isNew: true },
  { key: "chart", href: "/auswertung", icon: { mehr: "chart" }, tone: "success", titleKey: "chart", descKey: "chartDesc", isNew: true },
  { key: "chat", href: "/chat", icon: { mehr: "chat" }, tone: "brand", titleKey: "chat", descKey: "chatDesc", isNew: true },
  { key: "checkin", href: "/checkin", icon: { mehr: "checkin" }, tone: "success", titleKey: "checkin", descKey: "checkinDesc", isNew: true },
  { key: "regevents", href: "/events", icon: { mehr: "regevents" }, tone: "warn", titleKey: "regevents", descKey: "regeventsDesc", isNew: true },
  { key: "gallery", href: "/galerie", icon: { mehr: "gallery" }, tone: "info", titleKey: "gallery", descKey: "galleryDesc", isNew: true, isPro: true },
  { key: "document", href: "/dokumente", icon: { mehr: "document" }, tone: "success", titleKey: "document", descKey: "documentDesc", isNew: true, isPro: true },
  { key: "teams", href: "/teams", icon: { shell: "teams" }, tone: "info", titleKey: "teams", descKey: "teamsDesc", isNew: true },
  { key: "sparten", href: "/sparten", icon: { shell: "sparkle" }, tone: "brand", titleKey: "sparten", descKey: "spartenDesc", isNew: true },
  { key: "departments", href: "/abteilungen", icon: { mehr: "department" }, tone: "info", titleKey: "departments", descKey: "departmentsDesc", isNew: true },
  { key: "lockers", href: "/schliessfaecher", icon: { mehr: "locker" }, tone: "success", titleKey: "lockers", descKey: "lockersDesc", isNew: true },
  { key: "anniversaries", href: "/jubilaeen", icon: { mehr: "anniversary" }, tone: "warn", titleKey: "anniversaries", descKey: "anniversariesDesc", isNew: true },
  { key: "waitlists", href: "/wartelisten", icon: { mehr: "waitlist" }, tone: "info", titleKey: "waitlists", descKey: "waitlistsDesc", isNew: true },
  { key: "events", href: "/termine", icon: { shell: "events" }, tone: "brand", titleKey: "events", descKey: "eventsDesc" },
  { key: "members", href: "/mitglieder", icon: { shell: "members" }, tone: "info", titleKey: "members", descKey: "membersDesc" },
  { key: "routines", href: "/kueren", icon: { shell: "routines" }, tone: "neutral", titleKey: "routines", descKey: "routinesDesc" },
  { key: "competition", href: "/wettkampf", icon: { shell: "competition" }, tone: "warn", titleKey: "competition", descKey: "competitionDesc" },
  { key: "finance", href: "/finanzen", icon: { shell: "finance" }, tone: "success", titleKey: "finance", descKey: "financeDesc" },
  { key: "manage", href: "/verwaltung", icon: { shell: "shield" }, tone: "neutral", titleKey: "manage", descKey: "manageDesc", adminOnly: true },
];

/**
 * Noch nicht gebaute Module. Aktuell leer — Galerie und Dokumente sind live
 * (siehe AVAILABLE). Kommen weitere Module hinzu, erscheinen sie hier wieder als
 * dezente, nicht klickbare Kacheln mit „Bald"-Badge; solange leer, zeigt der
 * Abschnitt nur eine „Weitere Module folgen"-Zeile.
 */
const SOON: SoonTile[] = [];

function renderIcon(icon: TileIcon): ReactNode {
  return "shell" in icon ? (
    <Icon name={icon.shell} className="ic h-5 w-5" />
  ) : (
    <MehrIcon name={icon.mehr} className="ic h-5 w-5" />
  );
}

/** Tinted Icon-Kachel im „m"-Format der IconTile (38 px, radius-md). */
function TileGlyph({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`grid h-[38px] w-[38px] flex-none place-items-center rounded-md ${TONE_CLASS[tone]}`}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

export function MehrHub() {
  const t = useT(mehrDict);
  const me = useData((repo) => repo.getCurrentUser());
  const isClubAdmin = permissions(me.data ?? null).isClubAdmin;
  /**
   * `listEffectiveModules` (0077) statt `listClubModules`: Der Server
   * beantwortet damit nicht nur „gekauft und eingeschaltet?", sondern auch die
   * vierte Frage — „wird diese Kachel DIESER Person überhaupt angeboten?" — und
   * liefert die Liste FERTIG GEFILTERT.
   *
   * Vorher hing die Seite an `available` und zeigte deshalb jedem Mitglied alle
   * 26 Kacheln, auch Auswertung, Schließfächer, Jubiläen, Wartelisten, Gruppen
   * und Finanzen. Genau das war Marcels Einwand („als Mitglied unter ‚Mehr' so
   * viele Module"). Serverseitig war es mit 0077 gelöst und in der iOS-App
   * nachgezogen — im Web nicht.
   *
   * AUSBLENDEN IST KEIN ZUGRIFFSSCHUTZ. Wer die Adresse kennt, kommt weiter auf
   * die Seite; was er dort sieht, entscheidet allein die RLS. Hier geht es um
   * ein Menü, das nicht mit Dingen zugestellt ist, die man nicht darf.
   *
   * Geladen wird die Liste im ModulesProvider, nicht hier: Seitenleiste, untere
   * Leiste und diese Seite fragen dieselbe Antwort ab. Zwei getrennte Ladungen
   * könnten sich für einen Moment widersprechen — und ein Menü, das sich selbst
   * widerspricht, ist schlimmer als eines, das zu viel zeigt.
   */
  const { isModuleVisible: istModulSichtbar } = useModules();

  /**
   * Kachel -> Modul. Nur „Sparten" braucht eine Zuordnung: Sparten sind kein
   * eigenes Modul, sie hängen an „departments" (im UI „Gruppen"). Ohne diese
   * Zeile verschwände die Sparten-Kachel für alle, weil ihr Schlüssel in keiner
   * Antwort vorkommt.
   */
  const MODUL_ZUR_KACHEL: Record<string, string> = { sparten: "departments" };

  const isModuleVisible = (key: string) => istModulSichtbar(MODUL_ZUR_KACHEL[key] ?? key);

  // Zähler für die „Wartelisten"-Kachel: wartende Einträge (Trainer+), dieselbe
  // Zahl wie das „Mehr"-Nav-Badge. 0 → kein Badge (Hook liefert 0 für Nicht-Trainer).
  const waitlistWaiting = useWaitlistWaitingCount();

  const available = AVAILABLE.filter(
    (tile) => (!tile.adminOnly || isClubAdmin) && isModuleVisible(tile.key),
  );

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-7">
      <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("title")} sub={t("sub")} />

      <section className="grid gap-3">
        <SectionHeader level={2} title={t("sectionAvailable")} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {available.map((tile) => {
            const title = t(tile.titleKey);
            return (
              <Link
                key={tile.key}
                href={tile.href}
                aria-label={t("openTile", { title })}
                className="group flex items-center gap-4 rounded-xl border border-line bg-surface p-5 shadow-card no-underline transition-colors duration-150 hover:border-line-strong hover:bg-sunken"
              >
                <TileGlyph tone={tile.tone}>{renderIcon(tile.icon)}</TileGlyph>
                <span className="grid min-w-0 gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <b className="font-display text-[15px] font-bold tracking-[-0.01em] text-ink">
                      {title}
                    </b>
                    {tile.isNew && <Badge tone="brand">{t("badgeNew")}</Badge>}
                    {tile.isPro && <Badge tone="warn">{t("badgePro")}</Badge>}
                    {tile.key === "waitlists" && waitlistWaiting > 0 && (
                      <Badge tone="info">{waitlistWaiting}</Badge>
                    )}
                  </span>
                  <span className="text-[13px] leading-snug text-ink-soft">{t(tile.descKey)}</span>
                </span>
                <Icon
                  name="chevronRight"
                  className="ic ml-auto h-4 w-4 flex-none text-ink-faint transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-ink"
                />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3">
        <SectionHeader
          level={2}
          title={t("sectionSoon")}
          sub={SOON.length > 0 ? t("soonSub") : undefined}
        />
        {SOON.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SOON.map((tile) => {
              const title = t(tile.titleKey);
              return (
                <div
                  key={tile.key}
                  aria-disabled="true"
                  aria-label={t("soonAria", { title })}
                  className="flex cursor-default items-center gap-4 rounded-xl border border-dashed border-line bg-surface p-5 opacity-70"
                >
                  <TileGlyph tone="neutral">{renderIcon(tile.icon)}</TileGlyph>
                  <span className="grid min-w-0 gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <b className="font-display text-[15px] font-bold tracking-[-0.01em] text-ink-soft">
                        {title}
                      </b>
                      <Badge tone="neutral">{t("badgeSoon")}</Badge>
                    </span>
                    <span className="text-[13px] leading-snug text-ink-faint">{t(tile.descKey)}</span>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-line bg-surface px-5 py-4 text-[13px] text-ink-faint">
            {t("soonEmpty")}
          </p>
        )}
      </section>
    </div>
  );
}
