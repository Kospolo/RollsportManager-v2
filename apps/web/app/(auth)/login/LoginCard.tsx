"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Icon } from "@/components/shell/icons";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { BrandMark, LanguageChip } from "@/app/_landing/chrome";
import { loginDict } from "./i18n";

/**
 * Login (Demo-Modus): zentrierte Karte mit E-Mail+Passwort und
 * Apple/Google-Mock-Buttons. Jede Anmeldung führt optimistisch
 * zu /dashboard — keine echte Authentifizierung in dieser Phase.
 */

/** Monochrome Marken-Glyphen (currentColor — keine Fremdfarben im Heimspiel-Look). */
function AppleGlyph() {
  return (
    <svg viewBox="0 0 384 512" className="h-[17px] w-[17px]" fill="currentColor" aria-hidden="true">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 488 512" className="h-[16px] w-[16px]" fill="currentColor" aria-hidden="true">
      <path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z" />
    </svg>
  );
}

export function LoginCard() {
  const t = useT(loginDict);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [showForgotHint, setShowForgotHint] = useState(false);

  /** Demo-Anmeldung: kurzer Pending-Moment, dann ins Portal. */
  function signIn() {
    if (pending) return;
    setPending(true);
    window.setTimeout(() => router.push("/dashboard"), 450);
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
        <div className="w-full max-w-[420px]">
          {/* Demo-Hinweis: Farbe + Wort + Icon — nie nur Farbe */}
          <p className="mb-4 flex items-center gap-2.5 rounded-lg bg-info-soft px-4 py-3 text-[13.5px] font-bold text-info">
            <Icon name="sparkle" className="ic h-[17px] w-[17px] flex-none" />
            {t("demoBanner")}
          </p>

          <Card className="shadow-pop">
            <h1 className="font-display text-[22px] font-extrabold leading-7 tracking-tight text-ink">
              {t("title")}
            </h1>
            <p className="mt-1 text-body text-ink-soft">{t("sub")}</p>

            <div className="mt-5 grid gap-2.5">
              <Button type="button" variant="ghost" className="w-full" onClick={signIn} disabled={pending}>
                <AppleGlyph />
                {t("apple")}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={signIn} disabled={pending}>
                <GoogleGlyph />
                {t("google")}
              </Button>
            </div>

            <div className="my-5 flex items-center gap-3" role="separator" aria-label={t("divider")}>
              <span className="h-px flex-1 bg-line" aria-hidden="true" />
              <span className="text-caption font-semibold text-ink-faint">{t("divider")}</span>
              <span className="h-px flex-1 bg-line" aria-hidden="true" />
            </div>

            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                signIn();
              }}
            >
              <Input
                label={t("emailLabel")}
                type="email"
                name="email"
                autoComplete="email"
                placeholder={t("emailPlaceholder")}
                disabled={pending}
              />
              <div className="grid gap-1.5">
                <Input
                  label={t("passwordLabel")}
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  placeholder={t("passwordPlaceholder")}
                  disabled={pending}
                />
                <button
                  type="button"
                  onClick={() => setShowForgotHint((v) => !v)}
                  aria-expanded={showForgotHint}
                  className="justify-self-end rounded-sm py-1 text-caption font-semibold text-brand-ink hover:underline"
                >
                  {t("forgot")}
                </button>
                {showForgotHint && (
                  <p className="rounded-md bg-sunken px-3.5 py-2.5 text-caption leading-[18px] text-ink-soft">
                    {t("forgotHint")}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? t("submitting") : t("submit")}
              </Button>
            </form>
          </Card>

          <p className="mt-5 text-center text-body text-ink-soft">
            {t("noAccount")}{" "}
            <Link href="/#preise" className="font-bold text-brand-ink no-underline hover:underline">
              {t("seePlans")}
            </Link>
          </p>
          <p className="mt-1.5 text-center">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-1 text-caption font-semibold text-ink-faint no-underline hover:text-ink"
            >
              <Icon name="chevronRight" className="ic h-3.5 w-3.5 rotate-180" />
              {t("backHome")}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
