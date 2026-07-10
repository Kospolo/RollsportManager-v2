import type { Id } from "./types";

/**
 * View-Typen der Batch-5-Module (Galerie, Dokumente, Entitlement/PRO-Gate).
 * Ausgelagert aus lib/types.ts (< 400 Zeilen) und dort per
 * `export type * from "./types-batch5"` wieder unter "@/lib/types" verfügbar.
 * Die Label-Map galleryKindLabels (DE/EN, echte Umlaute) wird zusätzlich als
 * Wert aus lib/types.ts re-exportiert.
 *
 * Rechte sind SERVERSEITIG (RLS + Entitlement, Referenz „Galerie/Dokumente =
 * PRO"): Lesen = is_club_member UND aktives Entitlement (Tier pro/premium),
 * Schreiben = is_club_trainer UND Entitlement. Ohne Entitlement antwortet die
 * API mit HTTP 402 (detail-Prefix 'club_pro_required'); die Facade übersetzt
 * das in einen eigenen Fehlertyp (ClubProRequiredError), damit die Screens den
 * Upgrade-Hinweis / das PRO-Badge zeigen statt zu crashen. Der Datei-Upload
 * (POST /media/upload) und das Serve (GET /media/{key}) sind bewusst NICHT in
 * der OpenAPI-Spec — die Facade spricht sie per multipart-fetch bzw.
 * fetch+Object-URL direkt an (Bearer-Token im Header).
 */

/* ---------- Galerie (Fotos & Videos, PRO) ---------- */

/** Art eines Galerie-Objekts: Foto oder Video. */
export type GalleryKind = "photo" | "video";

/**
 * Ein Galerie-Objekt (GET /gallery, neueste zuerst). storageKey ist ein opaker
 * Schlüssel; die Bytes liegen unter GET /media/{storageKey} (auth-geschützt →
 * NICHT direkt als <img src> nutzbar, sondern über loadMediaUrl laden). Bei
 * Videos verweist thumbnailKey optional auf ein Vorschaubild. sizeBytes kann
 * fehlen (bigint-Spalte nullable). uploadedByMemberId wird serverseitig aus der
 * eigenen club_members-Zeile aufgelöst.
 */
export interface GalleryItem {
  id: Id;
  clubId: Id;
  /** Optionales Album zur Gruppierung. */
  album?: string;
  title: string;
  kind: GalleryKind;
  /** Opaker Schlüssel → GET /media/{storageKey} (über loadMediaUrl). */
  storageKey: string;
  contentType: string;
  /** Dateigröße in Bytes (kann fehlen). */
  sizeBytes?: number;
  /** Opaker Schlüssel des Vorschaubilds (v. a. bei Videos). */
  thumbnailKey?: string;
  uploadedByMemberId: Id;
  createdAt: string;
}

/* ---------- Dokumente (PDFs u. a., PRO) ---------- */

/**
 * Ein Dokument (GET /documents, neueste zuerst). Wie GalleryItem liegen die
 * Bytes unter GET /media/{storageKey} (auth-geschützt → loadMediaUrl). category
 * ist Freitext zur Ablage-Gruppierung (Default serverseitig).
 */
export interface DocumentItem {
  id: Id;
  clubId: Id;
  title: string;
  category: string;
  /** Opaker Schlüssel → GET /media/{storageKey} (über loadMediaUrl). */
  storageKey: string;
  contentType: string;
  /** Dateigröße in Bytes (kann fehlen). */
  sizeBytes?: number;
  uploadedByMemberId: Id;
  createdAt: string;
  updatedAt: string;
}

/* ---------- Entitlement / PRO-Gate ---------- */

/** Lizenz-Stufe eines Vereins: kostenlos, PRO oder Premium. */
export type EntitlementTier = "free" | "pro" | "premium";

/**
 * Abgeleitete Entitlement-Sicht eines Vereins fürs UI-Gate. `pro` ist true, wenn
 * ein aktives Entitlement der Stufe pro ODER premium vorliegt (oder der Caller
 * Plattform-Admin ist) — genau die Bedingung, die serverseitig Galerie +
 * Dokumente freischaltet (app.is_club_pro). Das Gate ist trotzdem SERVERSEITIG
 * verbindlich; dieses Flag steuert nur, ob die UI das Modul oder den
 * Upgrade-Hinweis zeigt. validUntil = Ablaufdatum (undefined = unbefristet).
 */
export interface ClubEntitlement {
  clubId: Id;
  pro: boolean;
  tier: EntitlementTier;
  /** ISO-Zeitstempel des Ablaufs (undefined = unbefristet). */
  validUntil?: string;
}

/**
 * Ergebnis der ersten Upload-Stufe (POST /media/upload). kind wird aus dem
 * Content-Type serverseitig bestimmt und in die zweite Stufe (createGalleryItem)
 * übernommen. Für Dokumente ist kind irrelevant.
 */
export interface MediaUploadResult {
  storageKey: string;
  contentType: string;
  sizeBytes: number;
  kind: GalleryKind;
}

/* ---------- Enum-Labels (DE/EN, echte Umlaute) ---------- */

/** Anzeige-Labels für GalleryKind in beiden Sprachen. */
export const galleryKindLabels: Record<GalleryKind, { de: string; en: string }> = {
  photo: { de: "Foto", en: "Photo" },
  video: { de: "Video", en: "Video" },
};
