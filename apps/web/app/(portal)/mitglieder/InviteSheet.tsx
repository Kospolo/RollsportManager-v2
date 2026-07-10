"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Sheet } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import type { MemberRole } from "@/lib/types";
import { mitgliederDict, roleKey } from "./i18n";

/**
 * „Mitglied einladen“ — Sheet mit E-Mail-Formular (reine Demo, kein
 * Backend): Validierung in Klartext, Erfolg als Toast mit Demo-Hinweis.
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

  const close = () => {
    setError(undefined);
    onClose();
  };

  const send = () => {
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError(t("invEmailError"));
      return;
    }
    showToast(t("invToast", { email: trimmed }), { tone: "success" });
    setEmail("");
    setRole("member");
    setMessage("");
    setError(undefined);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      eyebrow={t("invEyebrow")}
      title={t("invTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {t("invCancel")}
          </Button>
          <Button icon="mail" onClick={send}>
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
