"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { data, dataSource } from "@/lib/data";
import { ApiError } from "@/lib/data/errors";
import type { AcceptedInvitation, InvitationInfo } from "@/lib/data/inputs-registrierung";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Icon } from "@/components/shell/icons";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { BrandMark, LanguageChip } from "@/app/_landing/chrome";
import { einladungDict } from "../i18n";

/**
 * Annahme einer Einladung.
 *
 * ### Der Ablauf ###
 * 1. Vorschau OEFFENTLICH laden (Vereinsname + Rolle). Schlaegt sie fehl, ist
 *    der Token ungueltig/abgelaufen/verbraucht — dann EINE neutrale Meldung,
 *    kein Hinweis, welcher Fall es war (der Server sagt selbst nur 404).
 * 2. Im api-Modus muss man angemeldet sein, um anzunehmen — die Mitgliedschaft
 *    haengt am eigenen Konto. Der Vereinsname wird trotzdem schon gezeigt.
 * 3. Annehmen -> AKTIVE Mitgliedschaft (der Vorstand hat gezielt eingeladen,
 *    der Token IST die Freigabe — anders als der geteilte Vereinscode).
 *
 * Echte Einwilligungen (Fotos/Rundschreiben) werden hier NICHT abgefragt; nur
 * die alterslose Kenntnisnahme (Vertrag/Datenschutz). Ein wirkliches Kind wird
 * ueber den Familienpfad angelegt, nicht per Selbstannahme.
 */
export function AcceptInvitationCard({ token }: { token: string }) {
  const t = useT(einladungDict);
  const router = useRouter();
  const { session, status } = useAuth();

  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [invalid, setInvalid] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<AcceptedInvitation | null>(null);

  // Vorschau laden (oeffentlich, kein Login).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await data.getInvitation(token);
        if (alive) setInfo(res);
      } catch {
        // Jeder Fehlschlag ist dieselbe neutrale Absage.
        if (alive) setInvalid(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  const needsLogin = dataSource === "api" && status !== "loading" && session === null;
  const canSubmit =
    firstName.trim() !== "" && lastName.trim() !== "" && terms && privacy && !pending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    try {
      setDone(
        await data.acceptInvitation({
          token,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          acceptTerms: terms,
          acceptPrivacy: privacy,
        }),
      );
    } catch (err) {
      setPending(false);
      if (err instanceof ApiError && err.status === 404) {
        // Token zwischenzeitlich ungueltig/verbraucht — dieselbe neutrale Sicht.
        setInvalid(true);
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

        {loading ? (
          <Card className="grid gap-4 p-6">
            <p className="text-[14px] text-ink-soft">{t("loadingTitle")}</p>
          </Card>
        ) : invalid ? (
          <Card className="grid gap-5 p-6">
            <span
              className="grid h-11 w-11 place-items-center rounded-full bg-danger-soft text-danger-ink"
              aria-hidden="true"
            >
              <Icon name="close" className="ic h-6 w-6" />
            </span>
            <div className="grid gap-1.5">
              <h1 className="font-display text-h2 tracking-[-0.015em] text-ink">{t("invalidTitle")}</h1>
              <p className="text-[14px] text-ink-soft">{t("invalidSub")}</p>
            </div>
            <Button type="button" variant="secondary" onClick={() => router.push("/login")}>
              {t("backToLogin")}
            </Button>
          </Card>
        ) : done ? (
          <Card className="grid gap-5 p-6">
            <span
              className="grid h-11 w-11 place-items-center rounded-full bg-success-soft text-success-ink"
              aria-hidden="true"
            >
              <Icon name="check" className="ic h-6 w-6" />
            </span>
            <div className="grid gap-1.5">
              <h1 className="font-display text-h2 tracking-[-0.015em] text-ink">{t("successTitle")}</h1>
              <p className="text-[14px] text-ink-soft">{t("successSub", { club: done.clubName })}</p>
            </div>
            <Button type="button" onClick={() => router.push("/dashboard")}>
              {t("toPortal")}
            </Button>
          </Card>
        ) : (
          <Card className="grid gap-5 p-6">
            <div className="grid gap-1">
              <h1 className="font-display text-h2 tracking-[-0.015em] text-ink">{t("title")}</h1>
              <p className="text-[14px] text-ink-soft">
                {t("sub", { club: info?.clubName ?? "" })}
              </p>
              {info?.role ? (
                <p className="text-[13px] text-ink-faint">{t("roleNote", { role: info.role })}</p>
              ) : null}
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

                {/*
                  KENNTNISNAHME — Pflicht-Haken, ALLEIN (kein freiwilliges
                  Kontrollkaestchen daneben). Kopplungsverbot Art. 7 Abs. 4 DSGVO:
                  Pflichtiges neben Freiwilligem laesst das Freiwillige wie
                  Pflicht wirken und macht es unwirksam.
                */}
                <fieldset className="grid gap-2.5">
                  <legend className="mb-1 text-[13px] font-semibold text-ink">{t("ackTitle")}</legend>
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

                <p className="text-[12px] leading-relaxed text-ink-faint">{t("consentLaterNote")}</p>

                {error ? (
                  <p role="alert" className="text-[13px] font-semibold text-danger-ink">
                    {error}
                  </p>
                ) : null}

                <Button type="submit" disabled={!canSubmit}>
                  {pending ? t("submitting") : t("submit")}
                </Button>
                <p className="text-[12px] leading-relaxed text-ink-faint">{t("acceptNote")}</p>
              </form>
            )}
          </Card>
        )}
      </div>
    </main>
  );
}
