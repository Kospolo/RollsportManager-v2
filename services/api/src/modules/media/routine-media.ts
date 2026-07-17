// ============================================================================
// modules/media/routine-media.ts - Kueren-Musik + -Bild an eine Kuer haengen.
//
//   POST   /routines/{routineId}/audio   multipart/form-data (field: file)
//   POST   /routines/{routineId}/image   multipart/form-data (field: file)
//   DELETE /routines/{routineId}/audio
//   DELETE /routines/{routineId}/image
//
// === WARUM DIESE BAUFORM (die Lehre aus dem Mandanten-Leck, Revert 6dafb38) ===
// Der erste Versuch nahm einen vom CLIENT gelieferten storage_key eines zuvor
// per /media/upload hochgeladenen Assets. Weil MEDIA_DIR flach und
// vereinsuebergreifend geteilt ist, konnte ein Trainer aus Verein A den Key von
// Verein B anhaengen -> media_assets(club_id=A, storage_path=B-Bytes) ->
// GET /media/{key} lieferte FREMDE Kinderfotos an alle Mitglieder von A.
//
// DIE BEHEBUNG (strukturell, nicht kosmetisch): es gibt KEINEN client-gelieferten
// storage_key mehr. Der Upload laeuft in EINEM Schritt DIREKT an die Kuer, genau
// wie POST /media/upload (modules/media/routes.ts). Der storage_key wird
// SERVERSEITIG erzeugt (generateStorageKey) und die media_assets-Zeile mit
// club_id = routine.club_id (serverseitig, nie vom Client) angelegt. Damit kann
// ein Aufrufer keine fremden Bytes referenzieren - der Angriffsvektor ist weg.
//
// Diese Routen bewegen ROHE BYTES und sind deshalb - wie /media/upload und die
// Webhooks - ABSICHTLICH NICHT Teil des OpenAPI-Contracts (plain Hono). Sie
// stehen NICHT in PUBLIC_PATHS, also laeuft requireAuth und c.get('claims') ist
// gesetzt.
//
// Rechte je Anhang:
//   1. loadRoutine(tx, routineId)  -> RLS routines_select = can_read_routine
//      (0026): fuer einen coach zieht das die Team-Grenze (coached_team_ids).
//      Eine Kuer eines fremden Teams ist unsichtbar -> 404, wie bei /markers.
//   2. hasClubRole(claims, routine.club_id, COACH_ROLES) -> 403 sonst.
//   3. assertClubPro(tx, routine.club_id) -> 402 sonst (wie /media/upload).
//   4. Content-Type: /audio nur Audio, /image nur image/* -> 415 sonst.
//   5. Groesse (leer -> 400, > MAX_UPLOAD_BYTES -> 413).
//   6. storage_key SERVERSEITIG erzeugen, Bytes speichern, media_assets-Zeile mit
//      club_id = routine.club_id anlegen, routine.audio_asset_id/image_asset_id
//      setzen. KEIN `returning` auf app.routines (RETURNING-Bug / can_read_routine,
//      siehe routes/routines.ts Kopf) - ohne returning schreiben, separat lesen.
// ============================================================================

import { Hono } from 'hono';
import type { AuthClaims, AuthEnv } from '../../middleware/auth.js';
import { problem } from '../../middleware/error.js';
import { withUser } from '../../db.js';
import type { Tx } from '../../db.js';
import { COACH_ROLES, hasClubRole } from '../../lib/guards.js';
import { assertClubPro } from '../../lib/pro-gate.js';
import { loadRoutine, selectRoutine } from '../../routes/routines.js';
import { routineSchema } from '../../lib/validation.js';
import {
  MAX_UPLOAD_BYTES,
  deleteBytes,
  generateStorageKey,
  isAllowedContentType,
  isAudioContentType,
  saveBytes,
} from './storage.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Optionaler positiver Integer aus einem multipart-Textfeld (sonst null). */
function optionalPositiveInt(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Optionaler, getrimmter Textwert aus einem multipart-Textfeld (sonst null). */
function optionalText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return s.length > 0 && s.length <= max ? s : null;
}

/**
 * Gemeinsamer Kern von POST /audio und /image: Datei annehmen, Rechte pruefen,
 * Bytes SERVERSEITIG unter einem frischen Key ablegen, media_assets-Zeile mit
 * club_id = routine.club_id anlegen und die asset-id zurueckgeben. Der Aufrufer
 * setzt danach die passende Spalte an app.routines (ohne returning) und liest
 * die Kuer ueber selectRoutine zurueck.
 */
async function ingestRoutineMedia(
  tx: Tx,
  claims: AuthClaims,
  routine: { id: string; club_id: string },
  bucket: string,
  file: File,
  durationMs: number | null,
): Promise<string> {
  // 3. PRO-Gate (wie /media/upload) - klare 402 mit Upgrade-Hinweis vor RLS.
  await assertClubPro(tx, routine.club_id);

  // 5. Groesse: leere Datei -> 400, zu gross -> 413.
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw problem(400, 'Bad Request', 'file is empty');
  }
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw problem(413, 'Payload Too Large', `file exceeds the ${MAX_UPLOAD_BYTES} byte limit`);
  }

  // 6. storage_key SERVERSEITIG erzeugen - NIE vom Client. Damit gibt es keinen
  //    client-kontrollierten Key und keine Moeglichkeit, auf fremde Bytes zu
  //    zeigen. club_id kommt aus der geladenen Kuer, nicht aus der Anfrage.
  const storageKey = generateStorageKey(file.type);
  await saveBytes(storageKey, bytes);

  const idRows = await tx`select app.uuid_v7() as id`;
  const assetId = (idRows[0] as { id: string }).id;
  // media_assets_insert-Policy (0007) = is_club_trainer(club_id): die serverseitig
  // gesetzte club_id = routine.club_id ist genau der Verein, in dem der Aufrufer
  // schon als Trainer:in verifiziert wurde. RETURNING ist hier unbedenklich
  // (media_assets_select haengt an is_club_member, nicht an der neuen Zeile);
  // wir schreiben dennoch ohne returning und ziehen die id vorab (Hausstil).
  await tx`
    insert into app.media_assets
      (id, club_id, bucket, storage_path, mime_type, size_bytes, duration_ms, created_by)
    values
      (${assetId}, ${routine.club_id}, ${bucket}, ${storageKey}, ${file.type},
       ${bytes.byteLength}, ${durationMs ?? null}, ${claims.sub})`;
  return assetId;
}

export function createRoutineMediaRouter(): Hono<AuthEnv> {
  const router = new Hono<AuthEnv>();

  // --- Musik anhaengen (multipart) -----------------------------------------
  router.post('/routines/:routineId/audio', async (c) => {
    const routineId = c.req.param('routineId');
    if (!UUID_RE.test(routineId)) throw problem(400, 'Bad Request', 'routineId (uuid) is required');
    const claims = c.get('claims');

    const form = await c.req.parseBody();
    const file = form['file'];
    if (!(file instanceof File)) {
      throw problem(400, 'Bad Request', 'file (multipart) is required');
    }
    // 4. Content-Type PRUEFEN, bevor irgendetwas geschrieben wird: nur Audio.
    if (!isAllowedContentType(file.type) || !isAudioContentType(file.type)) {
      throw problem(
        415,
        'Unsupported Media Type',
        `content type '${file.type || 'unknown'}' is not an allowed audio type (mp3/m4a/aac/wav/ogg/flac)`,
      );
    }

    const durationMs = optionalPositiveInt(form['duration_ms']);
    const musicTitle = optionalText(form['music_title'], 200);
    const musicArtist = optionalText(form['music_artist'], 200);
    const musicBpm = optionalPositiveInt(form['music_bpm']);

    const updated = await withUser(claims, async (tx) => {
      // 1. RLS-Team-Grenze (can_read_routine). Fremdes Team -> 404.
      const routine = await loadRoutine(tx, routineId);
      // 2. Trainerrolle im Verein der Kuer.
      if (!hasClubRole(claims, routine.club_id, COACH_ROLES)) {
        throw problem(403, 'Forbidden', 'Attaching music requires a coaching role');
      }
      const assetId = await ingestRoutineMedia(tx, claims, routine, 'routine-audio', file, durationMs);

      // KEIN returning auf app.routines (RETURNING-Bug / can_read_routine).
      await tx`
        update app.routines set
          audio_asset_id    = ${assetId},
          music_title       = coalesce(${musicTitle}::text, music_title),
          music_artist      = coalesce(${musicArtist}::text, music_artist),
          music_bpm         = coalesce(${musicBpm}::int, music_bpm),
          music_duration_ms = coalesce(${durationMs}::bigint, music_duration_ms)
        where id = ${routineId} and deleted_at is null`;

      return selectRoutine(tx, routineId);
    });
    return c.json(routineSchema.parse(updated), 200);
  });

  // --- Bild anhaengen (multipart) ------------------------------------------
  router.post('/routines/:routineId/image', async (c) => {
    const routineId = c.req.param('routineId');
    if (!UUID_RE.test(routineId)) throw problem(400, 'Bad Request', 'routineId (uuid) is required');
    const claims = c.get('claims');

    const form = await c.req.parseBody();
    const file = form['file'];
    if (!(file instanceof File)) {
      throw problem(400, 'Bad Request', 'file (multipart) is required');
    }
    // 4. Content-Type PRUEFEN: nur Bilder. Ein Audio als Bild scheitert hier.
    if (!isAllowedContentType(file.type) || !file.type.toLowerCase().startsWith('image/')) {
      throw problem(
        415,
        'Unsupported Media Type',
        `content type '${file.type || 'unknown'}' is not an allowed image type (jpeg/png/gif/webp/heic)`,
      );
    }

    const updated = await withUser(claims, async (tx) => {
      const routine = await loadRoutine(tx, routineId);
      if (!hasClubRole(claims, routine.club_id, COACH_ROLES)) {
        throw problem(403, 'Forbidden', 'Attaching an image requires a coaching role');
      }
      const assetId = await ingestRoutineMedia(tx, claims, routine, 'routine-image', file, null);

      // KEIN returning auf app.routines (RETURNING-Bug).
      await tx`
        update app.routines set image_asset_id = ${assetId}
        where id = ${routineId} and deleted_at is null`;

      return selectRoutine(tx, routineId);
    });
    return c.json(routineSchema.parse(updated), 200);
  });

  // --- Musik/Bild loesen ----------------------------------------------------
  router.delete('/routines/:routineId/audio', async (c) =>
    c.json(routineSchema.parse(await detachRoutineMedia(c.get('claims'), c.req.param('routineId'), 'audio_asset_id')), 200),
  );
  router.delete('/routines/:routineId/image', async (c) =>
    c.json(routineSchema.parse(await detachRoutineMedia(c.get('claims'), c.req.param('routineId'), 'image_asset_id')), 200),
  );

  return router;
}

/**
 * Musik bzw. Bild von einer Kuer loesen: Spalte auf null, media_assets-Zeile
 * soft-loeschen und die Bytes best-effort entfernen (nur MEDIA_DIR, nie das
 * Seed-Verzeichnis). Rechte wie beim Anlegen (COACH_ROLES). KEIN returning auf
 * app.routines. Liefert die aktualisierte Kuer.
 */
async function detachRoutineMedia(
  claims: AuthClaims,
  routineId: string,
  column: 'audio_asset_id' | 'image_asset_id',
): Promise<unknown> {
  if (!UUID_RE.test(routineId)) throw problem(400, 'Bad Request', 'routineId (uuid) is required');

  const outcome = await withUser(claims, async (tx) => {
    const routine = await loadRoutine(tx, routineId);
    if (!hasClubRole(claims, routine.club_id, COACH_ROLES)) {
      throw problem(403, 'Forbidden', 'Detaching media requires a coaching role');
    }
    const curRows =
      column === 'audio_asset_id'
        ? await tx`select audio_asset_id as asset_id from app.routines where id = ${routineId} and deleted_at is null`
        : await tx`select image_asset_id as asset_id from app.routines where id = ${routineId} and deleted_at is null`;
    const assetId = (curRows[0] as { asset_id: string | null } | undefined)?.asset_id ?? null;

    if (column === 'audio_asset_id') {
      await tx`update app.routines set audio_asset_id = null where id = ${routineId} and deleted_at is null`;
    } else {
      await tx`update app.routines set image_asset_id = null where id = ${routineId} and deleted_at is null`;
    }

    let storagePath: string | null = null;
    if (assetId) {
      const aRows = await tx`
        select storage_path from app.media_assets where id = ${assetId} and deleted_at is null`;
      storagePath = (aRows[0] as { storage_path: string } | undefined)?.storage_path ?? null;
      await tx`update app.media_assets set deleted_at = now() where id = ${assetId} and deleted_at is null`;
    }
    return { storagePath, row: await selectRoutine(tx, routineId) };
  });

  // Bytes best-effort ausserhalb der Transaktion entfernen (nie fatal).
  if (outcome.storagePath) await deleteBytes(outcome.storagePath);
  return outcome.row;
}
