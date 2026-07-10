"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Column, DataTable } from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";
import { data, errorMessage, fullName, memberById } from "@/lib/data";
import { useLocale, useT } from "@/lib/i18n";
import { formatDateShort } from "@/lib/format";
import type { DocumentItem, Member } from "@/lib/types";
import { documentsDict } from "../i18n";
import {
  fileTypeLabel,
  fileTypeTone,
  formatBytes,
  suggestFilename,
  type FileTypeTone,
} from "../fileType";

const TYPE_TONE_CLASS: Record<FileTypeTone, string> = {
  brand: "bg-brand-soft text-brand-ink",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warn: "bg-warn-soft text-warn",
  neutral: "bg-sunken text-ink-soft",
};

/** Kleine Typ-Kachel (PDF/DOCX …) — rein kosmetisch, Wort statt nur Farbe. */
function TypeGlyph({ contentType, title }: { contentType: string; title: string }) {
  const tone = fileTypeTone(contentType);
  return (
    <span
      className={`inline-grid h-8 min-w-[44px] place-items-center rounded-md px-1.5 text-[11px] font-extrabold tracking-[.04em] ${TYPE_TONE_CLASS[tone]}`}
    >
      {fileTypeLabel(contentType, title)}
    </span>
  );
}

/**
 * Tabelle der Dokumente-Ablage (Seriositätszone, DESIGN-SYSTEM §3.3). Der
 * Download lädt die auth-geschützten Bytes über die Facade (loadMediaUrl → GET
 * /media/{key}) und stößt einen Anker-Download an; Object-URLs werden nach
 * kurzer Zeit wieder freigegeben. Löschen ist Trainer+PRO — der Button erscheint
 * nur bei canWrite, die Durchsetzung bleibt serverseitig.
 */
export function DocumentsTable({
  documents,
  members,
  canWrite,
  onDelete,
}: {
  documents: DocumentItem[];
  members: Member[];
  canWrite: boolean;
  onDelete: (doc: DocumentItem) => void;
}) {
  const t = useT(documentsDict);
  const { locale } = useLocale();
  const { showToast } = useToast();
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());

  async function download(doc: DocumentItem) {
    if (busy.has(doc.id)) return;
    setBusy((previous) => new Set(previous).add(doc.id));
    try {
      const url = await data.loadMediaUrl(doc.storageKey);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = suggestFilename(doc.title, doc.contentType);
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      if (url.startsWith("blob:")) window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (error) {
      showToast(errorMessage(error) || t("downloadError"), { tone: "danger" });
    } finally {
      setBusy((previous) => {
        const next = new Set(previous);
        next.delete(doc.id);
        return next;
      });
    }
  }

  function uploaderName(doc: DocumentItem): string {
    const member = memberById(members, doc.uploadedByMemberId);
    return member ? fullName(member) : t("unknownUploader");
  }

  const totalBytes = documents.reduce((sum, doc) => sum + (doc.sizeBytes ?? 0), 0);
  const countLabel =
    documents.length === 1 ? t("footerCountOne") : t("footerCount", { count: documents.length });

  const columns: Column<DocumentItem>[] = [
    {
      id: "title",
      header: t("colTitle"),
      cell: (doc) => <span className="font-semibold text-ink">{doc.title}</span>,
      footer: <span>{countLabel}</span>,
    },
    {
      id: "category",
      header: t("colCategory"),
      cell: (doc) => <Badge tone="neutral">{doc.category}</Badge>,
    },
    {
      id: "type",
      header: t("colType"),
      cell: (doc) => <TypeGlyph contentType={doc.contentType} title={doc.title} />,
    },
    {
      id: "size",
      header: t("colSize"),
      mono: true,
      cell: (doc) => formatBytes(doc.sizeBytes, locale),
      footer: formatBytes(totalBytes, locale),
    },
    {
      id: "uploaded",
      header: t("colUploaded"),
      cell: (doc) => (
        <span className="grid gap-0.5 leading-tight">
          <span className="text-[13.5px] text-ink">
            {t("uploadedBy", { name: uploaderName(doc) })}
          </span>
          <span className="text-caption text-ink-faint">{formatDateShort(doc.createdAt, locale)}</span>
        </span>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("colActions")}</span>,
      align: "right",
      cell: (doc) => (
        <span className="inline-flex items-center justify-end gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            icon="download"
            disabled={busy.has(doc.id)}
            aria-label={t("downloadAria", { title: doc.title })}
            onClick={() => download(doc)}
          >
            {t("download")}
          </Button>
          {canWrite && (
            <Button
              variant="ghost"
              size="sm"
              aria-label={t("deleteAria", { title: doc.title })}
              onClick={() => onDelete(doc)}
            >
              {t("delete")}
            </Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={documents}
      rowKey={(doc) => doc.id}
      caption={t("tableCaption")}
    />
  );
}
