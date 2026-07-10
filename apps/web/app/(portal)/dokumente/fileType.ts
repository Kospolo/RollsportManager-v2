import type { Locale } from "@/lib/i18n";

/**
 * Kleine, rein kosmetische Helfer für die Dokumente-Ablage: ein Kurzlabel des
 * Dateityps (aus Content-Type bzw. Titel-Endung), ein Ton für die Typ-Kachel,
 * ein Download-Dateiname und die menschenlesbare Dateigröße. Die verbindliche
 * Typ-Allowlist und das 25-MB-Limit setzt der Server durch (415/413) — hier
 * validieren wir nur früh, damit die UI nicht unnötig lädt.
 */

/** Grenze für den clientseitigen Vorab-Check (Server ist die Wahrheit). */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Ton der Typ-Kachel (keine „danger"-Tinte — die bleibt destruktiven Aktionen). */
export type FileTypeTone = "brand" | "info" | "success" | "warn" | "neutral";

const CT_LABEL: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/gif": "GIF",
  "image/webp": "WEBP",
  "image/svg+xml": "SVG",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/vnd.ms-powerpoint": "PPT",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
  "text/plain": "TXT",
  "text/csv": "CSV",
  "application/zip": "ZIP",
};

function baseContentType(contentType: string): string {
  return (contentType || "").toLowerCase().split(";")[0].trim();
}

/** Kurzlabel wie „PDF", „DOCX", „PNG" — Fallback aus der Titel-Endung. */
export function fileTypeLabel(contentType: string, title?: string): string {
  const ct = baseContentType(contentType);
  if (CT_LABEL[ct]) return CT_LABEL[ct];
  const extFromTitle = title?.match(/\.([a-z0-9]{1,5})$/i)?.[1];
  if (extFromTitle) return extFromTitle.toUpperCase();
  const sub = ct.split("/")[1];
  if (sub) return sub.replace(/^x-/, "").slice(0, 4).toUpperCase();
  return "—";
}

/** Farb-Ton der Typ-Kachel nach grober Dateiklasse. */
export function fileTypeTone(contentType: string): FileTypeTone {
  const ct = baseContentType(contentType);
  if (ct.startsWith("image/")) return "info";
  if (ct === "application/pdf") return "warn";
  if (ct.includes("spreadsheet") || ct.includes("ms-excel") || ct === "text/csv") return "success";
  if (ct.includes("word") || ct.startsWith("text/")) return "brand";
  return "neutral";
}

/** Dateiendung (klein) für den Download-Namen — leer, wenn unbekannt. */
export function fileExtension(contentType: string, title?: string): string {
  const label = fileTypeLabel(contentType, title);
  return label === "—" ? "" : label.toLowerCase();
}

/** Sicherer Download-Dateiname aus Titel + passender Endung. */
export function suggestFilename(title: string, contentType: string): string {
  const base = (title || "").trim().replace(/[\\/:*?"<>|]+/g, "-") || "dokument";
  if (/\.[a-z0-9]{1,5}$/i.test(base)) return base;
  const ext = fileExtension(contentType, title);
  return ext ? `${base}.${ext}` : base;
}

/** Bytes → „125 KB" / „1,4 MB" (lokalisiert) — undefined/0-Fälle als „—". */
export function formatBytes(bytes: number | undefined, locale: Locale): string {
  if (bytes == null || bytes < 0) return "—";
  const intl = locale === "de" ? "de-DE" : "en-GB";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) {
    const n = new Intl.NumberFormat(intl, { maximumFractionDigits: kb < 10 ? 1 : 0 }).format(kb);
    return `${n} KB`;
  }
  const mb = kb / 1024;
  const n = new Intl.NumberFormat(intl, { maximumFractionDigits: 1 }).format(mb);
  return `${n} MB`;
}
