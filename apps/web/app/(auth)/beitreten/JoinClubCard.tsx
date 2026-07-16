"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { data, dataSource } from "@/lib/data";
import { ApiError } from "@/lib/data/errors";
import type { JoinRequestResult } from "@/lib/data/inputs-registrierung";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Icon } from "@/components/shell/icons";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { BrandMark, LanguageChip } from "@/app/_landing/chrome";
import { beitretenDict } from "./i18n";

/**
 * Beitritt per Vereinscode.
 *
 * ### Was diese Seite bewusst NICHT tut ###
 * Sie prueft den Code nicht vorab und sagt nie, ob es ihn gibt. Der Server
 * antwortet auf "unbekannt", "abgelaufen" und "widerrufen" mit derselben 404
 * (registration.ts invalidCode) — jede Unterscheidung waere ein Orakel zum
 * Durchprobieren. Diese Oberflaeche gibt genau das weiter: EINE Meldung.
 *
 * Sie verspricht auch keinen Zugang. Ein richtiger Code fuehrt zu
 * status='pending' — deshalb steht der Hinweis "oeffnet die Warteschlange,
 * nicht die Tuer" schon VOR dem Absenden und nicht erst hinterher.
 */
export function JoinClubCard() {
  const t = useT(beitretenDict);
  const router = useRouter();
  const { session, status } = useAuth();

  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<JoinRequestResult | null>(null);

  const needsLogin = dataSource === "api" && status !== "loading" && session === null;
  const canSubmit =
    code.trim().length >= 4 &&
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    terms &&
    privacy &&
    !pending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    try {
      setDone(
        await data.requestJoin({
          code: code.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          acceptTerms: terms,
          acceptPrivacy: privacy,
        }),
      );
    } catch (err) {
      setPending(false);
      if (err instanceof ApiError && err.status === 429) {
        const secs = /(\d+)\s*Sekunden/.exec(err.problem?.detail ?? "")?.[1] ?? "60";
        setError(t("errorRateLimited", { seconds: secs }));
      } else if (err instanceof ApiError && err.status === 409) {
        setError(t("errorAlready"));
      } else if (err instanceof ApiError && err.status === 404) {
        // EINE Meldung fuer jeden Fehlschlag — wir wissen selbst nicht, welcher
        // Fall es war, und das ist Absicht.
        setError(t("errorInvalid"));
      } else {
        setError(t("errorGeneric", { message: err instanceof Error ? err.message : String(err) }));
      }
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="grid w-full max-w-[440px] gap-6">
        <div className="flex items-center justify-between">
          <BrandMark />
          <div className="flex items-center gap-2">
            <LanguageChip />
            <ThemeToggle />
          </div>
        </div>

        {done ? (
          <Card className="grid gap-5 p-6">
            <span
              className="grid h-11 w-11 place-items-center rounded-full bg-warn-soft text-warn-ink"
              aria-hidden="true"
            >
              <Icon name="clock" className="ic h-6 w-6" />
            </span>
            <div className="grid gap-1.5">
              <h1 className="font-display text-h2 tracking-[-0.015em] text-ink">
                {t("successTitle")}
              </h1>
              <p className="text-[14px] text-ink-soft">
                {t("successSub", { club: done.clubName })}
              </p>
            </div>
            <p className="rounded-xl bg-surface-sunken px-3.5 py-3 text-[13px] font-semibold text-ink-soft">
              {t("successStatus")}
            </p>
            <p className="text-[13px] text-ink-faint">{t("successHint")}</p>
            <Button type="button" variant="secondary" onClick={() => router.push("/login")}>
              {t("backToLogin")}
            </Button>
          </Card>
        ) : (
          <Card className="grid gap-5 p-6">
            <div className="grid gap-1">
              <h1 className="font-display text-h2 tracking-[-0.015em] text-ink">{t("title")}</h1>
              <p className="text-[14px] text-ink-soft">{t("sub")}</p>
            </div>

            {needsLogin ? (
              <div className="grid gap-3">
                <p className="rounded-xl bg-surface-sunken px-3.5 py-3 text-[13px] text-ink-soft">
                  {t("needLogin")}
                </p>
                <Button type="button" onClick={() => router.push("/login")}>
                  {t("toLogin")}
                </Button>
              </div>
            ) : (
              <form className="grid gap-4" onSubmit={submit} noValidate>
                <Input
                  label={t("codeLabel")}
                  hint={t("codeHint")}
                  placeholder={t("codePlaceholder")}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="font-mono tracking-[0.1em]"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label={t("firstNameLabel")}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                    required
                  />
                  <Input
                    label={t("lastNameLabel")}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                    required
                  />
                </div>

                <fieldset className="grid gap-2.5">
                  <label className="flex items-start gap-2.5 text-[13px] text-ink-soft">
                    <input
                      type="checkbox"
                      checked={terms}
                      onChange={(e) => setTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 flex-none accent-[var(--brand)]"
                    />
                    <span>{t("consentTerms")}</span>
                  </label>
                  <label className="flex items-start gap-2.5 text-[13px] text-ink-soft">
                    <input
                      type="checkbox"
                      checked={privacy}
                      onChange={(e) => setPrivacy(e.target.checked)}
                      className="mt-0.5 h-4 w-4 flex-none accent-[var(--brand)]"
                    />
                    <span>{t("consentPrivacy")}</span>
                  </label>
                </fieldset>

                {error ? (
                  <p role="alert" className="text-[13px] font-semibold text-danger-ink">
                    {error}
                  </p>
                ) : null}

                <Button type="submit" disabled={!canSubmit}>
                  {pending ? t("submitting") : t("submit")}
                </Button>
                <p className="text-[12px] leading-relaxed text-ink-faint">{t("requestNote")}</p>
              </form>
            )}
          </Card>
        )}

        {!done ? (
          <p className="text-center text-[13px] text-ink-soft">
            {t("noCode")}{" "}
            <Link
              href="/registrieren"
              className="font-semibold text-brand-ink underline-offset-2 hover:underline"
            >
              {t("registerInstead")}
            </Link>
          </p>
        ) : null}
      </div>
    </main>
  );
}
