/**
 * Kleine, reine Helfer rund um Galerie-Medien (Content-Type → Dateiendung,
 * Download-Dateiname, Kind-Erkennung). Kein React, kein Fetch — nur Strings.
 */

/** Erlaubte Upload-Typen (Client-Vorprüfung; die verbindliche Allowlist ist serverseitig). */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
  "image/heic": "heic",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "application/pdf": "pdf",
};

/** Dateiendung aus dem Content-Type (Fallback „bin"). */
export function extensionFor(contentType: string): string {
  return EXT_BY_TYPE[contentType.toLowerCase()] ?? "bin";
}

/** „Siegerehrung Kür" + image/jpeg → „siegerehrung-kuer.jpg" (für den Download-Link). */
export function downloadName(title: string, contentType: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "medium"}.${extensionFor(contentType)}`;
}

/** true, wenn der Content-Type ein Video ist (Play-Overlay statt reinem Bild). */
export function isVideoType(contentType: string): boolean {
  return contentType.toLowerCase().startsWith("video/");
}
