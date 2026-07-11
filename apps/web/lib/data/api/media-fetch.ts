import { ApiError } from "@/lib/api/generated";
import { readSession } from "@/lib/auth/storage";
import type { MediaUploadResult } from "@/lib/types";
import { API_BASE_URL } from "../config";
import { ClubProRequiredError } from "../errors";

/**
 * Geteilte Fetch-Helfer für die NICHT im OpenAPI-Contract enthaltenen
 * Media-Routen (POST /media/upload, GET /media/{key}, DELETE /me/photo).
 * Diese laufen als roher fetch mit Bearer-Header aus der Dev-Auth-Session —
 * genutzt von Galerie/Dokumenten (Batch 5), Chat-Bild (Batch 4) und dem
 * Profilfoto-Entfernen (Me).
 */

/** Bearer-Header aus der Dev-Auth-Session (leer, wenn nicht angemeldet). */
export function authHeaders(): Record<string, string> {
  const token = readSession()?.token;
  return token ? { authorization: `Bearer ${token}` } : {};
}

/** Fehler einer nicht-typisierten Media-Antwort: 402 → PRO-Hinweis, sonst ApiError. */
export async function mediaError(res: Response, feature: string): Promise<Error> {
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
export async function proGuard<T>(p: Promise<T>, feature: string): Promise<T> {
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
export async function uploadMedia(
  clubId: string,
  file: File,
  feature: string,
): Promise<MediaUploadResult> {
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

/** Absolute, Bearer-auflösbare URL zu einem opaken Storage-Key. */
export function mediaKeyUrl(storageKey: string): string {
  return `${API_BASE_URL}/media/${encodeURIComponent(storageKey)}`;
}
