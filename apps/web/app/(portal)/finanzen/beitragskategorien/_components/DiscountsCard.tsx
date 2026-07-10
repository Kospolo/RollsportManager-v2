"use client";

import { useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { FamilyDiscount, Id } from "@/lib/types";
import { useT, useLocale } from "@/lib/i18n";
import { formatEUR } from "@/lib/format";
import { Card, CardHeader, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { beitragskategorienDict } from "../i18n";
import { formatPercentValue } from "../derive";
import { DiscountFormModal } from "./DiscountFormModal";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";

/** Formularzustand: geschlossen | Anlegen | Bearbeiten eines Rabatts. */
type FormState = { mode: "closed" } | { mode: "new" } | { mode: "edit"; discount: FamilyDiscount };

/**
 * Familienrabatte-Karte: Liste (Bezeichnung, Art, Nachlass, ab welchem Kind)
 * plus Anlegen/Bearbeiten/Löschen über die Facade. Reine Stammdaten-Regeln —
 * die automatische Anwendung auf Rechnungen folgt später. Löschen ist
 * Soft-Delete mit Bestätigungs-Dialog. onChanged lädt den Screen neu.
 */
export function DiscountsCard({
  clubId,
  discounts,
  onChanged,
}: {
  clubId: Id;
  discounts: FamilyDiscount[];
  onChanged: () => void;
}) {
  const t = useT(beitragskategorienDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const [form, setForm] = useState<FormState>({ mode: "closed" });
  const [deleteTarget, setDeleteTarget] = useState<FamilyDiscount | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await data.deleteFamilyDiscount(deleteTarget.id);
      showToast(t("discDeletedToast", { name: deleteTarget.label }), { tone: "success" });
      setDeleteTarget(null);
      onChanged();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), { tone: "danger" });
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<FamilyDiscount>[] = [
    {
      id: "label",
      header: t("discColLabel"),
      cell: (d) => (
        <span className="inline-flex items-center gap-2">
          <span className="font-semibold text-ink">{d.label}</span>
          {!d.isActive && <Badge tone="neutral">{t("discStatusInactive")}</Badge>}
        </span>
      ),
    },
    {
      id: "kind",
      header: t("discColKind"),
      cell: (d) => (
        <Badge tone={d.kind === "percent" ? "info" : "brand"}>
          {d.kind === "percent" ? t("discKindPercent") : t("discKindFixed")}
        </Badge>
      ),
    },
    {
      id: "value",
      header: t("discColValue"),
      mono: true,
      cell: (d) =>
        d.kind === "percent"
          ? formatPercentValue(d.valueNumeric, locale)
          : formatEUR(d.valueNumeric, locale),
    },
    {
      id: "from",
      header: t("discColFrom"),
      cell: (d) => (
        <span className="text-ink-soft">{t("discFromChild", { n: d.appliesFromChild })}</span>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("discColActions")}</span>,
      align: "right",
      cell: (d) => (
        <span className="inline-flex justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            icon="edit"
            aria-label={t("edit")}
            onClick={() => setForm({ mode: "edit", discount: d })}
          >
            {t("edit")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("delete")}
            className="text-danger hover:bg-danger-soft"
            onClick={() => setDeleteTarget(d)}
          >
            {t("delete")}
          </Button>
        </span>
      ),
    },
  ];

  return (
    <Card padded={false}>
      <div className="p-5 sm:p-6">
        <CardHeader
          eyebrow={t("discEyebrow")}
          title={t("discTitle")}
          action={
            <Button size="sm" icon="plus" onClick={() => setForm({ mode: "new" })}>
              {t("addDiscount")}
            </Button>
          }
        />

        <p className="mb-4 text-body text-ink-soft">{t("discIntro")}</p>

        <DataTable
          columns={columns}
          rows={discounts}
          rowKey={(d) => d.id}
          caption={t("discTitle")}
          empty={
            <EmptyState
              icon="sparkle"
              title={t("discEmptyTitle")}
              body={t("discEmptyBody")}
              action={
                <Button icon="plus" onClick={() => setForm({ mode: "new" })}>
                  {t("addDiscount")}
                </Button>
              }
            />
          }
        />

        {discounts.length > 0 && (
          <CardFooter>
            <span>{t("discCountFoot", { n: discounts.length })}</span>
          </CardFooter>
        )}
      </div>

      {form.mode !== "closed" && (
        <DiscountFormModal
          clubId={clubId}
          discount={form.mode === "edit" ? form.discount : null}
          onClose={() => setForm({ mode: "closed" })}
          onSaved={onChanged}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          eyebrow={t("discEyebrow")}
          title={t("discDeleteTitle")}
          body={t("discDeleteBody", { name: deleteTarget.label })}
          confirmLabel={t("delete")}
          cancelLabel={t("cancel")}
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </Card>
  );
}
