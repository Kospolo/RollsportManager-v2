"use client";

import { useT, type Dict } from "@/lib/i18n";

/**
 * Gestapelter Antwort-Balken (DESIGN-SYSTEM §3.10, Jury-Übernahme aus B):
 * 6 px, Segmente success/danger/line-strong. Der Balken ist aria-hidden —
 * die Information trägt die Klartext-Legende („9 Zusagen · 1 Absage · 4 offen“).
 */

const dict = {
  de: {
    yesOne: "1 Zusage",
    yesMany: "{n} Zusagen",
    noOne: "1 Absage",
    noMany: "{n} Absagen",
    open: "{n} offen",
  },
  en: {
    yesOne: "1 going",
    yesMany: "{n} going",
    noOne: "1 declined",
    noMany: "{n} declined",
    open: "{n} open",
  },
} satisfies Dict;

export function ResponseBar({
  yes,
  no,
  open,
  legend = true,
  className = "",
}: {
  yes: number;
  no: number;
  open: number;
  /** Klartext-Legende über dem Balken (Status nie nur über Farbe) */
  legend?: boolean;
  className?: string;
}) {
  const t = useT(dict);
  const total = yes + no + open;
  const width = (part: number) => (total > 0 ? `${(part / total) * 100}%` : "0%");

  return (
    <div className={`grid gap-2 ${className}`.trim()}>
      {legend && (
        <span className="text-[13px] font-semibold text-ink-soft">
          <b className="font-bold text-success">
            {yes === 1 ? t("yesOne") : t("yesMany", { n: yes })}
          </b>
          {" · "}
          <span className="font-bold text-danger">
            {no === 1 ? t("noOne") : t("noMany", { n: no })}
          </span>
          {" · "}
          <span className="font-bold text-ink-faint">{t("open", { n: open })}</span>
        </span>
      )}
      <div
        aria-hidden="true"
        className="flex h-1.5 w-full max-w-[360px] overflow-hidden rounded-full bg-sunken"
      >
        <span className="h-full bg-success" style={{ width: width(yes) }} />
        <span className="h-full bg-danger" style={{ width: width(no) }} />
        <span className="h-full bg-line-strong" style={{ width: width(open) }} />
      </div>
    </div>
  );
}
