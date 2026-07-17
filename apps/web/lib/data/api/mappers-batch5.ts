import type * as M from "@/lib/api/generated";
import type {
  ClubEntitlement,
  DocumentItem,
  EntitlementTier,
  GalleryItem,
  PhotoTag,
} from "@/lib/types";

/**
 * Mapper der Batch-5-Module (Galerie, Dokumente, Entitlement):
 * API-Wire-Format (snake_case, `T | null`) → View-Typen (lib/types, camelCase,
 * optionale Felder). Ausgelagert aus api/mappers.ts (< 400 Zeilen).
 */

export function mapGalleryItem(w: M.GalleryItem): GalleryItem {
  return {
    id: w.id,
    clubId: w.club_id,
    album: w.album ?? undefined,
    title: w.title,
    kind: w.kind,
    storageKey: w.storage_key,
    contentType: w.content_type,
    sizeBytes: w.size_bytes ?? undefined,
    thumbnailKey: w.thumbnail_key ?? undefined,
    uploadedByMemberId: w.uploaded_by_member_id,
    createdAt: w.created_at,
  };
}

export function mapPhotoTag(w: M.PhotoTag): PhotoTag {
  return {
    id: w.id,
    clubId: w.club_id,
    galleryItemId: w.gallery_item_id,
    memberId: w.member_id,
    taggedByMemberId: w.tagged_by_member_id,
    createdAt: w.created_at,
  };
}

export function mapDocument(w: M.Document): DocumentItem {
  return {
    id: w.id,
    clubId: w.club_id,
    title: w.title,
    category: w.category,
    storageKey: w.storage_key,
    contentType: w.content_type,
    sizeBytes: w.size_bytes ?? undefined,
    uploadedByMemberId: w.uploaded_by_member_id,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

/**
 * Zeile aktiv? Spiegelt app.is_club_pro: nicht abgelaufen (unbefristet ODER
 * valid_until in der Zukunft) UND Status active/trial (fehlender Status = aktiv,
 * wie ein manuell gesetztes Legacy-Recht).
 */
function isActiveRow(r: M.Entitlement): boolean {
  const notExpired = r.valid_until == null || r.valid_until >= new Date().toISOString();
  const status = (r.status ?? "active").toLowerCase();
  return notExpired && (status === "active" || status === "trial");
}

/**
 * Entitlement-Rohzeilen (GET /entitlements/{clubId}) → abgeleitete PRO-Sicht.
 * pro = eine aktive Zeile mit Tier pro ODER premium (metadata.tier). Tier
 * bevorzugt premium. Spiegelt exakt app.is_club_pro fürs UI-Gate — das echte,
 * verbindliche Gate bleibt serverseitig (RLS + 402).
 */
export function deriveEntitlement(clubId: string, rows: M.Entitlement[]): ClubEntitlement {
  const active = rows.filter(isActiveRow);
  const tierOf = (r: M.Entitlement) => (r.tier ?? "").toLowerCase();
  const premiumRow = active.find((r) => tierOf(r) === "premium");
  const proRow = premiumRow ?? active.find((r) => tierOf(r) === "pro");
  const tier: EntitlementTier = premiumRow ? "premium" : proRow ? "pro" : "free";
  return {
    clubId,
    pro: proRow != null,
    tier,
    validUntil: proRow?.valid_until ?? undefined,
  };
}
