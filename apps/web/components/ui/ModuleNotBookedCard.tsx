"use client";

import { Icon } from "@/components/shell/icons";
import { Badge } from "@/components/ui/Badge";

/**
 * „Nicht gebucht" — der ehrliche Zustand eines ZUBUCHBAREN Moduls
 * (Galerie, Dokumente, Notizen; Migration 0068).
 *
 * ### WARUM ES DIESE KARTE GIBT ###
 * Seit 0068 sind diese drei Module für einen neuen Verein voreingestellt AUS.
 * Die Durchsetzung sitzt serverseitig (restriktive RLS-Gates aus 0044 +
 * assertModuleEnabled → HTTP 403 `club_module_disabled`). Was der Server dabei
 * aber NICHT von allein leisten kann, ist eine gute Auskunft: eine leere Liste
 * sagt „keine Dokumente" — und der Verein denkt, seine Dokumente sind weg.
 * Richtig ist „nicht gebucht", plus dem Weg dorthin.
 *
 * ### DIESE KARTE SCHÜTZT NICHTS ###
 * Sie erklärt nur. Wer sie umgeht (direkter API-Aufruf), bekommt vom Server
 * weiterhin 403 bzw. 0 Zeilen. Das ist der Unterschied zu v1, wo das Gate NUR
 * im Client saß.
 *
 * ### ABGRENZUNG ZU ProUpgradeCard ###
 * ProUpgradeCard = 402, „nicht LIZENZIERT" → der Betreiber muss freischalten.
 * Diese Karte  = 403, „nicht GEBUCHT"    → ein Vereins-Admin legt den Schalter
 * unter Verwaltung › Module um. Zwei Ursachen, zwei Auswege — deshalb zwei
 * Karten und nicht eine mit Fallunterscheidung.
 *
 * Zweisprachig über die aufrufenden Screens (DE/EN sind Pflicht, echte Umlaute).
 */
export function ModuleNotBookedCard({
  eyebrow,
  title,
  body,
  hint,
  badge,
}: {
  eyebrow: string;
  title: string;
  body: string;
  /** Wie man es bucht — der Ausweg, ohne den die Karte nur eine Absage wäre. */
  hint: string;
  badge: string;
}) {
  return (
    <section className="grid place-items-center rounded-xl border border-line bg-surface px-6 py-12 text-center shadow-card">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand-ink">
        <Icon name="lock" className="ic h-7 w-7" />
      </span>

      <div className="mt-4 flex items-center gap-2">
        <span className="eyebrow">{eyebrow}</span>
        <Badge tone="neutral">{badge}</Badge>
      </div>

      <h3 className="mt-1 font-display text-h2 tracking-[-0.015em] text-ink">{title}</h3>
      <p className="mt-2 max-w-md text-body text-ink-soft">{body}</p>

      <div className="mt-6 grid gap-2 rounded-lg border border-line bg-sunken px-5 py-4">
        <p className="max-w-md text-caption text-ink-faint">{hint}</p>
      </div>
    </section>
  );
}
