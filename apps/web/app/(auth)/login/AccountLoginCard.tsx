"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { authLogin, authRegister } from "@/lib/auth";
import { ApiError } from "@/lib/data/errors";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Icon } from "@/components/shell/icons";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { BrandMark, LanguageChip } from "@/app/_landing/chrome";
import { loginDict } from "./i18n";
import { DevLoginCard } from "./DevLoginCard";

/**
 * ECHTE Anmeldung (api-Modus, NEXT_PUBLIC_DATA_SOURCE=api): E-Mail + Passwort
 * gegen die produktive API. Ein Umschalter „Konto erstellen“ blendet zusaetzlich
 * das Namensfeld ein und ruft dann /auth/register statt /auth/login.
 *
 * Nach Erfolg fuellt authLogin/authRegister die Session (inkl. aktivem Verein,
 * falls vorhanden) und wir leiten weiter: Plattform-Admins in die
 * Betreiber-Konsole (/super), alle anderen ins Portal (/dashboard). Wer noch
 * keinen Verein hat, faengt dort das „Kein Verein“-Onboarding ab
 * (components/shell/OnboardingGate.tsx).
 *
 * Personas (Dev-Login) sind hier NUR ausserhalb von Produktion erreichbar —
 * `process.env.NODE_ENV` wird zur Build-Zeit eingesetzt, in Produktions-Builds
 * ist die Abkuerzung nicht vorhanden. So gibt es in production-api niemals
 * Test-Personas.
 */

const MIN_PASSWORD = 8;
const DEV_PERSONAS_ENABLED = process.env.NODE_ENV !== "production";

type Mode = "signin" | "register";

export function AccountLoginCard() {
  const t = useT(loginDict);
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
  const [showPersonas, setShowPersonas] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dev-Abkuerzung: die Persona-Karten (nur ausserhalb von Produktion).
  if (DEV_PERSONAS_ENABLED && showPersonas) {
    return <DevLoginCard onBack={() => setShowPersonas(false)} />;
  }

  const isRegister = mode === "register";
  const canSubmit =
    email.trim() !== "" &&
    password.length >= MIN_PASSWORD &&
    (!isRegister || name.trim() !== "") &&
    !pending;

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (password.length < MIN_PASSWORD) {
      setError(t("accErrPasswordShort"));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const session = isRegister
        ? await authRegister(email, password, name)
        : await authLogin(email, password);
      const dest = session.profile.is_platform_admin ? "/super" : "/dashboard";
      router.push(dest);
    } catch (err) {
      setPending(false);
      if (err instanceof ApiError && err.status === 401) {
        setError(t("accErrInvalid"));
      } else if (err instanceof ApiError && err.status === 409) {
        setError(t("accErrExists"));
      } else if (err instanceof ApiError && err.status === 429) {
        const secs = /(\d+)\s*Sekunden|(\d+)\s*seconds/.exec(err.problem?.detail ?? "");
        setError(t("accErrRateLimited", { seconds: secs?.[1] ?? secs?.[2] ?? "60" }));
      } else {
        setError(
          t("accErrGeneric", { message: err instanceof Error ? err.message : String(err) }),
        );
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
        <div className="w-full max-w-[420px]">
          <Card className="shadow-pop">
            <h1 className="font-display text-[22px] font-extrabold leading-7 tracking-tight text-ink">
              {isRegister ? t("registerTitle") : t("signInTitle")}
            </h1>
            <p className="mt-1 text-body text-ink-soft">
              {isRegister ? t("registerSub") : t("signInSub")}
            </p>

            <form className="mt-5 grid gap-4" onSubmit={submit} noValidate>
              {isRegister && (
                <Input
                  label={t("nameLabel")}
                  type="text"
                  name="name"
                  autoComplete="name"
                  placeholder={t("namePlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={pending}
                  required
                />
              )}
              <Input
                label={t("accEmailLabel")}
                type="email"
                name="email"
                autoComplete="email"
                placeholder={t("accEmailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={pending}
                required
              />
              <div className="grid gap-1.5">
                <Input
                  label={t("accPasswordLabel")}
                  type="password"
                  name="password"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  placeholder={t("accPasswordPlaceholder")}
                  hint={isRegister ? t("accPasswordHintRegister") : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={pending}
                  minLength={MIN_PASSWORD}
                  required
                />
                {!isRegister && (
                  <Link
                    href="/passwort-neu"
                    className="justify-self-end rounded-sm py-1 text-caption font-semibold text-brand-ink hover:underline"
                  >
                    {t("accForgot")}
                  </Link>
                )}
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-lg bg-danger-soft px-3.5 py-2.5 text-[13px] font-semibold text-danger-ink"
                >
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {pending
                  ? isRegister
                    ? t("accRegistering")
                    : t("accSigningIn")
                  : isRegister
                    ? t("accRegister")
                    : t("accSignIn")}
              </Button>
            </form>

            <div className="mt-4 border-t border-line pt-4 text-center">
              <button
                type="button"
                onClick={() => switchMode(isRegister ? "signin" : "register")}
                className="rounded-sm text-body font-semibold text-brand-ink hover:underline"
              >
                {isRegister ? t("switchToSignIn") : t("switchToRegister")}
              </button>
            </div>
          </Card>

          {DEV_PERSONAS_ENABLED && (
            <p className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setShowPersonas(true)}
                className="inline-flex items-center gap-1.5 rounded-sm text-caption font-semibold text-ink-faint hover:text-ink"
              >
                <Icon name="zap" className="ic h-3.5 w-3.5" />
                {t("devPersonasLink")}
              </button>
            </p>
          )}

          <p className="mt-4 text-center">
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
