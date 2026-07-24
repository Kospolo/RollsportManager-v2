"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as mock from "@/lib/mock";
import { VIEWER_STORAGE_KEY } from "@/components/shell/BetaViewerBoundary";

/**
 * Auswahl der Demo-Person für die Beta.
 *
 * Bewusst KEINE vollständige Mitgliederliste: 33 Namen helfen niemandem beim
 * Prüfen. Hier stehen genau die Personen, an denen sich die Rollen
 * unterscheiden — je eine pro Rolle plus Mutter und Kind, weil sich daran der
 * Kinderschutz zeigt.
 *
 * Die Kennungen sind fest, Name und Rolle kommen aus den Demo-Daten. Fällt
 * eine Kennung weg, verschwindet die Karte sichtbar, statt still einen
 * falschen Namen zu zeigen.
 */
const AUSWAHL: Array<{ id: string; hinweis: string }> = [
  { id: "m-02", hinweis: "Vorstand. Sieht alles — alle 26 Module, Finanzen, Verwaltung." },
  { id: "m-04", hinweis: "Verwaltung ohne Vorstandsrechte." },
  { id: "m-03", hinweis: "Kassenwart: Finanzen und Mahnwesen, aber keine Vereinsverwaltung." },
  { id: "m-01", hinweis: "Trainerin zweier Teams. Sieht Trainer-Notizen der eigenen Schützlinge. (Vorgabe)" },
  { id: "m-06", hinweis: "Gast-Trainerin mit befristetem Zugang — der engste Trainer-Zuschnitt." },
  { id: "m-09", hinweis: "Mutter von Lina und Emma. Sieht ihre Kinder, aber keine fremden." },
  { id: "m-07", hinweis: "Kind (Jahrgang 2014). Die engste Sicht überhaupt — hier zeigt sich, was ein Kind NICHT sehen darf." },
];

const ROLLEN_NAME: Record<string, string> = {
  owner: "Inhaber:in / Vorstand",
  admin: "Verwaltung",
  treasurer: "Kassenwart:in",
  coach: "Trainer:in",
  guest_coach: "Gast-Trainer:in",
  member: "Mitglied",
};

export function EntwicklerClient() {
  const router = useRouter();
  const [aktiv, setAktiv] = useState<string | null>(null);

  // Erst nach dem Mounten lesen: Diese Seite wird ebenfalls statisch
  // vorgerendert, und localStorage gibt es dort nicht.
  useEffect(() => {
    try {
      setAktiv(window.localStorage.getItem(VIEWER_STORAGE_KEY) ?? mock.currentUser.id);
    } catch {
      setAktiv(mock.currentUser.id);
    }
  }, []);

  function waehle(id: string) {
    try {
      window.localStorage.setItem(VIEWER_STORAGE_KEY, id);
    } catch {
      // Ohne Speicher kein Wechsel — dann bleibt es bei der Vorgabe.
    }
    setAktiv(id);
    router.push("/dashboard");
  }

  function zuruecksetzen() {
    try {
      window.localStorage.removeItem(VIEWER_STORAGE_KEY);
    } catch {
      /* egal */
    }
    // Harter Neuaufbau: Die Vorgabe steht bereits im vorgerenderten HTML,
    // ein Neuladen ist der ehrlichste Weg zurück auf Anfang.
    window.location.assign("/entwickler");
  }

  return (
    <div className="min-h-dvh bg-canvas px-4 py-10 lg:px-8">
      <div className="mx-auto grid w-full max-w-3xl gap-6">
        <header className="grid gap-2">
          <p className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
            Beta — interne Ansicht
          </p>
          <h1 className="font-display text-h2 tracking-[-0.01em] text-ink">
            Portal durch fremde Augen ansehen
          </h1>
          <p className="max-w-prose text-ink-soft">
            Die Beta läuft mit Demo-Daten und ohne echte Anmeldung. Wähle hier, als wen du das
            Portal sehen willst — die Auswahl bleibt in diesem Browser gespeichert, bis du sie
            zurücksetzt. Sie wirkt auf alle Seiten: Menü, Kacheln unter „Mehr", Finanzen,
            Trainer-Notizen.
          </p>
          <p className="max-w-prose text-caption text-ink-faint">
            Diese Seite ist nirgends verlinkt und für Suchmaschinen gesperrt. Sie schaltet nur die
            Anzeige um — einen echten Zugriffsschutz gibt es hier nicht zu umgehen, weil hinter der
            Beta keine Datenbank steht.
          </p>
        </header>

        <ul className="grid gap-3">
          {AUSWAHL.map(({ id, hinweis }) => {
            const person = mock.memberById(id);
            if (!person) {
              return (
                <li
                  key={id}
                  className="rounded-xl border border-line bg-surface px-4 py-3 text-caption text-ink-faint"
                >
                  Demo-Person <code>{id}</code> gibt es nicht mehr — Auswahlliste anpassen.
                </li>
              );
            }
            const istAktiv = aktiv === id;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => waehle(id)}
                  aria-current={istAktiv ? "true" : undefined}
                  className={`w-full rounded-xl border px-4 py-3.5 text-left transition ${
                    istAktiv
                      ? "border-brand bg-brand-soft"
                      : "border-line bg-surface hover:border-line-strong"
                  }`}
                >
                  <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <span className="font-semibold text-ink">{mock.fullName(person)}</span>
                    <span className="text-caption font-semibold text-brand">
                      {ROLLEN_NAME[person.role] ?? person.role}
                    </span>
                    {istAktiv ? (
                      <span className="ml-auto text-caption font-semibold text-brand">
                        aktuell aktiv
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-caption text-ink-soft">{hinweis}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center gap-4 border-t border-line pt-5">
          <button
            type="button"
            onClick={zuruecksetzen}
            className="text-caption font-semibold text-ink-soft underline underline-offset-4 hover:text-ink"
          >
            Auf Vorgabe zurücksetzen (Sandra Vogel)
          </button>
          <Link
            href="/dashboard"
            className="text-caption font-semibold text-brand underline underline-offset-4"
          >
            Zum Portal
          </Link>
          <Link
            href="/"
            className="text-caption font-semibold text-ink-soft underline underline-offset-4 hover:text-ink"
          >
            Zur Startseite
          </Link>
        </div>
      </div>
    </div>
  );
}
