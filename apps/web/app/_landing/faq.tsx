"use client";

import { useId, useState } from "react";
import { useT } from "@/lib/i18n";
import { Icon } from "@/components/shell/icons";
import { landingDict } from "./i18n";

/**
 * FAQ-Akkordeon (4 Fragen): Buttons mit aria-expanded/aria-controls,
 * 44-px-Ziele, Chevron dreht sich — Bewegung nur auf Nutzeranlass.
 */

const QUESTIONS = [
  { q: "q1", a: "a1" },
  { q: "q2", a: "a2" },
  { q: "q3", a: "a3" },
  { q: "q4", a: "a4" },
] as const;

export function FaqSection() {
  const t = useT(landingDict);
  const idBase = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-24">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="text-center">
          <span className="eyebrow text-brand-ink">{t("faqEyebrow")}</span>
          <h2 className="mt-2 font-display text-[26px] font-extrabold leading-9 tracking-tight text-ink sm:text-[30px]">
            {t("faqTitle")}
          </h2>
        </div>

        <div className="mt-8 grid gap-3">
          {QUESTIONS.map((item, index) => {
            const open = openIndex === index;
            const buttonId = `${idBase}-faq-${index}`;
            const panelId = `${idBase}-panel-${index}`;
            return (
              <div
                key={item.q}
                className="rounded-lg border border-line bg-surface shadow-card"
              >
                <h3>
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setOpenIndex(open ? null : index)}
                    className="flex min-h-14 w-full items-center gap-3 rounded-lg px-5 py-3 text-left text-[15px] font-bold text-ink transition-colors duration-150 hover:bg-sunken"
                  >
                    {t(item.q)}
                    <Icon
                      name="chevronDown"
                      className={`ic ml-auto h-[18px] w-[18px] flex-none text-ink-faint transition-transform duration-150 ${
                        open ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </h3>
                {open && (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className="border-t border-line px-5 py-4"
                  >
                    <p className="text-body leading-[23px] text-ink-soft">{t(item.a)}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
