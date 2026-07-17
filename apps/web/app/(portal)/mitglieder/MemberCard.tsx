"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";
import { fullName } from "@/lib/data";
import type { Member, Team } from "@/lib/types";
import { PortraitTile } from "@/components/ui/PortraitTile";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { mitgliederDict, roleKey } from "./i18n";
import { chatHref, ROLE_TONE, teamNames } from "./derive";

/**
 * Die Mitglieder-Karte — „Menschen zuerst" (DESIGN-SYSTEM §1, Leitprinzip 1)
 * endlich wörtlich: ein großes Porträt trägt die Karte, dann erst die
 * Einordnung. Rollkunstlauf ist ein SICHTBARER Sport — die Karte zeigt das.
 *
 * DAS PORTRÄT FÜLLT DIE KARTE. Ein echtes Foto (avatarUrl) wirkt hier groß und
 * schön. Der Normalfall ist aber „kein Foto" — dann steht statt eines Lochs ein
 * gestaltetes Monogramm im Ton der Person (PortraitTile, warmer Verlauf +
 * Craft-Textur). „Größere Bilder" heißt hier NICHT „großes Loch, wo kein Foto
 * ist".
 *
 * ENTWORFEN FÜR DEN SPARSAMEN FALL. Ein plain member zeigt Porträt, Name,
 * Rolle, — wenn vorhanden — Jahrgang, Team(s) und Selbst-Profil. KEINE „—",
 * keine leeren Zeilen: was die API redigiert (birth_date, email …), kommt als
 * null und wird schlicht weggelassen. Ein null-Feld ist kein Fehler.
 *
 * GLEICHE HÖHE PRO REIHE: Die Liste stretcht die Karten (items-stretch, h-full).
 * Der Porträt-Kopf ist bei allen gleich hoch; unter dem Inhalt bleibt ruhige
 * Fläche statt einer ausgefransten Kante.
 */

/** Chat-Bubble — bewusst KEINE Briefmarke: der Weg führt in den Chat, nicht
 *  ins Postfach (die E-Mail darf ein Mitglied ohnehin nicht sehen). Lokal
 *  inline, um den geteilten Icon-Satz nicht anzufassen. */
function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" aria-hidden="true">
      <path
        d="M20 11.5a7.5 7.5 0 0 1-10.9 6.7L4.5 19.5l1.3-4.4A7.5 7.5 0 1 1 20 11.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MemberCard({
  member,
  teams,
  isSelf,
  canMessage,
}: {
  member: Member;
  /** null ⇒ Teams nicht angebunden — dann gar keine Team-Zeile (nie „—"). */
  teams: Team[] | null;
  isSelf: boolean;
  /** Direktnachricht anbieten? (self → nein; Chat-Modul aus → nein) */
  canMessage: boolean;
}) {
  const t = useT(mitgliederDict);
  const name = fullName(member);
  const names = teams === null ? [] : teamNames(member, teams);
  const about = member.aboutMe?.trim();
  // Jahrgang NUR wenn das Datum wirklich da ist. Fehlt es (Erwachsene im Mock,
  // serverseitig redigiert im api-Modus), bleibt die Zeile weg — nie „—".
  const birthYear = member.birthDate?.slice(0, 4);

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-card transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-pop focus-within:border-brand">
      {/* Porträt-Kopf, randlos. Der Name-Link deckt später die ganze Karte ab
          (::before) — der Nachrichten-Knopf liegt per z-10 darüber. */}
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        <PortraitTile
          personId={member.id}
          firstName={member.firstName}
          lastName={member.lastName}
          avatarUrl={member.avatarUrl}
        />
      </div>

      <div className="relative flex flex-1 flex-col gap-2.5 p-4">
        {/* Nachricht: ruhiger Icon-Knopf, sitzt am Übergang Porträt↔Körper.
            Standard leise (Surface, ink-soft), on-hover Beere — der Name bleibt
            das Lauteste. min 44 px Touch-Ziel (DESIGN-SYSTEM, nicht verhandelbar). */}
        {canMessage && (
          <Link
            href={chatHref(member.id)}
            aria-label={t("messageAria", { name })}
            className="absolute -top-6 right-4 z-10 grid h-11 w-11 place-items-center rounded-full border border-line bg-surface text-ink-soft shadow-card transition-[background-color,color,transform,border-color] duration-150 hover:border-transparent hover:bg-brand hover:text-brand-contrast focus-visible:border-transparent focus-visible:bg-brand focus-visible:text-brand-contrast active:scale-95"
          >
            <ChatIcon />
          </Link>
        )}

        <div className="grid gap-1.5">
          <h3 className="min-w-0 pr-12">
            {/* Der Ring von globals.css (:focus-visible) liegt um den Namen —
                das fokussierte Element — während ::before die ganze Karte
                klickbar macht. */}
            <Link
              href={`/mitglieder/${member.id}`}
              aria-label={t("cardOpen", { name })}
              className="font-display text-[19px] font-extrabold leading-[1.15] tracking-[-0.01em] text-ink no-underline before:absolute before:inset-0 before:content-[''] hover:underline"
            >
              {name}
            </Link>
          </h3>

          <span className="flex flex-wrap items-center gap-1.5">
            <StatusPill tone={ROLE_TONE[member.role]}>{t(roleKey(member.role))}</StatusPill>
            {birthYear && (
              <span className="text-caption font-semibold text-ink-faint tabular-nums">
                {t("bornYear", { year: birthYear })}
              </span>
            )}
            {isSelf && <Badge tone="brand">{t("youBadge")}</Badge>}
            {member.status === "pending" && <Badge tone="info">{t("statusPending")}</Badge>}
            {member.status === "inactive" && <Badge tone="neutral">{t("statusInactive")}</Badge>}
          </span>
        </div>

        {/* Teams: keine ⇒ keine Zeile. „kein Team" ist eine Aussage über die
            Person, „—" wäre eine über unser Datenmodell — letzteres nie. */}
        {names.length > 0 && (
          <span className="flex flex-wrap gap-1.5">
            {names.map((teamName) => (
              <Badge key={teamName} tone="neutral">
                {teamName}
              </Badge>
            ))}
          </span>
        )}

        {/* Selbst-Profil: der einzige freiwillige Text — als warmes Zitat.
            Fehlt er, endet die Karte hier. Das ist kein Mangel, das ist normal. */}
        {about && (
          <p className="mt-0.5 line-clamp-2 border-l-2 border-line-strong pl-2.5 text-[13px] leading-[19px] text-ink-soft">
            {about}
          </p>
        )}
      </div>
    </article>
  );
}
