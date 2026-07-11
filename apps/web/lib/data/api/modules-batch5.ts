import { API_BASE_URL } from "../config";
import type { DataRepository } from "../types";
import { activeClubId, apiClient } from "./client";
import { deriveEntitlement, mapDocument, mapGalleryItem } from "./mappers-batch5";
import { authHeaders, mediaError, proGuard, uploadMedia } from "./media-fetch";

/**
 * API-Implementierung der Batch-5-Module (Galerie, Dokumente, Entitlement).
 * Ausgelagert aus api/index.ts (< 400 Zeilen).
 *
 * Rechte SERVERSEITIG (RLS + Entitlement): Lesen = is_club_member + PRO,
 * Schreiben = is_club_trainer + PRO. Ohne PRO liefert die API HTTP 402
 * (detail 'club_pro_required'); hier zu ClubProRequiredError übersetzt, damit
 * die Screens den Upgrade-Hinweis zeigen. Upload/Serve (POST /media/upload,
 * GET /media/{key}) sind bewusst NICHT in der OpenAPI-Spec und laufen daher als
 * multipart-fetch bzw. fetch+Object-URL direkt gegen die API (Bearer im Header).
 */

/** Die 8 Batch-5-Modul-Methoden — wird in apiRepository gespreizt. */
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

export const moduleApiRepositoryBatch5: ModuleMethods = {
  /* ---------- Entitlement / PRO-Gate ---------- */
  async getClubEntitlement() {
    const clubId = activeClubId();
    const rows = await apiClient.getEntitlementsByClubId(clubId);
    return deriveEntitlement(clubId, rows);
  },

  /* ---------- Galerie ---------- */
  async listGallery() {
    const rows = await proGuard(
      apiClient.getGallery({ club_id: activeClubId() }),
      "Galerie",
    );
    return rows.map(mapGalleryItem);
  },
  async uploadGalleryItem(file, meta) {
    const clubId = activeClubId();
    const up = await uploadMedia(clubId, file, "Galerie");
    const created = await proGuard(
      apiClient.postGallery({
        club_id: clubId,
        title: meta.title,
        kind: up.kind,
        storage_key: up.storageKey,
        content_type: up.contentType,
        size_bytes: up.sizeBytes,
        album: meta.album,
        thumbnail_key: meta.thumbnailKey,
      }),
      "Galerie",
    );
    return mapGalleryItem(created);
  },
  async deleteGalleryItem(itemId) {
    const deleted = await proGuard(apiClient.deleteGalleryByItemId(itemId), "Galerie");
    return { id: deleted.id };
  },

  /* ---------- Dokumente ---------- */
  async listDocuments() {
    const rows = await proGuard(
      apiClient.getDocuments({ club_id: activeClubId() }),
      "Dokumente",
    );
    return rows.map(mapDocument);
  },
  async uploadDocument(file, meta) {
    const clubId = activeClubId();
    const up = await uploadMedia(clubId, file, "Dokumente");
    const created = await proGuard(
      apiClient.postDocuments({
        club_id: clubId,
        title: meta.title,
        category: meta.category,
        storage_key: up.storageKey,
        content_type: up.contentType,
        size_bytes: up.sizeBytes,
      }),
      "Dokumente",
    );
    return mapDocument(created);
  },
  async deleteDocument(documentId) {
    const deleted = await proGuard(
      apiClient.deleteDocumentsByDocumentId(documentId),
      "Dokumente",
    );
    return { id: deleted.id };
  },

  /* ---------- Media-Serving (auth-geschützt → Object-URL) ---------- */
  async loadMediaUrl(storageKey) {
    const res = await fetch(`${API_BASE_URL}/media/${encodeURIComponent(storageKey)}`, {
      headers: { ...authHeaders() },
    });
    if (!res.ok) throw await mediaError(res, "Medien-Abruf");
    return URL.createObjectURL(await res.blob());
  },
};
