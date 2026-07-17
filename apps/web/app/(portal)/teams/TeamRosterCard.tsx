"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";
import { fullName } from "@/lib/data";
import type { Member } from "@/lib/types";
import { PortraitTile } from "@/components/ui/PortraitTile";
import { StatusPill } from "@/components/ui/Badge";
import { teamsViewDict } from "./i18n";
import { ROLE_TONE, roleKey } from "./derive";

/**
 * Kader-Karte der Team-Detailseite — „Menschen zuerst" (DESIGN-SYSTEM §1) im
 * GLEICHEN Charakter wie die Mitglieder-Karte (MemberCard): ein großes Porträt
 * trägt die Karte, darunter Name, Rolle und — wenn vorhanden — Jahrgang.
 *
 * DIE GANZE KARTE IST EIN LINK ins 360-Profil (/mitglieder/{id}). Das Profil
 * dahinter staffelt serverseitig selbst, was der/die Betrachter:in sehen darf
 * — hier wird NICHTS an Rechten entschieden, nur verlinkt.
 *
 * BEWUSST SCHLICHTER als MemberCard: kein Nachrichten-Knopf, keine Team-Badges
 * (wir SIND im Team-Kontext). So bleibt die Karte im Kader ruhig und der Klick
 * eindeutig — ein Ziel pro Karte (das Profil).
 */
export function TeamRosterCard({ member }: { member: Member }) {
  const t = useT(teamsViewDict);
  const name = fullName(member);
  // Jahrgang NUR wenn das Datum wirklich da ist (bei Kindern serverseitig oft
  // redigiert → null). Fehlt es, bleibt die Zeile weg — nie „—".
  const birthYear = member.birthDate?.slice(0, 4);

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-card transition-[border-color,box-shadow,transform] duration-150 hover:border-line-strong hover:shadow-pop focus-within:border-brand active:scale-[0.99]">
      {/* Porträt-Kopf, randlos — großes Foto oder gestaltetes Monogramm. */}
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        <PortraitTile
          personId={member.id}
          firstName={member.firstName}
          lastName={member.lastName}
          avatarUrl={member.avatarUrl}
        />
      </div>

      <div className="relative flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="min-w-0">
          {/* ::before macht die ganze Karte klickbar; der Fokusring von
              globals.css liegt um den Namen (das fokussierte Element). */}
          <Link
            href={`/mitglieder/${member.id}`}
            aria-label={t("openProfileAria", { name })}
            className="font-display text-[18px] font-extrabold leading-[1.15] tracking-[-0.01em] text-ink no-underline before:absolute before:inset-0 before:content-[''] hover:underline"
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
        </span>
      </div>
    </article>
  );
}
