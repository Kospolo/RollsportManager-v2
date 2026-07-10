import { club, members } from "@/lib/mock";
import type { DocumentItem, GalleryItem } from "@/lib/types";

/**
 * Start-Seed der Batch-5-Modul-Stores (Galerie, Dokumente) für den Mock-Modus.
 * Echte Umlaute, DE-Inhalte, plausible Mitglieder-IDs aus lib/mock.
 *
 * Im Mock-Modus ist storageKey KEIN opaker Schlüssel, sondern eine direkt
 * nutzbare URL (data:) — loadMediaUrl gibt sie unverändert zurück, damit die
 * Galerie auch ohne Dev-Stack Bilder rendert. Im api-Modus ist storageKey opak
 * und wird über GET /media/{key} aufgelöst.
 */

const clubId = club.id;
const uploader = members[0].id; // m-01, Sandra Vogel (Coach)

/** ISO-Zeitstempel vor n Tagen. */
const daysAgo = (days: number): string =>
  new Date(Date.now() - days * 86_400_000).toISOString();

/** Kleines farbiges SVG als data:-URL (rendert ohne externe Assets). */
const svgPhoto = (label: string, bg: string): string => {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320">` +
    `<rect width="100%" height="100%" fill="${bg}"/>` +
    `<text x="50%" y="50%" fill="#ffffff" font-family="sans-serif" font-size="26" ` +
    `text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

/** Minimale gültige PDF als data:-URL (Platzhalter-Dokument). */
const pdfPlaceholder =
  "data:application/pdf;base64,JVBERi0xLjQKJcODw6nDgcO0CjEgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDIgMCBSPj4KZW5kb2JqCjIgMCBvYmoKPDwvVHlwZS9QYWdlcy9LaWRzWzMgMCBSXS9Db3VudCAxPj4KZW5kb2JqCjMgMCBvYmoKPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgMzAwIDE0NF0+PgplbmRvYmoKdHJhaWxlcgo8PC9Sb290IDEgMCBSPj4KJSVFT0Y=";

export const gallerySeed: GalleryItem[] = [
  {
    id: "gal-01",
    clubId,
    album: "Vereinsmeisterschaft 2025",
    title: "Siegerehrung Kür",
    kind: "photo",
    storageKey: svgPhoto("Siegerehrung", "#2563eb"),
    contentType: "image/svg+xml",
    sizeBytes: 24_500,
    uploadedByMemberId: uploader,
    createdAt: daysAgo(3),
  },
  {
    id: "gal-02",
    clubId,
    album: "Vereinsmeisterschaft 2025",
    title: "Aufwärmen in der Halle",
    kind: "photo",
    storageKey: svgPhoto("Aufwärmen", "#16a34a"),
    contentType: "image/svg+xml",
    sizeBytes: 21_200,
    uploadedByMemberId: uploader,
    createdAt: daysAgo(3),
  },
  {
    id: "gal-03",
    clubId,
    album: "Trainingslager",
    title: "Gruppenfoto Nachwuchs",
    kind: "photo",
    storageKey: svgPhoto("Nachwuchs", "#db2777"),
    contentType: "image/svg+xml",
    sizeBytes: 30_100,
    uploadedByMemberId: uploader,
    createdAt: daysAgo(12),
  },
  {
    id: "gal-04",
    clubId,
    album: "Trainingslager",
    title: "Kür-Mitschnitt Leistungsgruppe",
    kind: "video",
    storageKey: svgPhoto("Video", "#7c3aed"),
    contentType: "video/mp4",
    sizeBytes: 8_400_000,
    thumbnailKey: svgPhoto("Video", "#7c3aed"),
    uploadedByMemberId: uploader,
    createdAt: daysAgo(12),
  },
];

export const documentSeed: DocumentItem[] = [
  {
    id: "doc-01",
    clubId,
    title: "Vereinssatzung 2024",
    category: "Satzung",
    storageKey: pdfPlaceholder,
    contentType: "application/pdf",
    sizeBytes: 128_400,
    uploadedByMemberId: uploader,
    createdAt: daysAgo(40),
    updatedAt: daysAgo(40),
  },
  {
    id: "doc-02",
    clubId,
    title: "Beitragsordnung",
    category: "Finanzen",
    storageKey: pdfPlaceholder,
    contentType: "application/pdf",
    sizeBytes: 64_800,
    uploadedByMemberId: uploader,
    createdAt: daysAgo(25),
    updatedAt: daysAgo(10),
  },
  {
    id: "doc-03",
    clubId,
    title: "Hallenordnung Rollsporthalle",
    category: "Organisation",
    storageKey: pdfPlaceholder,
    contentType: "application/pdf",
    sizeBytes: 42_300,
    uploadedByMemberId: uploader,
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5),
  },
];
