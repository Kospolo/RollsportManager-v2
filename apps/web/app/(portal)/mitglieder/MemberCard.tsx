"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";
import { fullName } from "@/lib/data";
import type { Member, Team } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { mitgliederDict, roleKey } from "./i18n";
import { chatHref, ROLE_TONE, teamNames } from "./derive";

/**
 * Die Mitglieder-Karte — „Menschen zuerst" (DESIGN-SYSTEM §1, Leitprinzip 1)
 * endlich wörtlich genommen: großes Porträt, Name im Display-Font, dann erst
 * Einordnung.
 *
 * ENTWORFEN FÜR DEN SPARSAMEN FALL. Ein plain member sieht nur Name, Porträt,
 * Rolle, Team(s) und — falls vorhanden — das Selbst-Profil. Genau das ist die
 * vollständige Karte, kein Rest davon: es gibt KEINE Platzhalter, KEINE „—",
 * keine leeren Zeilen. Was die API redigiert (birth_date, email, joined_on …),
 * kommt als null an und wird schlicht nicht gerendert — ein null-Feld darf nie
 * wie ein Fehler oder wie eine Sperre aussehen.
 *
 * Foto ist die AUSNAHME, nicht die Regel: 22 von 24 Demo-Mitgliedern haben
 * keines. Deshalb trägt das farbige Monogramm (Avatar-Signatur, Hash aus der
 * personId) die Karte in voller Größe — „größere Bilder" heißt hier bewusst
 * NICHT „großes Loch, wo kein Foto ist".
 */

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

  return (
    <article className="relative flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-card transition-colors duration-150 hover:border-line-strong focus-within:border-brand">
      {/* Kopf: Porträt + Name, mittig zueinander. Der Link deckt die Karte ab
          (::before), damit die ganze Fläche klickbar ist — der Nachrichten-Knopf
          liegt per z-10 darüber. */}
      <div className="flex items-center gap-4">
        <Avatar
          personId={member.id}
          firstName={member.firstName}
          lastName={member.lastName}
          avatarUrl={member.avatarUrl}
          size="xl"
        />
        <div className="grid min-w-0 flex-1 gap-1.5">
          <h3 className="min-w-0">
            {/* KEIN focus-visible:outline-none: globals.css gibt jedem
                :focus-visible den 3-px-Beere-Ring (DESIGN-SYSTEM §2.7). Der Ring
                liegt um den Namen — das fokussierte Element — während ::before
                die ganze Karte klickbar macht. */}
            <Link
              href={`/mitglieder/${member.id}`}
              aria-label={t("cardOpen", { name })}
              className="font-display text-[18px] font-extrabold leading-[1.2] tracking-[-0.01em] text-ink no-underline before:absolute before:inset-0 before:content-[''] hover:underline"
            >
              {name}
            </Link>
          </h3>
          <span className="flex flex-wrap items-center gap-1.5">
            <StatusPill tone={ROLE_TONE[member.role]}>{t(roleKey(member.role))}</StatusPill>
            {isSelf && <Badge tone="brand">{t("youBadge")}</Badge>}
            {member.status === "pending" && <Badge tone="info">{t("statusPending")}</Badge>}
            {member.status === "inactive" && <Badge tone="neutral">{t("statusInactive")}</Badge>}
          </span>
        </div>
      </div>

      {/* Teams über die volle Breite — neben dem Porträt bleibt für zwei
          Team-Namen schlicht kein Platz, sie brächen dort hässlich um.
          Keine Teams ⇒ keine Zeile: „kein Team" ist eine Aussage über die
          Person, „—" wäre eine über unser Datenmodell — letzteres nie. */}
      {names.length > 0 && (
        <span className="-mt-1 flex flex-wrap gap-1.5">
          {names.map((teamName) => (
            <Badge key={teamName} tone="neutral">
              {teamName}
            </Badge>
          ))}
        </span>
      )}

      {/* Selbst-Profil: der einzige freiwillige Text — bekommt darum Raum.
          Fehlt er, endet die Karte hier. Das ist kein Mangel, das ist normal. */}
      {about && (
        <p className="line-clamp-3 text-[13.5px] leading-[20px] text-ink-soft">{about}</p>
      )}

      {/* KEIN mt-auto: der Knopf folgt dem Inhalt. Würde er nach unten gedrückt,
          bekäme jede Karte ohne „Über mich" ein Loch in der Höhe der längsten
          Karte ihrer Reihe — und genau das soll hier nie passieren. */}
      {canMessage && (
        <div className="flex justify-end pt-0.5">
          {/* Bewusst OHNE Icon: „mail" wäre der einzige passende Bestand und
              würde E-Mail versprechen — die ein Mitglied gar nicht sehen darf.
              Der Weg führt in den Chat, nicht ins Postfach.
              min-h-11 = 44 px: „Touch-Ziele ≥ 44 px (auch Desktop)" ist laut
              DESIGN-SYSTEM nicht verhandelbar; die 36-px-Variante ist nur für
              Tabellenzeilen/Karten-Köpfe erlaubt, nicht für diese Aktion. */}
          <Link
            href={chatHref(member.id)}
            aria-label={t("messageAria", { name })}
            className="relative z-10 inline-flex min-h-11 items-center rounded-full bg-brand-soft px-4 text-[13px] font-bold text-brand-ink no-underline transition-colors duration-150 hover:bg-brand hover:text-brand-contrast"
          >
            {t("messageCta")}
          </Link>
        </div>
      )}
    </article>
  );
}
