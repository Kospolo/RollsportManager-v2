// ============================================================================
// modules/media/club-logo.ts — das Vereinslogo (Migration 0060).
//
//   POST   /clubs/{clubId}/logo          multipart/form-data (field: file, image)
//   DELETE /clubs/{clubId}/logo
//   GET    /public/clubs/{clubId}/logo   die Bytes (OEFFENTLICH, siehe unten)
//
// === WARUM DIREKT, KEIN CLIENT-KEY (die Lehre aus dem Kueren-Medien-Leck) ===
// Wie routine-media.ts: der Upload laeuft in EINEM Schritt, der storage_key wird
// SERVERSEITIG erzeugt (generateStorageKey) und die media_assets-Zeile mit
// club_id = dem eigenen Verein (aus dem Pfad, serverseitig) angelegt. Es gibt
// KEINEN vom Client gelieferten Key — genau der war das mandantenuebergreifende
// Leck (Revert 6dafb38). Ein Aufrufer kann keine fremden Bytes referenzieren.
//
// === RECHTE ===
// Nur owner/admin — das Logo gehoert zu den Vereins-Stammdaten, und exakt diese
// Rolle darf app.clubs aendern (clubs_update = owner/admin, 0002). moderator ist
// bewusst NICHT dabei: er darf Module/Rollen stellen, aber nicht die
// Stammdaten. requireClubRoleDb liefert das ehrliche 403; die clubs_update-RLS
// unter withUser ist die zweite, entscheidende Schranke.
//
// === KEIN PRO-GATE ===
// Anders als /media/upload (Galerie/Dokumente = PRO): ein Vereinslogo ist eine
// Basis-Funktion. Ein kleiner Verein ohne PRO-Abo soll sein Wappen zeigen
// duerfen. Deshalb hier bewusst KEIN assertClubPro.
//
// === SICHTBARKEIT: die GET-Route ist OEFFENTLICH ===
// Ein Vereinslogo ist ein oeffentliches Marken-Asset: es steht in der Shell
// jedes Mitglieds, in der Betreiber-Vereinsliste und kann auf Login/Landing
// erscheinen (dort ist niemand angemeldet). Die Serve-Route liegt deshalb unter
// /public/ (app.ts PUBLIC_PREFIXES) und ist auth-frei. Sie loest AUSSCHLIESSLICH
// clubs.logo_asset_id auf — kein anderes Medium ist ueber sie erreichbar,
// media_assets_select (is_club_member, 0004) bleibt fuer alles andere die
// Grenze. Ein POST/DELETE unter /public/ gibt es nicht; Upload/Loeschen bleiben
// unter dem authentifizierten /clubs/{id}/logo.
//
// Plain Hono (rohe Bytes), also — wie /media/upload und routine-media —
// ABSICHTLICH NICHT im OpenAPI-Contract. KEIN `returning *` auf app.clubs: seit
// 0035 ist das Leserecht auf join_code entzogen, `*`/`returning *` = 42501.
// ============================================================================

import { Hono } from 'hono';
import type { AuthEnv } from '../../middleware/auth.js';
import { problem } from '../../middleware/error.js';
import { withServiceRole, withUser } from '../../db.js';
import { requireClubRoleDb } from '../../lib/capabilities.js';
import { CLUB_COLUMNS } from '../../routes/clubs.js';
import { clubSchema } from '../../lib/validation.js';
import {
  MAX_UPLOAD_BYTES,
  contentTypeFromKey,
  deleteBytes,
  generateStorageKey,
  isAllowedContentType,
  readBytes,
  saveBytes,
} from './storage.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Nur die Vereins-Stammdaten-Rollen (clubs_update = owner/admin). */
const LOGO_ROLES = ['owner', 'admin'] as const;

export function createClubLogoRouter(): Hono<AuthEnv> {
  const router = new Hono<AuthEnv>();

  // --- Logo hochladen / ersetzen -------------------------------------------
  router.post('/clubs/:clubId/logo', async (c) => {
    const clubId = c.req.param('clubId');
    if (!UUID_RE.test(clubId)) throw problem(400, 'Bad Request', 'clubId (uuid) is required');
    const claims = c.get('claims');

    const form = await c.req.parseBody();
    const file = form['file'];
    if (!(file instanceof File)) {
      throw problem(400, 'Bad Request', 'file (multipart) is required');
    }
    // Nur Bilder — ein Audio/PDF als Logo scheitert hier, vor jedem Schreiben.
    if (!isAllowedContentType(file.type) || !file.type.toLowerCase().startsWith('image/')) {
      throw problem(
        415,
        'Unsupported Media Type',
        `content type '${file.type || 'unknown'}' is not an allowed image type (jpeg/png/gif/webp/heic)`,
      );
    }

    // Ehrliches 403 fuer alle ausser owner/admin (DB-aufgeloest, nicht Token:
    // ein frisch registrierter Inhaber traegt club_roles={}).
    await requireClubRoleDb(c, clubId, LOGO_ROLES, 'club_settings');

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength === 0) throw problem(400, 'Bad Request', 'file is empty');
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      throw problem(413, 'Payload Too Large', `file exceeds the ${MAX_UPLOAD_BYTES} byte limit`);
    }

    // storage_key SERVERSEITIG, Bytes speichern.
    const storageKey = generateStorageKey(file.type);
    await saveBytes(storageKey, bytes);

    const updated = await withUser(claims, async (tx) => {
      // Das bisherige Logo-Asset merken (best-effort-Aufraeumen nach dem Tausch).
      const prev = await tx`
        select logo_asset_id from app.clubs where id = ${clubId} and deleted_at is null`;
      if (prev.length === 0) throw problem(404, 'Not Found', 'Club not found');
      const prevAssetId = (prev[0] as { logo_asset_id: string | null }).logo_asset_id;

      // media_assets_insert = is_club_trainer(club_id) (0007) — owner/admin ist
      // trainer, die serverseitig gesetzte club_id ist der eigene Verein. id
      // vorab ziehen (Hausstil, wie routine-media).
      const idRows = await tx`select app.uuid_v7() as id`;
      const assetId = (idRows[0] as { id: string }).id;
      await tx`
        insert into app.media_assets
          (id, club_id, bucket, storage_path, mime_type, size_bytes, created_by)
        values
          (${assetId}, ${clubId}, 'club-logo', ${storageKey}, ${file.type},
           ${bytes.byteLength}, ${claims.sub})`;

      // clubs_update = owner/admin (0002) — die zweite, entscheidende Schranke.
      // KEIN `returning *` (join_code-Spaltenrecht, 0035): CLUB_COLUMNS.
      const rows = await tx`
        update app.clubs set logo_asset_id = ${assetId}
        where id = ${clubId} and deleted_at is null
        returning ${tx.unsafe(CLUB_COLUMNS)}`;
      if (rows.length === 0) throw problem(404, 'Not Found', 'Club not found');

      // Altes Asset soft-loeschen (Referenz ist jetzt umgehaengt).
      let prevStoragePath: string | null = null;
      if (prevAssetId) {
        const a = await tx`
          select storage_path from app.media_assets where id = ${prevAssetId} and deleted_at is null`;
        prevStoragePath = (a[0] as { storage_path: string } | undefined)?.storage_path ?? null;
        await tx`update app.media_assets set deleted_at = now() where id = ${prevAssetId}`;
      }
      return { row: rows[0], prevStoragePath };
    });

    // Alte Bytes best-effort entfernen (nie fatal, nie das Seed-Verzeichnis).
    if (updated.prevStoragePath) await deleteBytes(updated.prevStoragePath);
    return c.json(clubSchema.parse(updated.row), 200);
  });

  // --- Logo entfernen -------------------------------------------------------
  router.delete('/clubs/:clubId/logo', async (c) => {
    const clubId = c.req.param('clubId');
    if (!UUID_RE.test(clubId)) throw problem(400, 'Bad Request', 'clubId (uuid) is required');
    const claims = c.get('claims');

    await requireClubRoleDb(c, clubId, LOGO_ROLES, 'club_settings');

    const outcome = await withUser(claims, async (tx) => {
      const cur = await tx`
        select logo_asset_id from app.clubs where id = ${clubId} and deleted_at is null`;
      if (cur.length === 0) throw problem(404, 'Not Found', 'Club not found');
      const assetId = (cur[0] as { logo_asset_id: string | null }).logo_asset_id;

      const rows = await tx`
        update app.clubs set logo_asset_id = null
        where id = ${clubId} and deleted_at is null
        returning ${tx.unsafe(CLUB_COLUMNS)}`;

      let storagePath: string | null = null;
      if (assetId) {
        const a = await tx`
          select storage_path from app.media_assets where id = ${assetId} and deleted_at is null`;
        storagePath = (a[0] as { storage_path: string } | undefined)?.storage_path ?? null;
        await tx`update app.media_assets set deleted_at = now() where id = ${assetId}`;
      }
      return { row: rows[0], storagePath };
    });

    if (outcome.storagePath) await deleteBytes(outcome.storagePath);
    return c.json(clubSchema.parse(outcome.row), 200);
  });

  // --- Logo ausliefern (OEFFENTLICH) ---------------------------------------
  // Loest NUR clubs.logo_asset_id auf. Service-Mode, weil hier niemand
  // angemeldet sein muss (Login/Landing) und die RLS auf app.clubs
  // (is_club_member) einen anonymen Aufrufer sonst aussperrte. Es ist die
  // EINZIGE Stelle, die dieses Feld aufloest — kein anderes Medium leckt.
  router.get('/public/clubs/:clubId/logo', async (c) => {
    const clubId = c.req.param('clubId');
    if (!UUID_RE.test(clubId)) throw problem(400, 'Bad Request', 'clubId (uuid) is required');

    const asset = await withServiceRole(
      `public club logo for ${clubId}`,
      async (tx) => {
        const rows = await tx`
          select ma.storage_path, ma.mime_type
          from app.clubs cl
          join app.media_assets ma on ma.id = cl.logo_asset_id and ma.deleted_at is null
          where cl.id = ${clubId} and cl.deleted_at is null and cl.logo_asset_id is not null
          limit 1`;
        return (rows[0] as { storage_path: string; mime_type: string | null } | undefined) ?? null;
      },
    );
    if (!asset) throw problem(404, 'Not Found', 'This club has no logo');

    const bytes = await readBytes(asset.storage_path);
    if (!bytes) throw problem(404, 'Not Found', 'Stored bytes are unavailable');

    const contentType = asset.mime_type ?? contentTypeFromKey(asset.storage_path);
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'content-type': contentType,
        'content-length': String(bytes.byteLength),
        // Oeffentliches Marken-Asset -> darf zwischengespeichert werden.
        'cache-control': 'public, max-age=300',
        'x-content-type-options': 'nosniff',
      },
    });
  });

  return router;
}
