"use client";

import { useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { Id, MembershipCategory } from "@/lib/types";
import { useT, useLocale } from "@/lib/i18n";
import { formatEUR } from "@/lib/format";
import { Card, CardHeader, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { beitragskategorienDict } from "../i18n";
import { PERIOD_LABEL_KEY, sortCategories } from "../derive";
import { CategoryFormModal } from "./CategoryFormModal";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";

/** Formularzustand: geschlossen | Anlegen | Bearbeiten einer Kategorie. */
type FormState = { mode: "closed" } | { mode: "new" } | { mode: "edit"; category: MembershipCategory };

/**
 * Beitragskategorien-Karte: Liste (Name, Betrag Mono, Periode, Status) plus
 * Anlegen/Bearbeiten/Löschen über die Facade. Löschen ist Soft-Delete und
 * verlangt einen Bestätigungs-Dialog — nie stilles Entfernen. onChanged lädt
 * den Screen neu, damit die Jahresprognose oben konsistent bleibt.
 */
export function CategoriesCard({
  clubId,
  categories,
  onChanged,
}: {
  clubId: Id;
  categories: MembershipCategory[];
  onChanged: () => void;
}) {
  const t = useT(beitragskategorienDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const [form, setForm] = useState<FormState>({ mode: "closed" });
  const [deleteTarget, setDeleteTarget] = useState<MembershipCategory | null>(null);
  const [deleting, setDeleting] = useState(false);

  const rows = sortCategories(categories);

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await data.deleteMembershipCategory(deleteTarget.id);
      showToast(t("catDeletedToast", { name: deleteTarget.name }), { tone: "success" });
      setDeleteTarget(null);
      onChanged();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), { tone: "danger" });
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<MembershipCategory>[] = [
    {
      id: "name",
      header: t("catColName"),
      cell: (c) => <span className="font-semibold text-ink">{c.name}</span>,
    },
    {
      id: "amount",
      header: t("catColAmount"),
      mono: true,
      cell: (c) => formatEUR(c.amountCents, locale),
    },
    {
      id: "period",
      header: t("catColPeriod"),
      cell: (c) => <span className="text-ink-soft">{t(PERIOD_LABEL_KEY[c.period])}</span>,
    },
    {
      id: "status",
      header: t("catColStatus"),
      cell: (c) => (
        <Badge tone={c.isActive ? "success" : "neutral"}>
          {c.isActive ? t("catStatusActive") : t("catStatusInactive")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("catColActions")}</span>,
      align: "right",
      cell: (c) => (
        <span className="inline-flex justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            icon="edit"
            aria-label={t("edit")}
            onClick={() => setForm({ mode: "edit", category: c })}
          >
            {t("edit")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("delete")}
            className="text-danger hover:bg-danger-soft"
            onClick={() => setDeleteTarget(c)}
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
          eyebrow={t("catsEyebrow")}
          title={t("catsTitle")}
          action={
            <Button size="sm" icon="plus" onClick={() => setForm({ mode: "new" })}>
              {t("addCategory")}
            </Button>
          }
        />

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(c) => c.id}
          caption={t("catsTitle")}
          empty={
            <EmptyState
              icon="bank"
              title={t("catsEmptyTitle")}
              body={t("catsEmptyBody")}
              action={
                <Button icon="plus" onClick={() => setForm({ mode: "new" })}>
                  {t("addCategory")}
                </Button>
              }
            />
          }
        />

        {rows.length > 0 && (
          <CardFooter>
            <span>{t("catCountFoot", { n: rows.length })}</span>
          </CardFooter>
        )}
      </div>

      {form.mode !== "closed" && (
        <CategoryFormModal
          clubId={clubId}
          category={form.mode === "edit" ? form.category : null}
          onClose={() => setForm({ mode: "closed" })}
          onSaved={onChanged}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          eyebrow={t("catsEyebrow")}
          title={t("catDeleteTitle")}
          body={t("catDeleteBody", { name: deleteTarget.name })}
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
