"use client";

import { useMemo, useState } from "react";
import { data, errorMessage, fullName, isForbidden } from "@/lib/data";
import type { AddGuardianshipInput, GuardianRelation } from "@/lib/data";
import type { Guardianship, Member } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Sheet } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/shell/icons";
import { familieDict, GUARDIAN_RELATION_OPTIONS } from "../i18n";

const FORM_ID = "link-child-form";

/**
 * Bestehendes, vereinsverwaltetes Mitglied als eigenes Kind verknüpfen
 * (Selfservice, guardianMemberId NICHT gesetzt). Durchsuchbarer Picker über die
 * vom Screen vorgefilterten Kandidaten (verwaltete Mitglieder ohne eigenen
 * Zugang, noch nicht meine Kinder). Der Server erzwingt die Regeln endgültig —
 * ein 403/400 bleibt ein ruhiger Klartext-Toast, das Sheet bleibt offen.
 */
export function LinkChildSheet({
  candidates,
  onLinked,
  onClose,
}: {
  candidates: Member[];
  onLinked: (guardianship: Guardianship, member: Member) => void;
  onClose: () => void;
}) {
  const t = useT(familieDict);
  const { showToast } = useToast();

  const sorted = useMemo(
    () => [...candidates].sort((a, b) => fullName(a).localeCompare(fullName(b), "de")),
    [candidates],
  );

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [relation, setRelation] = useState<GuardianRelation>("parent");
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter((m) => fullName(m).toLowerCase().includes(needle));
  }, [sorted, query]);

  const submit = async () => {
    if (submitting) return;
    if (!selectedId) {
      showToast(t("linkPickFirst"), { tone: "danger" });
      return;
    }
    const member = candidates.find((m) => m.id === selectedId);
    const input: AddGuardianshipInput = { childMemberId: selectedId, relation };

    setSubmitting(true);
    try {
      const guardianship = await data.addGuardianship(input);
      if (member) showToast(t("linkedToast", { name: fullName(member) }), { tone: "success" });
      if (member) onLinked(guardianship, member);
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), { tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={t("linkEyebrow")}
      title={t("linkTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} icon="link" disabled={submitting || !selectedId}>
            {t("linkSubmit")}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <p className="text-caption leading-[18px] text-ink-soft">{t("linkLead")}</p>

        <Select
          label={t("fRelation")}
          value={relation}
          onChange={(event) => setRelation(event.target.value as GuardianRelation)}
        >
          {GUARDIAN_RELATION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.key)}
            </option>
          ))}
        </Select>

        <Input
          label={t("linkSearchLabel")}
          type="search"
          autoComplete="off"
          placeholder={t("linkSearchPlaceholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        {sorted.length === 0 ? (
          <p className="rounded-md border border-dashed border-line px-3 py-6 text-center text-caption text-ink-soft">
            {t("linkNoCandidates")}
          </p>
        ) : filtered.length === 0 ? (
          <p className="rounded-md border border-dashed border-line px-3 py-6 text-center text-caption text-ink-soft">
            {t("linkNoMatch")}
          </p>
        ) : (
          <ul className="grid max-h-[52vh] list-none gap-1 overflow-y-auto">
            {filtered.map((member) => {
              const active = member.id === selectedId;
              return (
                <li key={member.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedId(member.id)}
                    className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors duration-150 ${
                      active
                        ? "border-transparent bg-brand-soft text-brand-ink"
                        : "border-transparent bg-sunken text-ink hover:bg-line/60"
                    }`}
                  >
                    <Avatar
                      personId={member.id}
                      firstName={member.firstName}
                      lastName={member.lastName}
                      avatarUrl={member.avatarUrl}
                      size="s"
                    />
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                      {fullName(member)}
                    </span>
                    {active && <Icon name="check" className="ic h-4 w-4 flex-none" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </form>
    </Sheet>
  );
}
