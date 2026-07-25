"use client";

import { useState } from "react";
import { useLocale, useT } from "@/lib/i18n";
import { formatEUR } from "@/lib/format";
import { data, errorMessage, isForbidden } from "@/lib/data";
import { ApiError } from "@/lib/api/generated";
import type { Id, InvoiceDetail, InvoiceItem } from "@/lib/types";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/shell/icons";
import { useToast } from "@/components/ui/Toast";
import { invoicesDict } from "../i18n";
import { lineCents, parseEuroToCents, parseQuantity, VAT_RATE_OPTIONS } from "../derive";

/** Zentseingabe → String für die Bearbeitung („8600" → „86,00"). */
function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * Positions-Editor für einen ENTWURF: bestehende Positionen inline ändern oder
 * entfernen, neue anhängen. Netto/MwSt/Brutto rechnet die Datenbank — hier wird
 * nur eine Live-Vorschau gezeigt. Nach jeder Änderung werden Positionen und
 * Rechnung neu geladen und nach oben gemeldet (Betrag wird fortgeschrieben).
 * Rechte serverseitig (can_manage_finance); der GoBD-Zwang (nur Entwurf) kommt
 * als 409 vom Server und wird als Toast behandelt.
 */
export function InvoiceItemsEditor({
  clubId,
  invoiceId,
  items,
  defaultVatRate,
  onItemsChanged,
  onInvoiceChanged,
}: {
  clubId: Id;
  invoiceId: Id;
  items: InvoiceItem[];
  defaultVatRate: number;
  onItemsChanged: (items: InvoiceItem[]) => void;
  onInvoiceChanged: (invoice: InvoiceDetail) => void;
}) {
  const t = useT(invoicesDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const [busy, setBusy] = useState(false);
  const [newDesc, setNewDesc] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [newPrice, setNewPrice] = useState("");
  const [newVat, setNewVat] = useState(defaultVatRate);
  const [addError, setAddError] = useState<string | undefined>();

  /** Nach jeder Mutation: Positionen + Rechnung neu laden und hochmelden. */
  const refresh = async () => {
    const [freshItems, freshInvoice] = await Promise.all([
      data.listInvoiceItems(clubId, invoiceId),
      data.getInvoice(invoiceId),
    ]);
    onItemsChanged(freshItems);
    onInvoiceChanged(freshInvoice);
  };

  const handleError = (caught: unknown) => {
    const msg =
      caught instanceof ApiError && caught.status === 409
        ? t("posNotDraft")
        : isForbidden(caught)
          ? t("forbidden")
          : errorMessage(caught);
    showToast(msg, { tone: "danger" });
  };

  const addItem = async () => {
    if (busy) return;
    const desc = newDesc.trim();
    const qty = parseQuantity(newQty);
    const price = parseEuroToCents(newPrice);
    if (!desc) return setAddError(t("posDescError"));
    if (qty === null) return setAddError(t("posQtyError"));
    if (price === null) return setAddError(t("posPriceError"));
    setAddError(undefined);
    setBusy(true);
    try {
      await data.createInvoiceItem({
        clubId,
        invoiceId,
        description: desc,
        quantity: qty,
        unitPriceCents: price,
        vatRate: newVat,
      });
      await refresh();
      setNewDesc("");
      setNewQty("1");
      setNewPrice("");
      setNewVat(defaultVatRate);
      showToast(t("posItemAddedToast"), { tone: "success" });
    } catch (caught) {
      handleError(caught);
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (itemId: Id) => {
    if (busy) return;
    setBusy(true);
    try {
      await data.deleteInvoiceItem(itemId);
      await refresh();
      showToast(t("posItemRemovedToast"), { tone: "success" });
    } catch (caught) {
      handleError(caught);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-5 grid gap-3 rounded-lg border border-line bg-sunken/50 p-4">
      <div className="grid gap-1">
        <p className="text-[14px] font-bold text-ink">{t("posEditTitle")}</p>
        <p className="text-caption text-ink-soft">{t("posEditHint")}</p>
      </div>

      {/* Bestehende Positionen — inline änderbar */}
      <div className="grid gap-2">
        {items.map((item) => (
          <ExistingItemRow
            key={item.id}
            item={item}
            busy={busy}
            locale={locale}
            onSave={refresh}
            onSetBusy={setBusy}
            onError={handleError}
            onRemove={() => removeItem(item.id)}
          />
        ))}
      </div>

      {/* Neue Position */}
      <div className="grid gap-2 rounded-md border border-dashed border-line-strong bg-surface p-3">
        <Input
          label={t("cPosDesc")}
          placeholder={t("cPosDescPlaceholder")}
          value={newDesc}
          onChange={(event) => {
            setNewDesc(event.target.value);
            if (addError) setAddError(undefined);
          }}
        />
        <div className="grid grid-cols-3 gap-2">
          <Input
            label={t("cPosQty")}
            inputMode="decimal"
            value={newQty}
            onChange={(event) => setNewQty(event.target.value)}
          />
          <Input
            label={t("cPosPrice")}
            inputMode="decimal"
            placeholder="0,00"
            value={newPrice}
            onChange={(event) => setNewPrice(event.target.value)}
          />
          <Select
            label={t("cPosVat")}
            value={String(newVat)}
            onChange={(event) => setNewVat(Number(event.target.value))}
          >
            {VAT_RATE_OPTIONS.map((rate) => (
              <option key={rate} value={rate}>
                {rate} %
              </option>
            ))}
          </Select>
        </div>
        {addError && <p className="text-caption text-danger">{addError}</p>}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon="plus"
          onClick={addItem}
          disabled={busy}
          className="justify-self-start"
        >
          {t("posAdd")}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Eine bestehende Position, inline änderbar (Übernehmen speichert, Trash löscht). */
function ExistingItemRow({
  item,
  busy,
  locale,
  onSave,
  onSetBusy,
  onError,
  onRemove,
}: {
  item: InvoiceItem;
  busy: boolean;
  locale: import("@/lib/i18n").Locale;
  onSave: () => Promise<void>;
  onSetBusy: (busy: boolean) => void;
  onError: (caught: unknown) => void;
  onRemove: () => void;
}) {
  const t = useT(invoicesDict);
  const { showToast } = useToast();
  const [desc, setDesc] = useState(item.description);
  const [qty, setQty] = useState(String(item.quantity));
  const [price, setPrice] = useState(centsToInput(item.unitPriceCents));
  const [vat, setVat] = useState(item.vatRate);

  const parsedQty = parseQuantity(qty);
  const parsedPrice = parseEuroToCents(price);
  const preview =
    parsedQty !== null && parsedPrice !== null ? lineCents(parsedQty, parsedPrice, vat) : null;

  const dirty =
    desc.trim() !== item.description ||
    parsedQty !== item.quantity ||
    parsedPrice !== item.unitPriceCents ||
    vat !== item.vatRate;

  const save = async () => {
    if (busy) return;
    const trimmed = desc.trim();
    if (!trimmed || parsedQty === null || parsedPrice === null) return;
    onSetBusy(true);
    try {
      await data.updateInvoiceItem(item.id, {
        description: trimmed,
        quantity: parsedQty,
        unitPriceCents: parsedPrice,
        vatRate: vat,
      });
      await onSave();
      showToast(t("posItemUpdatedToast"), { tone: "success" });
    } catch (caught) {
      onError(caught);
    } finally {
      onSetBusy(false);
    }
  };

  return (
    <div className="grid gap-2 rounded-md border border-line bg-surface p-3">
      <Input label={t("cPosDesc")} value={desc} onChange={(event) => setDesc(event.target.value)} />
      <div className="grid grid-cols-3 gap-2">
        <Input label={t("cPosQty")} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
        <Input label={t("cPosPrice")} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        <Select label={t("cPosVat")} value={String(vat)} onChange={(e) => setVat(Number(e.target.value))}>
          {VAT_RATE_OPTIONS.map((rate) => (
            <option key={rate} value={rate}>
              {rate} %
            </option>
          ))}
        </Select>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[12px] tabular-nums text-ink-faint">
          {preview ? formatEUR(preview.gross, locale) : "—"}
        </span>
        <div className="flex gap-1.5">
          <Button type="button" variant="ghost" size="sm" className="text-danger" onClick={onRemove} disabled={busy}>
            <Icon name="trash" className="ic h-4 w-4" />
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={save} disabled={busy || !dirty}>
            {t("posSaveItem")}
          </Button>
        </div>
      </div>
    </div>
  );
}
