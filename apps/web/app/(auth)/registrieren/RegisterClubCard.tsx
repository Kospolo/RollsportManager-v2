"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useT } from "@/lib/i18n";
import { setSessionClub, useAuth } from "@/lib/auth";
import { data, dataSource } from "@/lib/data";
import { ApiError } from "@/lib/data/errors";
import type { RegisteredClub } from "@/lib/data/inputs-registrierung";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Icon } from "@/components/shell/icons";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { BrandMark, LanguageChip } from "@/app/_landing/chrome";
import { registrierenDict } from "./i18n";

/**
 * Vereins-Selbstanlage.
 *
 * Nur Name + Ort. Wer beim Ausprobieren nach dem Vereinsregister-Auszug fragt,
 * bekommt niemanden zum Ausprobieren — Registernummer und Zahlungsdaten kommen
 * beim Upgrade.
 *
 * Zustimmung wird EINZELN abgefragt (Bedingungen / Datenschutz). Ein einzelner
 * Sammel-Haken waere bequemer und nach Art. 7 Abs. 2 DSGVO unwirksam; der
 * Server nimmt ohnehin nur `true` an (z.literal(true)).
 *
 * Die Identitaet kommt in dieser Phase aus dem Dev-Login (Persona 'neuling') —
 * GoTrue ist der naechste Schritt. Der Ablauf ist damit vollstaendig testbar,
 * ohne auf Mailversand zu warten.
 */
export function RegisterClubCard() {
  const t = useT(registrierenDict);
  const { locale } = useLocale();
  const router = useRouter();
  const { session, status } = useAuth();

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [shortName, setShortName] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<RegisteredClub | null>(null);
  const [copied, setCopied] = useState(false);

  // Im api-Modus braucht die Anlage einen Token: der Server macht den AUFRUFER
  // zum Inhaber und kann das ohne `sub` nicht. Kein anonymes POST /clubs.
  const needsLogin = dataSource === "api" && status !== "loading" && session === null;

  const canSubmit =
    name.trim().length >= 2 && city.trim().length >= 2 && terms && privacy && !pending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    try {
      const club = await data.registerClub({
        name: name.trim(),
        city: city.trim(),
        shortName: shortName.trim() || undefined,
        discipline: discipline.trim() || undefined,
        acceptTerms: terms,
        acceptPrivacy: privacy,
      });
      // Ohne das zeigt das Portal weiter den Seed-Verein und begruesst die
      // frisch gebackene Inhaberin mit "Keine Mitgliedschaft in diesem Verein".
      // Der Token bleibt unberuehrt — die Rechte kommen aus der DB (0025).
      if (dataSource === "api") setSessionClub(club.clubId, "owner", club.ownerMemberId);
      setDone(club);
    } catch (err) {
      setPending(false);
      if (err instanceof ApiError && err.status === 429) {
        const secs = /(\d+)\s*Sekunden/.exec(err.problem?.detail ?? "")?.[1] ?? "60";
        setError(t("errorRateLimited", { seconds: secs }));
      } else {
        setError(
          t("errorGeneric", { message: err instanceof Error ? err.message : String(err) }),
        );
      }
    }
  }

  async function copyCode() {
    if (!done) return;
    await navigator.clipboard.writeText(done.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            <div className="grid gap-1.5">
              <span
                className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand-ink"
                aria-hidden="true"
              >
                <Icon name="check" className="ic h-6 w-6" />
              </span>
              <h1 className="font-display text-h2 tracking-[-0.015em] text-ink">
                {t("successTitle", { club: done.clubName })}
              </h1>
              <p className="text-[14px] text-ink-soft">{t("successSub")}</p>
            </div>

            <div className="grid gap-2">
              <output
                className="rounded-xl border border-line bg-surface-sunken px-4 py-3 text-center font-mono text-h3 tracking-[0.12em] tabular-nums text-ink"
                aria-label={done.joinCode}
              >
                {done.joinCode}
              </output>
              <Button type="button" variant="secondary" onClick={copyCode}>
                <Icon name={copied ? "check" : "copy"} className="ic h-4 w-4" />
                {copied ? t("codeCopied") : t("copyCode")}
              </Button>
            </div>

            {/* Die wichtigste Zeile der Seite: der Code ist KEIN Zutritt. */}
            <p className="rounded-xl bg-surface-sunken px-3.5 py-3 text-[13px] leading-relaxed text-ink-soft">
              {t("codeHint")}
            </p>
            <p className="text-[13px] text-ink-faint">
              {t("successTrial", {
                date: new Date(done.trialEndsAt).toLocaleDateString(
                  locale === "de" ? "de-DE" : "en-GB",
                  { day: "numeric", month: "long", year: "numeric" },
                ),
              })}
            </p>

            <Button type="button" onClick={() => router.push("/dashboard")}>
              {t("toPortal")}
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
                  label={t("nameLabel")}
                  placeholder={t("namePlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="organization"
                  required
                />
                <Input
                  label={t("cityLabel")}
                  placeholder={t("cityPlaceholder")}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  autoComplete="address-level2"
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label={t("shortLabel")}
                    placeholder={t("shortPlaceholder")}
                    value={shortName}
                    onChange={(e) => setShortName(e.target.value)}
                  />
                  <Input
                    label={t("disciplineLabel")}
                    placeholder={t("disciplinePlaceholder")}
                    value={discipline}
                    onChange={(e) => setDiscipline(e.target.value)}
                  />
                </div>

                {/*
                  KENNTNISNAHME — Pflicht-Haken, und sie stehen ALLEIN. Keine
                  freiwillige Einwilligung daneben: Pflichtiges neben
                  Freiwilligem laesst das Freiwillige wie Pflicht wirken
                  (Kopplungsverbot, Art. 7 Abs. 4 DSGVO).
                */}
                <fieldset className="grid gap-2.5">
                  <legend className="mb-1 text-[13px] font-semibold text-ink">
                    {t("ackTitle")}
                  </legend>
                  <label className="flex items-start gap-2.5 text-[13px] text-ink-soft">
                    <input
                      type="checkbox"
                      checked={terms}
                      onChange={(e) => setTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 flex-none accent-[var(--brand)]"
                    />
                    <span>{t("ackTerms")}</span>
                  </label>
                  <label className="flex items-start gap-2.5 text-[13px] text-ink-soft">
                    <input
                      type="checkbox"
                      checked={privacy}
                      onChange={(e) => setPrivacy(e.target.checked)}
                      className="mt-0.5 h-4 w-4 flex-none accent-[var(--brand)]"
                    />
                    <span>{t("ackPrivacy")}</span>
                  </label>
                  <p className="text-[12px] leading-relaxed text-ink-faint">{t("ackHint")}</p>
                </fieldset>

                {error ? (
                  <p role="alert" className="text-[13px] font-semibold text-danger-ink">
                    {error}
                  </p>
                ) : null}

                <Button type="submit" disabled={!canSubmit}>
                  {pending ? t("submitting") : t("submit")}
                </Button>
                <p className="text-[12px] leading-relaxed text-ink-faint">{t("trialNote")}</p>
              </form>
            )}
          </Card>
        )}

        {!done ? (
          <p className="text-center text-[13px] text-ink-soft">
            {t("haveCode")}{" "}
            <Link href="/beitreten" className="font-semibold text-brand-ink underline-offset-2 hover:underline">
              {t("joinInstead")}
            </Link>
          </p>
        ) : null}
      </div>
    </main>
  );
}
