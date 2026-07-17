"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { errorMessage, fullName, isNotImplemented, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { Member } from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { FilterChips, type FilterChipOption } from "@/components/ui/FilterChips";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Icon } from "@/components/shell/icons";
import { InviteSheet } from "./InviteSheet";
import { AboutMeSheet } from "./AboutMeSheet";
import { MemberCard } from "./MemberCard";
import { mitgliederDict } from "./i18n";
import {
  groupMembers,
  matchesRoleFilter,
  softNotImplemented,
  type GroupMode,
  type RoleFilter,
} from "./derive";

/**
 * Mitglieder-VERZEICHNIS (vorher: Tabelle). Menschen zuerst — große Porträts,
 * Karten statt Zeilen, Suche + Rollen-Filter + Team-Gruppierung darüber.
 *
 * WAS HIER BEWUSST NICHT MEHR STEHT: Beitragsampel, Beitrittsdatum und
 * Trainingsbeteiligung. Das Verzeichnis ist der Ort, an dem sich der Verein
 * begegnet — nicht die Debitorenliste. Zahlen/Beiträge leben in /finanzen,
 * die Trainingsbeteiligung im Steckbrief (dort rollen-gegated).
 *
 * SKALIERUNG: 24 Mitglieder im Demo, entworfen für 300. Statt einer
 * Virtualisierungs-Bibliothek (die mit variabel hohen Karten und Gruppierung
 * schlecht zusammengeht) rendern wir gestückelt („Weitere anzeigen") und
 * überlassen dem Browser das Auslassen unsichtbarer Karten
 * (content-visibility). Kein Layout-Sprung, kein Scroll-Hijacking,
 * keine Abhängigkeit.
 */

const FILTERS: RoleFilter[] = ["all", "board", "treasurer", "coach", "member", "guest"];

const FILTER_LABEL_KEY = {
  all: "fAll",
  board: "fBoard",
  treasurer: "fTreasurer",
  coach: "fCoach",
  member: "fMember",
  guest: "fGuest",
} as const;

const GROUPS: GroupMode[] = ["none", "team"];
const GROUP_LABEL_KEY = { none: "groupNone", team: "groupTeam" } as const;

/** Erste Stückelung — reicht für den Demo-Verein komplett, deckelt große Vereine. */
const PAGE_SIZE = 48;

const NO_MEMBERS: Member[] = [];

function sortMembers(members: Member[]): Member[] {
  return [...members].sort(
    (a, b) => a.lastName.localeCompare(b.lastName, "de") || a.firstName.localeCompare(b.firstName, "de"),
  );
}

export function MembersClient() {
  const t = useT(mitgliederDict);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RoleFilter>("all");
  const [group, setGroup] = useState<GroupMode>("none");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const state = useData((repo) =>
    Promise.all([
      repo.getMembers(),
      softNotImplemented(repo.getTeams()),
      repo.getCurrentUser(),
    ] as const),
  );

  const allMembers = state.data?.[0] ?? NO_MEMBERS;
  const teams = state.data?.[1] ?? null;
  const currentUser = state.data?.[2] ?? null;

  const perms = permissions(currentUser);
  /** Einladen bleibt Verwaltungs-/Finanz-Rollen vorbehalten (Server: owner/admin). */
  const canInvite = perms.canManageMembers || perms.isPlatformAdmin;

  const all = useMemo(() => sortMembers(allMembers), [allMembers]);

  const searched = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return all;
    // Auch im Selbst-Profil suchen: „wer läuft Kür?" ist eine echte Frage.
    return all.filter(
      (member) =>
        fullName(member).toLowerCase().includes(needle) ||
        (member.aboutMe ?? "").toLowerCase().includes(needle),
    );
  }, [all, query]);

  const rows = useMemo(
    () => searched.filter((member) => matchesRoleFilter(member, filter)),
    [searched, filter],
  );

  const filterOptions: FilterChipOption<RoleFilter>[] = FILTERS.map((value) => ({
    value,
    label: t(FILTER_LABEL_KEY[value]),
    count: searched.filter((member) => matchesRoleFilter(member, value)).length,
  }));

  const groupOptions: FilterChipOption<GroupMode>[] = GROUPS.map((value) => ({
    value,
    label: t(GROUP_LABEL_KEY[value]),
  }));

  /** Stückelung greift VOR der Gruppierung — sonst wüchse die Seite pro Gruppe. */
  const visible = rows.slice(0, limit);
  const groups = useMemo(() => groupMembers(visible, teams, group), [visible, teams, group]);
  const hasMore = rows.length > visible.length;

  const resetFilters = () => {
    setQuery("");
    setFilter("all");
    setLimit(PAGE_SIZE);
  };

  const myAbout = currentUser?.aboutMe ?? "";

  let body: React.ReactNode;
  if (state.status === "loading") {
    body = (
      <>
        <div className="flex flex-wrap items-center gap-3" aria-hidden="true">
          <Skeleton className="h-11 w-full rounded-full sm:w-72" />
          <Skeleton className="h-9 w-72 max-w-full rounded-full" />
        </div>
        {/* Karten-Skelett in der ECHTEN Kartengröße — reserviert den Platz, den
            die Karten einnehmen werden (kein Layout-Sprung beim Eintreffen). */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-72 rounded-xl" />
          ))}
        </div>
      </>
    );
  } else if (state.status === "error") {
    body = isNotImplemented(state.error) ? (
      <EmptyState icon="sparkle" title={t("niTitle")} body={t("niBody")} />
    ) : (
      <EmptyState
        icon="zap"
        title={t("loadErrorTitle")}
        body={errorMessage(state.error)}
        action={<Button onClick={state.reload}>{t("retry")}</Button>}
      />
    );
  } else if (rows.length === 0) {
    body = (
      <>
        <Controls />
        <EmptyState
          icon="members"
          title={t("emptyTitle")}
          body={t("emptyBody")}
          action={
            <Button variant="secondary" onClick={resetFilters}>
              {t("emptyReset")}
            </Button>
          }
        />
      </>
    );
  } else {
    body = (
      <>
        <Controls />

        <div className="grid gap-7">
          {groups.map((entry) => {
            const title = entry.key === "teamless" ? t("groupTeamless") : entry.title;
            return (
              <section key={entry.key} className="grid gap-3">
                {title && (
                  <h2 className="flex items-baseline gap-2 font-display text-h3 tracking-[-0.01em] text-ink">
                    {title}
                    <span className="text-caption font-semibold text-ink-faint tabular-nums">
                      {t("groupCount", { n: entry.members.length })}
                    </span>
                  </h2>
                )}
                {/* items-stretch (Default): gleiche Höhe pro Reihe. Der große
                    Porträt-Kopf gibt jeder Karte Masse; unter dem Inhalt bleibt
                    ruhige Fläche statt einer ausgefransten Unterkante. */}
                <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
                  {entry.members.map((member) => (
                    <li
                      key={member.id}
                      className="grid"
                      // Große Vereine: unsichtbare Karten überspringt der Browser.
                      // contain-intrinsic-size hält die Scrollhöhe stabil.
                      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 340px" }}
                    >
                      <MemberCard
                        member={member}
                        teams={teams}
                        isSelf={member.id === currentUser?.id}
                        canMessage={member.id !== currentUser?.id}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <p aria-live="polite" className="text-caption text-ink-faint tabular-nums">
            {t("showingOf", { shown: visible.length, total: rows.length })}
          </p>
          {hasMore && (
            <Button variant="ghost" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
              {t("showMore", { n: Math.min(PAGE_SIZE, rows.length - visible.length) })}
            </Button>
          )}
        </div>
      </>
    );
  }

  /** Such-/Filterleiste — als Closure, damit sie Leer- und Trefferfall teilt. */
  function Controls() {
    return (
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative flex min-h-11 w-full items-center sm:w-72">
            <span className="sr-only">{t("searchLabel")}</span>
            <Icon
              name="search"
              className="ic pointer-events-none absolute left-4 h-4 w-4 text-ink-faint"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setLimit(PAGE_SIZE);
              }}
              placeholder={t("searchPlaceholder")}
              className="min-h-11 w-full rounded-full border border-transparent bg-sunken pl-10 pr-4 text-body text-ink placeholder:text-ink-faint"
            />
          </label>
          <FilterChips
            options={filterOptions}
            value={filter}
            onChange={(value) => {
              setFilter(value);
              setLimit(PAGE_SIZE);
            }}
            label={t("filterLabel")}
          />
        </div>
        {/* Gruppierung nur anbieten, wenn Teams wirklich da sind — sonst wäre
            der Schalter eine Lüge (api-Modus: Contract-Lücke). */}
        {teams !== null && teams.length > 0 && (
          <FilterChips
            options={groupOptions}
            value={group}
            onChange={setGroup}
            label={t("groupLabel")}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <SectionHeader
        level={1}
        title={t("title")}
        sub={
          state.status === "ready"
            ? all.length === 1
              ? t("dirCountOne")
              : t("dirCount", { n: all.length })
            : t("sub")
        }
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            {/* „Über mich" ist die Einstiegs-Handlung für JEDES Mitglied —
                auch für die, die sonst keinen einzigen Knopf auf dieser Seite
                haben. Deshalb steht sie hier oben und nicht irgendwo unten. */}
            {state.status === "ready" && currentUser && (
              <Button
                variant={canInvite ? "ghost" : "secondary"}
                icon="edit"
                onClick={() => setAboutOpen(true)}
              >
                {myAbout ? t("aboutEditCta") : t("aboutAddCta")}
              </Button>
            )}
            {canInvite && (
              <Button icon="plus" onClick={() => setInviteOpen(true)}>
                {t("invite")}
              </Button>
            )}
          </div>
        }
      />

      {body}

      <InviteSheet open={inviteOpen} onClose={() => setInviteOpen(false)} />
      {aboutOpen && (
        <AboutMeSheet
          key={myAbout}
          open={aboutOpen}
          initial={myAbout}
          onClose={() => setAboutOpen(false)}
          onSaved={state.reload}
        />
      )}
    </div>
  );
}
