"use client";

import type { Dict } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n";
import { useData } from "@/lib/data/useData";
import type { PublicClub } from "@/lib/types";

/**
 * Login-freies Vereinsverzeichnis (Kachel-/Slider-Ansicht). Rein lesend über
 * die Facade; es werden ausschließlich die vom Server freigegebenen,
 * nicht-personenbezogenen Felder gezeigt.
 */
const vereineDict = {
  de: {
    eyebrow: "Vereinsverzeichnis",
    title: "Vereine, die RollsportManager nutzen",
    sub: "Finde einen Rollkunstlauf- oder Eiskunstlauf-Verein in deiner Nähe. Nur Vereine, die ihr Profil öffentlich freigegeben haben.",
    loading: "Vereine werden geladen …",
    errorTitle: "Verzeichnis konnte nicht geladen werden",
    errorBody: "Bitte später erneut versuchen.",
    emptyTitle: "Noch keine öffentlichen Vereine",
    emptyBody: "Sobald Vereine ihr Profil freigeben, erscheinen sie hier.",
    retry: "Erneut versuchen",
  },
  en: {
    eyebrow: "Club directory",
    title: "Clubs using RollsportManager",
    sub: "Find a roller- or figure-skating club near you. Only clubs that made their profile public.",
    loading: "Loading clubs …",
    errorTitle: "The directory could not be loaded",
    errorBody: "Please try again later.",
    emptyTitle: "No public clubs yet",
    emptyBody: "As soon as clubs make their profile public, they appear here.",
    retry: "Try again",
  },
} satisfies Dict;

/** Initialen aus dem Vereinsnamen (Fallback, wenn kein Logo hinterlegt ist). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

function ClubCard({ club }: { club: PublicClub }) {
  const meta = [club.city, club.discipline].filter(Boolean).join(" · ");
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center gap-3">
        {club.publicImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={club.publicImage}
            alt=""
            className="h-12 w-12 flex-none rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid h-12 w-12 flex-none place-items-center rounded-full bg-brand-soft text-[15px] font-bold text-brand"
          >
            {initials(club.name)}
          </span>
        )}
        <span className="grid min-w-0">
          <b className="truncate font-display text-[16px] font-bold tracking-[-0.01em] text-ink">
            {club.name}
          </b>
          {meta && <span className="truncate text-[12.5px] text-ink-faint">{meta}</span>}
        </span>
      </div>
      {club.publicDescription && (
        <p className="text-[14px] leading-[20px] text-ink-soft">{club.publicDescription}</p>
      )}
    </li>
  );
}

export function VereineClient() {
  const t = useT(vereineDict);
  useLocale();
  const state = useData((repo) => repo.listPublicClubs());

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 lg:px-8">
      <header className="grid gap-2">
        <p className="text-caption font-semibold uppercase tracking-wide text-brand">
          {t("eyebrow")}
        </p>
        <h1 className="font-display text-h2 tracking-[-0.01em] text-ink">{t("title")}</h1>
        <p className="max-w-prose text-ink-soft">{t("sub")}</p>
      </header>

      {state.status === "loading" ? (
        <p className="text-ink-faint">{t("loading")}</p>
      ) : state.status === "error" ? (
        <div className="grid gap-2 rounded-xl border border-line bg-surface p-6">
          <b className="text-ink">{t("errorTitle")}</b>
          <p className="text-ink-soft">{t("errorBody")}</p>
          <button
            type="button"
            onClick={state.reload}
            className="justify-self-start rounded-full bg-brand px-4 py-2 text-[13px] font-semibold text-white"
          >
            {t("retry")}
          </button>
        </div>
      ) : state.data.length === 0 ? (
        <div className="grid gap-1 rounded-xl border border-line bg-surface p-8 text-center">
          <b className="text-ink">{t("emptyTitle")}</b>
          <p className="text-ink-soft">{t("emptyBody")}</p>
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {state.data.map((club) => (
            <ClubCard key={club.id} club={club} />
          ))}
        </ul>
      )}
    </main>
  );
}
