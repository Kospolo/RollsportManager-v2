import { club, currentUser, members, onViewerChange } from "@/lib/mock";
import type {
  ClubEntitlement,
  DocumentItem,
  GalleryItem,
  GalleryKind,
  PhotoTag,
} from "@/lib/types";
import type { DataRepository } from "../types";
import { documentSeed, gallerySeed } from "./seed-batch5";

/**
 * Mock-Implementierung der Batch-5-Module (Galerie, Dokumente, Entitlement).
 * Eigene In-Memory-Stores (Session-Lebensdauer), kein echter Rechtecheck — die
 * Wahrheit ist im api-Modus der Server (RLS + Entitlement).
 *
 * Der Demo-Verein (Club A) ist im Seed auf Tier 'pro' → getClubEntitlement liefert
 * pro:true, das Modul ist nutzbar. Uploads erzeugen eine lokale Object-URL (bzw.
 * einen Fallback-Marker in Test-Umgebungen ohne URL.createObjectURL) und legen
 * die Zeile in-memory ab; loadMediaUrl gibt storageKey unverändert zurück.
 */

const clubId = club.id;
/**
 * Aktuelle Person (Mock) — spiegelt mockRepository.getCurrentUser.
 * `let` + Melderegister, weil /entwickler die Person wechseln kann; eine
 * Kopie beim Laden des Moduls zeigte sonst dauerhaft auf Sandra Vogel.
 */
let currentMemberId = currentUser.id;
onViewerChange(() => {
  currentMemberId = currentUser.id;
});
const nowIso = (): string => new Date().toISOString();

const galleryStore: GalleryItem[] = gallerySeed.map((g) => ({ ...g }));
const documentStore: DocumentItem[] = documentSeed.map((d) => ({ ...d }));

/**
 * In-Memory-Markierungen (Mock). Kein echter Rechte-/Einwilligungs-Check — die
 * Wahrheit ist im api-Modus der Server (Migration 0056: Staff markiert, RLS +
 * Einwilligung filtern die Sicht). Ein paar Seed-Markierungen zur Demo.
 */
const photoTagStore: PhotoTag[] = [
  {
    id: "ptag-01",
    clubId,
    galleryItemId: gallerySeed[0]?.id ?? "gal-01",
    memberId: "m-16",
    taggedByMemberId: members[0].id,
    createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  },
  {
    id: "ptag-02",
    clubId,
    galleryItemId: gallerySeed[0]?.id ?? "gal-01",
    memberId: "m-07",
    taggedByMemberId: members[0].id,
    createdAt: new Date(Date.now() - 3 * 86_400_000 + 1000).toISOString(),
  },
];

let gallerySeq = galleryStore.length;
let docSeq = documentStore.length;
let photoTagSeq = photoTagStore.length;

/** Demo-Entitlement: Club A ist im Seed 'pro' (unbefristet). */
const entitlement: ClubEntitlement = { clubId, pro: true, tier: "pro" };

/** Die 8 Batch-5-Modul-Methoden — wird in mockRepository gespreizt. */
type ModuleMethods = Pick<
  DataRepository,
  | "getClubEntitlement"
  | "listGallery"
  | "uploadGalleryItem"
  | "deleteGalleryItem"
  | "listPhotoTags"
  | "tagPhoto"
  | "removePhotoTag"
  | "listDocuments"
  | "uploadDocument"
  | "deleteDocument"
  | "loadMediaUrl"
>;

/** Lokale, sofort nutzbare URL für eine hochgeladene Datei (Mock-Serving). */
function localUrl(file: File): string {
  if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    return URL.createObjectURL(file);
  }
  return `mock-media:${encodeURIComponent(file.name)}`;
}

export const moduleRepositoryBatch5: ModuleMethods = {
  /* ---------- Entitlement / PRO-Gate ---------- */
  async getClubEntitlement(): Promise<ClubEntitlement> {
    return entitlement;
  },

  /* ---------- Galerie ---------- */
  async listGallery(): Promise<GalleryItem[]> {
    return [...galleryStore].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async uploadGalleryItem(file, meta): Promise<GalleryItem> {
    const kind: GalleryKind = (file.type || "").startsWith("video/") ? "video" : "photo";
    const now = nowIso();
    const created: GalleryItem = {
      id: `gal-local-${++gallerySeq}`,
      clubId,
      album: meta.album,
      title: meta.title,
      kind,
      storageKey: localUrl(file),
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      thumbnailKey: meta.thumbnailKey,
      uploadedByMemberId: currentMemberId,
      createdAt: now,
    };
    galleryStore.unshift(created);
    return created;
  },
  async deleteGalleryItem(itemId): Promise<{ id: string }> {
    const idx = galleryStore.findIndex((g) => g.id === itemId);
    if (idx >= 0) galleryStore.splice(idx, 1);
    // Markierungen des Objekts mitnehmen (im api-Modus per composite-FK/RLS).
    for (let i = photoTagStore.length - 1; i >= 0; i--) {
      if (photoTagStore[i].galleryItemId === itemId) photoTagStore.splice(i, 1);
    }
    return { id: itemId };
  },

  /* ---------- Foto-Markierungen ("wer ist auf dem Bild") ---------- */
  async listPhotoTags(galleryItemId): Promise<PhotoTag[]> {
    return photoTagStore
      .filter((t) => t.galleryItemId === galleryItemId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((t) => ({ ...t }));
  },
  async tagPhoto(galleryItemId, memberId): Promise<PhotoTag> {
    // Doppel-Markierung derselben Person vermeiden (im api-Modus via unique idx).
    const existing = photoTagStore.find(
      (t) => t.galleryItemId === galleryItemId && t.memberId === memberId,
    );
    if (existing) return { ...existing };
    const created: PhotoTag = {
      id: `ptag-local-${++photoTagSeq}`,
      clubId,
      galleryItemId,
      memberId,
      taggedByMemberId: currentMemberId,
      createdAt: nowIso(),
    };
    photoTagStore.push(created);
    return { ...created };
  },
  async removePhotoTag(tagId): Promise<{ id: string }> {
    const idx = photoTagStore.findIndex((t) => t.id === tagId);
    if (idx >= 0) photoTagStore.splice(idx, 1);
    return { id: tagId };
  },

  /* ---------- Dokumente ---------- */
  async listDocuments(): Promise<DocumentItem[]> {
    return [...documentStore].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async uploadDocument(file, meta): Promise<DocumentItem> {
    const now = nowIso();
    const created: DocumentItem = {
      id: `doc-local-${++docSeq}`,
      clubId,
      title: meta.title,
      category: meta.category ?? "Allgemein",
      storageKey: localUrl(file),
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      uploadedByMemberId: currentMemberId,
      createdAt: now,
      updatedAt: now,
    };
    documentStore.unshift(created);
    return created;
  },
  async deleteDocument(documentId): Promise<{ id: string }> {
    const idx = documentStore.findIndex((d) => d.id === documentId);
    if (idx >= 0) documentStore.splice(idx, 1);
    return { id: documentId };
  },

  /* ---------- Media-Serving ---------- */
  async loadMediaUrl(storageKey): Promise<string> {
    // Mock: storageKey ist bereits eine nutzbare URL (data:/blob:).
    return storageKey;
  },
};
