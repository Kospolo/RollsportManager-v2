"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { setSessionClub, useAuth } from "@/lib/auth";
import { data } from "@/lib/data";
import { ApiError } from "@/lib/data/errors";
import type { RegisteredClub, JoinRequestResult } from "@/lib/data/inputs-registrierung";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Tabs } from "@/components/ui/Tabs";
import { Icon } from "@/components/shell/icons";
import { onboardingDict } from "./i18n";

/**
 * „Kein Verein“-Onboarding — gezeigt von OnboardingGate, wenn eine angemeldete
 * Person (kein Plattform-Admin) noch keinen aktiven Verein hat.
 *
 * Zwei Wege, umschaltbar ueber ein Segment:
 *  - GRUENDEN: POST /clubs -> sofort Inhaber. Danach setSessionClub(), damit
 *    die Shell den frischen Verein zeigt (kein Rechte-Trick, nur die Anzeige;
 *    die Rechte kommen aus der DB). Das Gate re-rendert und laesst ins Portal.
 *  - BEITRETEN: POST /clubs/join -> ANTRAG (status='pending'). KEIN Zugang,
 *    deshalb ein ehrlicher Wartehinweis statt eines „Willkommen“.
 *
 * Anders als /registrieren und /beitreten (fuer noch nicht Angemeldete) laeuft
 * dieser Weg INNERHALB der angemeldeten Shell — kein „bitte zuerst anmelden“.
 */

const CONSENT_CLASS = "mt-0.5 h-4 w-4 flex-none accent-[var(--brand)]";

type OnboardingKey = keyof (typeof onboardingDict)["de"];
type Translate = (key: OnboardingKey, params?: Record<string, string | number>) => string;

function ConsentFields({
  t,
  terms,
  privacy,
  onTerms,
  onPrivacy,
}: {
  t: Translate;
  terms: boolean;
  privacy: boolean;
  onTerms: (v: boolean) => void;
  onPrivacy: (v: boolean) => void;
}) {
  return (
    <fieldset className="grid gap-2.5">
      <legend className="mb-1 text-[13px] font-semibold text-ink">{t("ackTitle")}</legend>
      <label className="flex items-start gap-2.5 text-[13px] text-ink-soft">
        <input
          type="checkbox"
          checked={terms}
          onChange={(e) => onTerms(e.target.checked)}
          className={CONSENT_CLASS}
        />
        <span>{t("ackTerms")}</span>
      </label>
      <label className="flex items-start gap-2.5 text-[13px] text-ink-soft">
        <input
          type="checkbox"
          checked={privacy}
          onChange={(e) => onPrivacy(e.target.checked)}
          className={CONSENT_CLASS}
        />
        <span>{t("ackPrivacy")}</span>
      </label>
      <p className="text-[12px] leading-relaxed text-ink-faint">{t("ackHint")}</p>
    </fieldset>
  );
}

export function Onboarding() {
  const t = useT(onboardingDict);
  const { session, signOut } = useAuth();

  const [tab, setTab] = useState<"create" | "join">("create");

  return (
    <div className="mx-auto grid w-full max-w-[480px] gap-6">
      <header className="grid gap-1.5 text-center">
        <span
          className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand-ink"
          aria-hidden="true"
        >
          <Icon name="sparkle" className="ic h-6 w-6" />
        </span>
        <h1 className="font-display text-h2 tracking-[-0.015em] text-ink">{t("greeting")}</h1>
        <p className="text-body text-ink-soft">{t("intro")}</p>
      </header>

      <div className="flex justify-center">
        <Tabs
          label={t("segCreate") + " / " + t("segJoin")}
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "create", label: t("segCreate") },
            { value: "join", label: t("segJoin") },
          ]}
        />
      </div>

      {tab === "create" ? <CreateClub /> : <JoinClub />}

      <p className="text-center text-caption text-ink-faint">
        {session ? t("signedInAs", { email: session.profile.email }) : null}
        {session ? " · " : null}
        <button
          type="button"
          onClick={signOut}
          className="rounded-sm font-semibold text-ink-soft hover:text-ink hover:underline"
        >
          {t("signOut")}
        </button>
      </p>
    </div>
  );
}

/** Verein gruenden — reiner Formularpfad, danach setSessionClub. */
function CreateClub() {
  const t = useT(onboardingDict);

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
      // Der Verein wird sofort der aktive — sonst zeigte die Shell weiter das
      // Onboarding. Nur Anzeige, die Rechte kommen aus der DB.
      setSessionClub(club.clubId, "owner", club.ownerMemberId);
      setDone(club);
    } catch (err) {
      setPending(false);
      if (err instanceof ApiError && err.status === 429) {
        const secs = /(\d+)\s*Sekunden|(\d+)\s*seconds/.exec(err.problem?.detail ?? "");
        setError(t("errRateLimited", { seconds: secs?.[1] ?? secs?.[2] ?? "60" }));
      } else {
        setError(t("errGeneric", { message: err instanceof Error ? err.message : String(err) }));
      }
    }
  }

  async function copyCode() {
    if (!done) return;
    await navigator.clipboard.writeText(done.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (done) {
    return (
      <Card className="grid gap-5 p-6">
        <span
          className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand-ink"
          aria-hidden="true"
        >
          <Icon name="check" className="ic h-6 w-6" />
        </span>
        <div className="grid gap-1.5">
          <h2 className="font-display text-h3 tracking-[-0.015em] text-ink">
            {t("createDoneTitle", { club: done.clubName })}
          </h2>
          <p className="text-[14px] text-ink-soft">{t("createDoneSub")}</p>
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
        <p className="rounded-xl bg-surface-sunken px-3.5 py-3 text-[13px] leading-relaxed text-ink-soft">
          {t("codeHint")}
        </p>
        {/* Reload statt router.push: nach setSessionClub laesst das Gate den
            frischen Verein durch — ein harter Wechsel auf /dashboard holt die
            Portal-Daten sauber neu. */}
        <Button type="button" onClick={() => (window.location.href = "/dashboard")}>
          {t("toPortal")}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="grid gap-5 p-6">
      <div className="grid gap-1">
        <h2 className="font-display text-h3 tracking-[-0.015em] text-ink">{t("createTitle")}</h2>
        <p className="text-[14px] text-ink-soft">{t("createSub")}</p>
      </div>
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
        <ConsentFields
          t={t}
          terms={terms}
          privacy={privacy}
          onTerms={setTerms}
          onPrivacy={setPrivacy}
        />
        {error ? (
          <p role="alert" className="text-[13px] font-semibold text-danger-ink">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={!canSubmit}>
          {pending ? t("createSubmitting") : t("createSubmit")}
        </Button>
        <p className="text-[12px] leading-relaxed text-ink-faint">{t("trialNote")}</p>
      </form>
    </Card>
  );
}

/** Verein beitreten — ANTRAG, endet im Wartehinweis. */
function JoinClub() {
  const t = useT(onboardingDict);

  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<JoinRequestResult | null>(null);

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
        const secs = /(\d+)\s*Sekunden|(\d+)\s*seconds/.exec(err.problem?.detail ?? "");
        setError(t("errRateLimited", { seconds: secs?.[1] ?? secs?.[2] ?? "60" }));
      } else if (err instanceof ApiError && err.status === 409) {
        setError(t("errAlready"));
      } else if (err instanceof ApiError && err.status === 404) {
        setError(t("errInvalidCode"));
      } else {
        setError(t("errGeneric", { message: err instanceof Error ? err.message : String(err) }));
      }
    }
  }

  if (done) {
    return (
      <Card className="grid gap-5 p-6">
        <span
          className="grid h-11 w-11 place-items-center rounded-full bg-warn-soft text-warn-ink"
          aria-hidden="true"
        >
          <Icon name="clock" className="ic h-6 w-6" />
        </span>
        <div className="grid gap-1.5">
          <h2 className="font-display text-h3 tracking-[-0.015em] text-ink">{t("joinDoneTitle")}</h2>
          <p className="text-[14px] text-ink-soft">
            {t("joinDoneSub", { club: done.clubName })}
          </p>
        </div>
        <p className="rounded-xl bg-surface-sunken px-3.5 py-3 text-[13px] font-semibold text-ink-soft">
          {t("joinDoneStatus")}
        </p>
        <p className="text-[13px] text-ink-faint">{t("joinDoneHint")}</p>
        <Button type="button" variant="secondary" onClick={() => setDone(null)}>
          {t("joinDoneBack")}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="grid gap-5 p-6">
      <div className="grid gap-1">
        <h2 className="font-display text-h3 tracking-[-0.015em] text-ink">{t("joinTitle")}</h2>
        <p className="text-[14px] text-ink-soft">{t("joinSub")}</p>
      </div>
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <Input
          label={t("codeLabel")}
          hint={t("codeInputHint")}
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
        <ConsentFields
          t={t}
          terms={terms}
          privacy={privacy}
          onTerms={setTerms}
          onPrivacy={setPrivacy}
        />
        {error ? (
          <p role="alert" className="text-[13px] font-semibold text-danger-ink">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={!canSubmit}>
          {pending ? t("joinSubmitting") : t("joinSubmit")}
        </Button>
      </form>
    </Card>
  );
}
