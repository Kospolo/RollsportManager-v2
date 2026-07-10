"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Sheet } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { AssignableRole } from "@/lib/data";
import type { MemberRole } from "@/lib/types";
import { mitgliederDict, roleKey } from "./i18n";

/**
 * „Mitglied einladen“ — Sheet mit E-Mail-Formular. Legt die Einladung über
 * die Facade an (api-Modus: echter POST /clubs/{id}/members/invite mit
 * RLS-Prüfung; das Backend merkt die Einladung vor — Mailversand folgt).
 */

const INVITE_ROLES: MemberRole[] = ["member", "coach", "guest_coach", "treasurer", "admin"];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function InviteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT(mitgliederDict);
  const { showToast } = useToast();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("member");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    setError(undefined);
    onClose();
  };

  const send = async () => {
    if (submitting) return;
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError(t("invEmailError"));
      return;
    }
    setSubmitting(true);
    try {
      // owner ist nie einladbar (INVITE_ROLES ohne owner) — Cast ist sicher.
      await data.inviteMember({ email: trimmed, role: role as AssignableRole });
      showToast(t("invToast", { email: trimmed }), { tone: "success" });
      setEmail("");
      setRole("member");
      setMessage("");
      setError(undefined);
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("invForbidden") : errorMessage(caught), {
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      eyebrow={t("invEyebrow")}
      title={t("invTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={submitting}>
            {t("invCancel")}
          </Button>
          <Button icon="mail" onClick={send} disabled={submitting}>
            {t("invSend")}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <Input
          label={t("invEmail")}
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder={t("invEmailPlaceholder")}
          hint={t("invEmailHint")}
          error={error}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (error) setError(undefined);
          }}
        />
        <Select
          label={t("invRole")}
          value={role}
          onChange={(event) => setRole(event.target.value as MemberRole)}
        >
          {INVITE_ROLES.map((option) => (
            <option key={option} value={option}>
              {t(roleKey(option))}
            </option>
          ))}
        </Select>
        <Textarea
          label={t("invMessage")}
          placeholder={t("invMessagePlaceholder")}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <p className="text-caption text-ink-faint">{t("invHint")}</p>
        {/* Enter im Formular löst „Senden“ aus */}
        <button type="submit" className="sr-only">
          {t("invSend")}
        </button>
      </form>
    </Sheet>
  );
}
