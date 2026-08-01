"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset, confirmPasswordReset } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { ApiError } from "@/lib/data/errors";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Icon } from "@/components/shell/icons";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { BrandMark, LanguageChip } from "@/app/_landing/chrome";
import { passwortDict } from "./i18n";

/**
 * Passwort-Seite mit ZWEI Zustaenden, gesteuert allein durch den `token`-Prop
 * (kommt aus ?token= im Link der Reset-E-Mail, siehe page.tsx):
 *
 *  - token vorhanden  -> „neues Passwort setzen“ (confirmPasswordReset)
 *  - token fehlt      -> „Link anfordern“ (requestPasswordReset)
 *
 * Die Anforderung bestaetigt IMMER neutral (kein „Konto nicht gefunden“) — der
 * Server unterscheidet die Faelle bewusst nicht, damit sich keine E-Mails
 * durchprobieren lassen. Diese Seite gibt genau das weiter.
 */

const MIN_PASSWORD = 8;

export function PasswordResetCard({ token }: { token: string | null }) {
  const t = useT(passwortDict);
  const hasToken = token !== null && token !== "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function rateLimitSeconds(detail: string | undefined): string {
    const m = /(\d+)\s*Sekunden|(\d+)\s*seconds/.exec(detail ?? "");
    return m?.[1] ?? m?.[2] ?? "60";
  }

  async function submitRequest(event: React.FormEvent) {
    event.preventDefault();
    if (pending || email.trim() === "") return;
    setPending(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setDone(true);
    } catch (err) {
      setPending(false);
      if (err instanceof ApiError && err.status === 429) {
        setError(t("errRateLimited", { seconds: rateLimitSeconds(err.problem?.detail) }));
      } else {
        setError(t("errGeneric", { message: err instanceof Error ? err.message : String(err) }));
      }
    }
  }

  async function submitConfirm(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (password.length < MIN_PASSWORD) {
      setError(t("errShort"));
      return;
    }
    if (password !== confirm) {
      setError(t("errMismatch"));
      return;
    }
    setPending(true);
    setError(null);
    try {
      await confirmPasswordReset(token as string, password);
      setDone(true);
    } catch (err) {
      setPending(false);
      if (err instanceof ApiError && err.status === 400) {
        setError(t("errToken"));
      } else if (err instanceof ApiError && err.status === 429) {
        setError(t("errRateLimited", { seconds: rateLimitSeconds(err.problem?.detail) }));
      } else {
        setError(t("errGeneric", { message: err instanceof Error ? err.message : String(err) }));
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
          {done ? (
            <Card className="grid gap-4 shadow-pop">
              <span
                className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand-ink"
                aria-hidden="true"
              >
                <Icon name={hasToken ? "check" : "mail"} className="ic h-6 w-6" />
              </span>
              <div className="grid gap-1.5">
                <h1 className="font-display text-[22px] font-extrabold leading-7 tracking-tight text-ink">
                  {hasToken ? t("setDoneTitle") : t("requestDoneTitle")}
                </h1>
                <p className="text-body text-ink-soft">
                  {hasToken ? t("setDoneBody") : t("requestDoneBody")}
                </p>
              </div>
              <Button type="button" onClick={() => (window.location.href = "/login")}>
                {t("toLogin")}
              </Button>
            </Card>
          ) : hasToken ? (
            <Card className="shadow-pop">
              <h1 className="font-display text-[22px] font-extrabold leading-7 tracking-tight text-ink">
                {t("setTitle")}
              </h1>
              <p className="mt-1 text-body text-ink-soft">{t("setSub")}</p>
              <form className="mt-5 grid gap-4" onSubmit={submitConfirm} noValidate>
                <Input
                  label={t("passwordLabel")}
                  type="password"
                  name="new-password"
                  autoComplete="new-password"
                  placeholder={t("passwordPlaceholder")}
                  hint={t("passwordHint")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={pending}
                  minLength={MIN_PASSWORD}
                  required
                />
                <Input
                  label={t("confirmLabel")}
                  type="password"
                  name="confirm-password"
                  autoComplete="new-password"
                  placeholder={t("passwordPlaceholder")}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={pending}
                  minLength={MIN_PASSWORD}
                  required
                />
                {error && (
                  <p
                    role="alert"
                    className="rounded-lg bg-danger-soft px-3.5 py-2.5 text-[13px] font-semibold text-danger-ink"
                  >
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={pending || password.length < MIN_PASSWORD || confirm === ""}
                >
                  {pending ? t("setSubmitting") : t("setSubmit")}
                </Button>
              </form>
            </Card>
          ) : (
            <Card className="shadow-pop">
              <h1 className="font-display text-[22px] font-extrabold leading-7 tracking-tight text-ink">
                {t("requestTitle")}
              </h1>
              <p className="mt-1 text-body text-ink-soft">{t("requestSub")}</p>
              <form className="mt-5 grid gap-4" onSubmit={submitRequest} noValidate>
                <Input
                  label={t("emailLabel")}
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder={t("emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={pending}
                  required
                />
                {error && (
                  <p
                    role="alert"
                    className="rounded-lg bg-danger-soft px-3.5 py-2.5 text-[13px] font-semibold text-danger-ink"
                  >
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={pending || email.trim() === ""}>
                  {pending ? t("requestSubmitting") : t("requestSubmit")}
                </Button>
              </form>
            </Card>
          )}

          <p className="mt-4 text-center">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center gap-1 text-caption font-semibold text-ink-faint no-underline hover:text-ink"
            >
              <Icon name="chevronRight" className="ic h-3.5 w-3.5 rotate-180" />
              {t("toLogin")}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
