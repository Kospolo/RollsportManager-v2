"use client";

import type { Sparte } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SparteBadge } from "../../sparten/_components/SparteBadge";
import { memberSpartenDict } from "./sparten-i18n";

/**
 * Sparten-Zugehörigkeit EINES Mitglieds auf der Detailseite — reine ANZEIGE
 * (Badges) plus, für Berechtigte, ein Knopf ins Zuordnungs-Sheet. Für
 * Unberechtigte gibt es KEINE Editier-Affordanz (nur die Badges). Die Karte
 * wird nur gebaut, wenn es etwas zu zeigen gibt ODER der/die Betrachter:in
 * verwalten darf (Aufrufer entscheidet — hier self-guarden wir zusätzlich).
 */
export function MemberSpartenCard({
  sparten,
  canManage,
  onManage,
}: {
  /** Sparten, denen das Mitglied angehört (bereits gefiltert, sortiert). */
  sparten: Sparte[];
  canManage: boolean;
  onManage: () => void;
}) {
  const t = useT(memberSpartenDict);

  if (sparten.length === 0 && !canManage) return null;

  return (
    <Card>
      <CardHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        action={
          canManage ? (
            <Button
              size="sm"
              variant="secondary"
              icon="edit"
              onClick={onManage}
            >
              {sparten.length > 0 ? t("editCta") : t("manageCta")}
            </Button>
          ) : undefined
        }
      />
      {sparten.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {sparten.map((sparte) => (
            <li key={sparte.id} className="min-w-0">
              <SparteBadge sparte={sparte} inactiveLabel={t("inactiveBadge")} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body text-ink-soft">{t("none")}</p>
      )}
    </Card>
  );
}
