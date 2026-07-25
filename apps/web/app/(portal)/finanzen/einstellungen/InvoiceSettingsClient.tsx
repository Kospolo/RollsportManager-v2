"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { data, errorMessage, isForbidden, isNotImplemented, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { Id, InvoiceSettings } from "@/lib/types";
import { Icon } from "@/components/shell/icons";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { invoiceSettingsDict } from "./i18n";

/**
 * Rechnungs-Einstellungen: lädt die eingeloggte Person, gatet auf is_club_admin
 * (verbindlich serverseitig) und übergibt an das Formular. NotImplemented /
 * Forbidden / Ladefehler werden als ehrlicher Zustand behandelt, nie als Absturz.
 */
export function InvoiceSettingsClient() {
  const t = useT(invoiceSettingsDict);

  const core = useData(async (repo) => {
    const currentUser = await repo.getCurrentUser();
    return { currentUser, clubId: currentUser.clubId };
  });

  if (core.status === "loading") return <SettingsSkeleton />;

  if (core.status === "error") {
    return (
      <Shell>
        {isNotImplemented(core.error) ? (
          <EmptyState icon="sparkle" title={t("niTitle")} body={t("niBody")} />
        ) : (
          <EmptyState
            icon="zap"
            title={t("loadErrorTitle")}
            body={errorMessage(core.error)}
            action={<Button onClick={core.reload}>{t("retry")}</Button>}
          />
        )}
      </Shell>
    );
  }

  if (!permissions(core.data.currentUser).isClubAdmin) {
    return (
      <Shell>
        <BackLink label={t("backToFinance")} />
        <EmptyState icon="lock" title={t("forbidden")} body={t("forbiddenBody")} />
      </Shell>
    );
  }

  return <SettingsContent clubId={core.data.clubId} />;
}

/* ------------------------------------------------------------------ */

function SettingsContent({ clubId }: { clubId: Id }) {
  const t = useT(invoiceSettingsDict);
  const loaded = useData((repo) => repo.getInvoiceSettings(clubId), [clubId]);

  return (
    <Shell>
      <BackLink label={t("backToFinance")} />
      <SectionHeader level={1} title={t("pageTitle")} sub={t("pageSub")} />
      {loaded.status === "loading" ? (
        <Card>
          <SkeletonCard lines={8} />
        </Card>
      ) : loaded.status === "error" ? (
        <EmptyState
          icon="zap"
          title={t("loadErrorTitle")}
          body={errorMessage(loaded.error)}
          action={<Button onClick={loaded.reload}>{t("retry")}</Button>}
        />
      ) : (
        <SettingsForm clubId={clubId} initial={loaded.data} />
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */

interface FormState {
  senderBlock: string;
  logoUrl: string;
  taxNumber: string;
  vatId: string;
  boardMembers: string;
  footerText: string;
  bankName: string;
  iban: string;
  bic: string;
  accountHolder: string;
  numberPrefix: string;
  defaultVatRate: string;
}

function fromSettings(s: InvoiceSettings): FormState {
  return {
    senderBlock: s.senderBlock,
    logoUrl: s.logoUrl,
    taxNumber: s.taxNumber,
    vatId: s.vatId,
    boardMembers: s.boardMembers,
    footerText: s.footerText,
    bankName: s.bankName,
    iban: s.iban,
    bic: s.bic,
    accountHolder: s.accountHolder,
    numberPrefix: s.numberPrefix,
    defaultVatRate: String(s.defaultVatRate ?? 0),
  };
}

/** Das Formular initialisiert sich EINMAL aus den geladenen Einstellungen. */
function SettingsForm({ clubId, initial }: { clubId: Id; initial: InvoiceSettings }) {
  const t = useT(invoiceSettingsDict);
  const { showToast } = useToast();

  const [form, setForm] = useState<FormState>(() => fromSettings(initial));
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const rate = Number(form.defaultVatRate.replace(",", "."));
      const defaultVatRate = Number.isFinite(rate) ? Math.min(100, Math.max(0, rate)) : 0;
      await data.updateInvoiceSettings({
        clubId,
        senderBlock: form.senderBlock,
        logoUrl: form.logoUrl,
        taxNumber: form.taxNumber,
        vatId: form.vatId,
        boardMembers: form.boardMembers,
        footerText: form.footerText,
        bankName: form.bankName,
        iban: form.iban,
        bic: form.bic,
        accountHolder: form.accountHolder,
        numberPrefix: form.numberPrefix,
        defaultVatRate,
      });
      showToast(t("savedToast"), { tone: "success" });
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), { tone: "danger" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      {!initial.configured && (
        <p className="rounded-lg border border-line bg-sunken/60 px-4 py-2.5 text-[13px] text-ink-soft">
          {t("unconfiguredHint")}
        </p>
      )}

      <Card>
        <FieldGroup title={t("secLetterhead")}>
          <Textarea
            label={t("senderBlockLabel")}
            hint={t("senderBlockHint")}
            rows={4}
            value={form.senderBlock}
            onChange={(e) => set({ senderBlock: e.target.value })}
          />
          <Input
            label={t("logoUrlLabel")}
            hint={t("logoUrlHint")}
            value={form.logoUrl}
            onChange={(e) => set({ logoUrl: e.target.value })}
          />
        </FieldGroup>
      </Card>

      <Card>
        <FieldGroup title={t("secTax")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t("taxNumberLabel")}
              value={form.taxNumber}
              onChange={(e) => set({ taxNumber: e.target.value })}
            />
            <Input
              label={t("vatIdLabel")}
              value={form.vatId}
              onChange={(e) => set({ vatId: e.target.value })}
            />
          </div>
          <Input
            label={t("defaultVatLabel")}
            hint={t("defaultVatHint")}
            inputMode="decimal"
            className="max-w-[220px]"
            value={form.defaultVatRate}
            onChange={(e) => set({ defaultVatRate: e.target.value })}
          />
        </FieldGroup>
      </Card>

      <Card>
        <FieldGroup title={t("secBank")}>
          <Input label={t("bankNameLabel")} value={form.bankName} onChange={(e) => set({ bankName: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t("ibanLabel")} value={form.iban} onChange={(e) => set({ iban: e.target.value })} />
            <Input label={t("bicLabel")} value={form.bic} onChange={(e) => set({ bic: e.target.value })} />
          </div>
          <Input
            label={t("accountHolderLabel")}
            value={form.accountHolder}
            onChange={(e) => set({ accountHolder: e.target.value })}
          />
        </FieldGroup>
      </Card>

      <Card>
        <FieldGroup title={t("secFooter")}>
          <Input
            label={t("boardMembersLabel")}
            value={form.boardMembers}
            onChange={(e) => set({ boardMembers: e.target.value })}
          />
          <Textarea
            label={t("footerLabel")}
            hint={t("footerHint")}
            rows={3}
            value={form.footerText}
            onChange={(e) => set({ footerText: e.target.value })}
          />
          <Input
            label={t("numberPrefixLabel")}
            hint={t("numberPrefixHint")}
            className="max-w-[220px]"
            value={form.numberPrefix}
            onChange={(e) => set({ numberPrefix: e.target.value })}
          />
        </FieldGroup>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" icon="check" disabled={saving}>
          {saving ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */

function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-4">
      <legend className="mb-1 font-display text-[15px] font-bold tracking-[-0.01em] text-ink">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function BackLink({ label }: { label: string }) {
  return (
    <Link
      href="/finanzen"
      className="inline-flex w-fit items-center gap-1.5 text-[13px] font-bold text-ink-soft no-underline transition-colors duration-150 hover:text-ink"
    >
      <Icon name="chevronRight" className="ic h-4 w-4 rotate-180" />
      {label}
    </Link>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="mx-auto grid w-full max-w-3xl gap-5">{children}</div>;
}

function SettingsSkeleton() {
  return (
    <Shell>
      <Skeleton className="h-4 w-32" />
      <div className="grid gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Card>
        <SkeletonCard lines={8} />
      </Card>
    </Shell>
  );
}
