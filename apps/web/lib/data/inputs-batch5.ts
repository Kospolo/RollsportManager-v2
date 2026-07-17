import type { ClubEntitlement, DocumentItem, GalleryItem, Id, PhotoTag } from "@/lib/types";

/**
 * Eingabe-Typen + Repository-Slice der Batch-5-Module (Galerie, Dokumente,
 * Entitlement/PRO-Gate). Ausgelagert aus lib/data/types.ts, damit beide Dateien
 * < 400 Zeilen bleiben. Re-exportiert über lib/data/index.ts.
 *
 * Rechte sind SERVERSEITIG (RLS + Entitlement): Lesen = is_club_member + PRO,
 * Schreiben = is_club_trainer + PRO. Der Upload ist ZWEISTUFIG und liegt in der
 * Facade gekapselt (uploadGalleryItem/uploadDocument): Stufe 1 lädt die Datei
 * per multipart an POST /media/upload (nicht in der Spec) und liefert
 * storage_key/content_type/size_bytes/kind, Stufe 2 legt die Metadaten-Zeile an
 * (POST /gallery bzw. POST /documents). Ohne PRO wirft die Facade
 * ClubProRequiredError (aus 402 club_pro_required).
 */

/* ---------- Galerie ---------- */

/**
 * Metadaten für uploadGalleryItem (Trainer+PRO). kind wird NICHT übergeben — es
 * kommt aus der Upload-Antwort (Content-Type). album/thumbnailKey optional.
 */
export interface GalleryUploadMeta {
  title: string;
  /** Optionales Album zur Gruppierung. */
  album?: string;
  /** Opaker Schlüssel eines vorab hochgeladenen Vorschaubilds (v. a. Videos). */
  thumbnailKey?: string;
}

/* ---------- Dokumente ---------- */

/**
 * Metadaten für uploadDocument (Trainer+PRO). category optional (Default
 * serverseitig, z. B. „Allgemein").
 */
export interface DocumentUploadMeta {
  title: string;
  category?: string;
}

/* ---------- Repository-Slice der Batch-5-Module ---------- */

/**
 * Facade-Methoden der Batch-5-Module (Galerie, Dokumente, Entitlement).
 * Ausgelagert aus lib/data/types.ts (< 400 Zeilen); DataRepository erbt davon.
 * Rechte SERVERSEITIG — die UI gatet nur zur Anzeige (getClubEntitlement().pro).
 */
export interface Batch5Repository {
  /* ---------- Entitlement / PRO-Gate ---------- */
  /**
   * Abgeleitete Entitlement-Sicht des aktiven Vereins (pro-Flag + Tier). Steuert,
   * ob die UI Galerie/Dokumente zeigt oder den Upgrade-Hinweis. Das eigentliche
   * Gate bleibt serverseitig (402 club_pro_required).
   */
  getClubEntitlement(): Promise<ClubEntitlement>;

  /* ---------- Galerie (PRO) ---------- */
  /** Galerie des aktiven Vereins, neueste zuerst (Lesen = Mitglied + PRO). */
  listGallery(): Promise<GalleryItem[]>;
  /**
   * Datei hochladen UND als Galerie-Objekt anlegen (Trainer + PRO). Zweistufig:
   * POST /media/upload → POST /gallery. Wirft ClubProRequiredError ohne PRO.
   */
  uploadGalleryItem(file: File, meta: GalleryUploadMeta): Promise<GalleryItem>;
  /** Galerie-Objekt soft-löschen (Trainer + PRO) — liefert die gelöschte ID zurück. */
  deleteGalleryItem(itemId: Id): Promise<{ id: Id }>;

  /* ---------- Foto-Markierungen ("wer ist auf dem Bild") ---------- */
  /**
   * Markierungen eines Galerie-Objekts (GET /gallery/{itemId}/tags). Die Sicht
   * ist RLS-gescoped: Staff und Betroffene sehen alle, übrige nur eingewilligte.
   * Das ist die VERWALTUNGS-Sicht der Galerie, NICHT die Profil-Anzeige.
   */
  listPhotoTags(galleryItemId: Id): Promise<PhotoTag[]>;
  /**
   * Eine Person auf einem Galerie-Objekt markieren (POST /photo-tags). Erlaubt
   * NUR Staff (Trainer/Vorstand/Moderator, OHNE Kassenwart) — serverseitig
   * erzwungen; tagged_by ergibt sich aus dem Token. Ein 403 bleibt möglich, auch
   * wenn die UI den Knopf zeigt (der Server ist die Grenze).
   */
  tagPhoto(galleryItemId: Id, memberId: Id): Promise<PhotoTag>;
  /**
   * Eine Markierung entfernen (DELETE /photo-tags/{tagId}, Soft-Delete). Erlaubt
   * der markierten Person, einem Vormund ODER Staff — serverseitig erzwungen.
   */
  removePhotoTag(tagId: Id): Promise<{ id: Id }>;

  /* ---------- Dokumente (PRO) ---------- */
  /** Dokumente des aktiven Vereins, neueste zuerst (Lesen = Mitglied + PRO). */
  listDocuments(): Promise<DocumentItem[]>;
  /**
   * Datei hochladen UND als Dokument anlegen (Trainer + PRO). Zweistufig:
   * POST /media/upload → POST /documents. Wirft ClubProRequiredError ohne PRO.
   */
  uploadDocument(file: File, meta: DocumentUploadMeta): Promise<DocumentItem>;
  /** Dokument soft-löschen (Trainer + PRO) — liefert die gelöschte ID zurück. */
  deleteDocument(documentId: Id): Promise<{ id: Id }>;

  /* ---------- Media-Serving (auth-geschützt) ---------- */
  /**
   * Bytes zu einem opaken storageKey laden und als Object-URL zurückgeben —
   * nutzbar in <img src> / <a href>. GET /media/{key} ist auth-geschützt, daher
   * NICHT direkt verlinkbar. Der Aufrufer gibt die URL nach Gebrauch per
   * URL.revokeObjectURL wieder frei. (Prod: signierte URLs → nur diese Schicht
   * tauschen.) Im Mock-Modus ist storageKey bereits eine nutzbare URL und wird
   * unverändert zurückgegeben.
   */
  loadMediaUrl(storageKey: string): Promise<string>;
}
