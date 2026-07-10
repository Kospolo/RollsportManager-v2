import { ApiError } from "@/lib/api/generated";
import type { MediaUploadResult } from "@/lib/types";
import { readSession } from "@/lib/auth/storage";
import { API_BASE_URL } from "../config";
import { ClubProRequiredError } from "../errors";
import type { DataRepository } from "../types";
import { activeClubId, apiClient } from "./client";
import { deriveEntitlement, mapDocument, mapGalleryItem } from "./mappers-batch5";

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

/** Bearer-Header aus der Dev-Auth-Session (leer, wenn nicht angemeldet). */
function authHeaders(): Record<string, string> {
  const token = readSession()?.token;
  return token ? { authorization: `Bearer ${token}` } : {};
}

/** Fehler einer nicht-typisierten Media-Antwort: 402 → PRO-Hinweis, sonst ApiError. */
async function mediaError(res: Response, feature: string): Promise<Error> {
  let problem: { detail?: string; title?: string } | null = null;
  try {
    problem = (await res.json()) as { detail?: string; title?: string };
  } catch {
    // non-JSON body — problem bleibt null
  }
  if (res.status === 402 && (problem?.detail ?? "").startsWith("club_pro_required")) {
    return new ClubProRequiredError(feature);
  }
  const detail = problem?.detail ?? problem?.title ?? res.statusText;
  return new ApiError(res.status, null, `Media ${feature} -> ${res.status}: ${detail}`);
}

/** 402 club_pro_required aus einem typisierten Call → ClubProRequiredError. */
async function proGuard<T>(p: Promise<T>, feature: string): Promise<T> {
  try {
    return await p;
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 402 &&
      (error.problem?.detail ?? "").startsWith("club_pro_required")
    ) {
      throw new ClubProRequiredError(feature);
    }
    throw error;
  }
}

/**
 * Stufe 1 des Uploads: Datei per multipart an POST /media/upload. KEIN
 * content-type-Header setzen — der Browser setzt multipart/form-data inkl.
 * boundary selbst.
 */
async function uploadMedia(clubId: string, file: File, feature: string): Promise<MediaUploadResult> {
  const form = new FormData();
  form.set("club_id", clubId);
  form.set("file", file);
  const res = await fetch(`${API_BASE_URL}/media/upload`, {
    method: "POST",
    headers: { ...authHeaders() },
    body: form,
  });
  if (!res.ok) throw await mediaError(res, feature);
  const j = (await res.json()) as {
    storage_key: string;
    content_type: string;
    size_bytes: number;
    kind: MediaUploadResult["kind"];
  };
  return {
    storageKey: j.storage_key,
    contentType: j.content_type,
    sizeBytes: j.size_bytes,
    kind: j.kind,
  };
}

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
