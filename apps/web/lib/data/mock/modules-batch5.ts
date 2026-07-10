import { club, members } from "@/lib/mock";
import type { ClubEntitlement, DocumentItem, GalleryItem, GalleryKind } from "@/lib/types";
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
/** Aktuelle Person (Mock) — spiegelt mockRepository.getCurrentUser (m-01). */
const currentMemberId = members[0].id;
const nowIso = (): string => new Date().toISOString();

const galleryStore: GalleryItem[] = gallerySeed.map((g) => ({ ...g }));
const documentStore: DocumentItem[] = documentSeed.map((d) => ({ ...d }));

let gallerySeq = galleryStore.length;
let docSeq = documentStore.length;

/** Demo-Entitlement: Club A ist im Seed 'pro' (unbefristet). */
const entitlement: ClubEntitlement = { clubId, pro: true, tier: "pro" };

/** Die 8 Batch-5-Modul-Methoden — wird in mockRepository gespreizt. */
type ModuleMethods = Pick<
  DataRepository,
  | "getClubEntitlement"
  | "listGallery"
  | "uploadGalleryItem"
  | "deleteGalleryItem"
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
    return { id: itemId };
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
