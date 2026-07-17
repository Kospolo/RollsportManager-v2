"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useT } from "@/lib/i18n";
import {
  DEV_PERSONA_CARDS,
  DevStackDownError,
  useAuth,
  type DevPersonaKey,
} from "@/lib/auth";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/shell/icons";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { BrandMark, LanguageChip } from "@/app/_landing/chrome";
import { loginDict } from "./i18n";

/**
 * Dev-Login (NUR api-Modus, NEXT_PUBLIC_DATA_SOURCE=api): Persona-Auswahl
 * als Karten → POST /dev/login gegen den lokalen Stack, Token in
 * localStorage (rsm.dev.auth), danach /dashboard. Läuft der Stack nicht,
 * gibt es einen Klartext-Hinweis auf `scripts/dev-stack.sh up`.
 */
export function DevLoginCard() {
  const t = useT(loginDict);
  const { locale } = useLocale();
  const { signIn } = useAuth();
  const router = useRouter();

  const [pendingKey, setPendingKey] = useState<DevPersonaKey | null>(null);
  const [error, setError] = useState<"stack_down" | string | null>(null);

  async function loginAs(key: DevPersonaKey) {
    if (pendingKey) return;
    setPendingKey(key);
    setError(null);
    try {
      await signIn(key);
      // Ziel nach Rolle: der Plattform-Admin hat keinen Verein und gehoert in
      // die Betreiber-Konsole (/dashboard verlangt einen Verein und wies ihn ab
      // -> "Kein Zugriff"). Ein vereinsloser Neuling legt einen an / tritt bei.
      const dest = key === "platform" ? "/super" : key === "neuling" ? "/registrieren" : "/dashboard";
      router.push(dest);
    } catch (e) {
      setPendingKey(null);
      if (e instanceof DevStackDownError) {
        setError("stack_down");
      } else {
        setError(t("devErrorGeneric", { message: e instanceof Error ? e.message : String(e) }));
      }
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <BrandMark />
        <div className="ml-auto flex items-center gap-2.5">
          <ThemeToggle />
          <LanguageChip />
        </div>
      </header>

      <main className="grid flex-1 place-items-center px-4 pb-14 pt-6">
        <div className="w-full max-w-[560px]">
          {/* Dev-Hinweis: Farbe + Wort + Icon — nie nur Farbe */}
          <p className="mb-4 flex items-center gap-2.5 rounded-lg bg-info-soft px-4 py-3 text-[13.5px] font-bold text-info">
            <Icon name="zap" className="ic h-[17px] w-[17px] flex-none" />
            {t("devBanner")}
          </p>

          <section className="rounded-xl border border-line bg-surface p-6 shadow-pop">
            <h1 className="font-display text-[22px] font-extrabold leading-7 tracking-tight text-ink">
              {t("devTitle")}
            </h1>
            <p className="mt-1 text-body text-ink-soft">{t("devSub")}</p>

            {error === "stack_down" && (
              <div
                role="alert"
                className="mt-5 rounded-lg border border-line bg-sunken px-4 py-3.5"
              >
                <p className="flex items-center gap-2 text-[13.5px] font-bold text-danger">
                  <Icon name="zap" className="ic h-4 w-4 flex-none" />
                  {t("devErrorTitle")}
                </p>
                <p className="mt-1 text-caption text-ink-soft">{t("devErrorBody")}</p>
                <code className="mt-2 block rounded-md bg-canvas px-3 py-2 font-mono text-[12.5px] text-ink">
                  scripts/dev-stack.sh up
                </code>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => setError(null)}
                >
                  {t("devErrorRetry")}
                </Button>
              </div>
            )}
            {error !== null && error !== "stack_down" && (
              <p role="alert" className="mt-5 rounded-lg bg-sunken px-4 py-3 text-[13.5px] font-semibold text-danger">
                {error}
              </p>
            )}

            <ul className="mt-5 grid gap-2.5" aria-busy={pendingKey !== null}>
              {DEV_PERSONA_CARDS.map((persona) => {
                const isPending = pendingKey === persona.key;
                return (
                  <li key={persona.key}>
                    <button
                      type="button"
                      onClick={() => loginAs(persona.key)}
                      disabled={pendingKey !== null}
                      className="flex w-full items-center gap-3.5 rounded-xl border border-line bg-surface px-4 py-3 text-left transition-colors duration-150 hover:border-line-strong hover:bg-sunken disabled:pointer-events-none disabled:opacity-55"
                    >
                      <Avatar
                        personId={persona.memberId}
                        firstName={persona.displayName.split(" ")[0]}
                        lastName={persona.displayName.split(" ").slice(1).join(" ")}
                        size="l"
                      />
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[14.5px] font-bold text-ink">
                          {persona.displayName}
                          <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[11.5px] font-bold text-brand-ink">
                            {persona.role[locale]}
                          </span>
                        </b>
                        <span className="mt-0.5 block truncate text-caption text-ink-soft">
                          {isPending ? t("devSigningIn") : persona.description[locale]}
                        </span>
                      </span>
                      <Icon
                        name="chevronRight"
                        className="ic h-4 w-4 flex-none text-ink-faint"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
