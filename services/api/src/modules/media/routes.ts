// ============================================================================
// modules/media/routes.ts - binary file transfer for the PRO modules.
//
//   POST /media/upload   multipart/form-data (fields: club_id, file). Stores
//                        the bytes under an opaque storage_key and returns the
//                        metadata the caller then posts to /gallery or
//                        /documents. Requires a coaching role AND an active
//                        PRO/Premium club licence (402 otherwise).
//   POST /me/photo       multipart/form-data (field: file, an image). Stores
//                        the bytes and sets the caller's OWN club_members
//                        avatar_key (every membership row of the caller). Any
//                        member may set their own photo - no club role needed.
//   GET  /media/{key}    Streams the bytes with their stored content_type.
//                        Access is RLS-enforced: the key must resolve to a
//                        gallery/document row VISIBLE to the caller (member +
//                        PRO) or a roster avatar of a club the caller belongs
//                        to, otherwise 404.
//
// These routes move raw bytes, so they are a PLAIN Hono router and are
// deliberately NOT part of the OpenAPI contract (like modules/billing/
// webhooks.ts). They are NOT in PUBLIC_PATHS (app.ts), so requireAuth still
// runs and c.get('claims') is present. The typed JSON CRUD lives in
// routes/gallery.ts and routes/documents.ts.
//
// PROD: replace upload+serve with object storage + signed URLs (see storage.ts).
// ============================================================================

import { Hono } from 'hono';
import type { AuthEnv } from '../../middleware/auth.js';
import { problem } from '../../middleware/error.js';
import { withUser } from '../../db.js';
import { COACH_ROLES, requireClubRole } from '../../lib/guards.js';
import { assertClubPro } from '../../lib/pro-gate.js';
import {
  MAX_UPLOAD_BYTES,
  assertValidKey,
  contentTypeFromKey,
  galleryKindFor,
  generateStorageKey,
  isAllowedContentType,
  readBytes,
  saveBytes,
} from './storage.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createMediaRouter(): Hono<AuthEnv> {
  const router = new Hono<AuthEnv>();

  // --- Upload ----------------------------------------------------------------
  router.post('/media/upload', async (c) => {
    const claims = c.get('claims');

    const form = await c.req.parseBody();
    const clubId = form['club_id'];
    if (typeof clubId !== 'string' || !UUID_RE.test(clubId)) {
      throw problem(400, 'Bad Request', 'club_id (uuid) is required');
    }
    const file = form['file'];
    if (!(file instanceof File)) {
      throw problem(400, 'Bad Request', 'file (multipart) is required');
    }

    // Rights: coaching role (API guard) — mirrored by RLS on the metadata insert.
    requireClubRole(claims, clubId, COACH_ROLES);

    const contentType = file.type;
    if (!isAllowedContentType(contentType)) {
      throw problem(
        415,
        'Unsupported Media Type',
        `content type '${contentType || 'unknown'}' is not allowed (images, videos and common document types only)`,
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength === 0) {
      throw problem(400, 'Bad Request', 'file is empty');
    }
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      throw problem(413, 'Payload Too Large', `file exceeds the ${MAX_UPLOAD_BYTES} byte limit`);
    }

    // PRO gate: only clubs with an active pro/premium licence may upload.
    await withUser(claims, (tx) => assertClubPro(tx, clubId));

    const storageKey = generateStorageKey(contentType);
    await saveBytes(storageKey, bytes);

    return c.json(
      {
        storage_key: storageKey,
        content_type: contentType,
        size_bytes: bytes.byteLength,
        kind: galleryKindFor(contentType),
      },
      201,
    );
  });

  // --- Profile photo ---------------------------------------------------------
  // Any member may set their OWN avatar (no club role needed). Images only.
  // The bytes are stored like any media asset; the key is written to every
  // club_members row of the caller (club_members_update_self RLS, migration
  // 0016 - the protect_club_membership trigger does not guard avatar_key).
  router.post('/me/photo', async (c) => {
    const claims = c.get('claims');

    const form = await c.req.parseBody();
    const file = form['file'];
    if (!(file instanceof File)) {
      throw problem(400, 'Bad Request', 'file (multipart) is required');
    }

    const contentType = file.type;
    if (!isAllowedContentType(contentType) || !contentType.toLowerCase().startsWith('image/')) {
      throw problem(415, 'Unsupported Media Type', 'profile photos must be an image (jpeg/png/gif/webp/heic)');
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength === 0) throw problem(400, 'Bad Request', 'file is empty');
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      throw problem(413, 'Payload Too Large', `file exceeds the ${MAX_UPLOAD_BYTES} byte limit`);
    }

    const storageKey = generateStorageKey(contentType);
    await saveBytes(storageKey, bytes);

    // Set avatar_key on every membership row of the caller (self only: the
    // WHERE profile_id = auth.uid() + RLS both pin it to the caller).
    const rows = await withUser(claims, (tx) => tx`
      update app.club_members set avatar_key = ${storageKey}
      where profile_id = ${claims.sub} and deleted_at is null
      returning id`);
    if (rows.length === 0) {
      throw problem(404, 'Not Found', 'No membership row for the current user');
    }

    return c.json(
      {
        avatar_key: storageKey,
        avatar_url: `/media/${storageKey}`,
        content_type: contentType,
        size_bytes: bytes.byteLength,
        updated_members: rows.length,
      },
      201,
    );
  });

  // --- Serve -----------------------------------------------------------------
  router.get('/media/:key', async (c) => {
    const claims = c.get('claims');
    const key = c.req.param('key');
    try {
      assertValidKey(key);
    } catch {
      throw problem(400, 'Bad Request', 'invalid storage key');
    }

    // Access = the key must resolve to a row VISIBLE to the caller under RLS
    // (gallery/document main asset or a gallery thumbnail). A non-member or a
    // non-PRO club sees nothing here -> 404. content_type comes from the row;
    // a thumbnail has none stored, so we infer it from the key extension.
    const rows = await withUser(claims, (tx) => tx`
      select content_type from app.gallery_items
        where storage_key = ${key} and deleted_at is null
      union all
      select content_type from app.documents
        where storage_key = ${key} and deleted_at is null
      union all
      select null::text as content_type from app.gallery_items
        where thumbnail_key = ${key} and deleted_at is null
      union all
      select null::text as content_type from app.club_members
        where avatar_key = ${key} and deleted_at is null
      limit 1`);
    if (rows.length === 0) {
      throw problem(404, 'Not Found', 'No accessible media for this key');
    }
    const contentType = (rows[0]?.['content_type'] as string | null) ?? contentTypeFromKey(key);

    const bytes = await readBytes(key);
    if (!bytes) {
      // Metadata exists but the blob is gone (e.g. non-seeded key on a fresh
      // MEDIA_DIR). Treat as not found rather than a server error.
      throw problem(404, 'Not Found', 'Stored bytes are unavailable');
    }

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'content-type': contentType,
        'content-length': String(bytes.byteLength),
        'cache-control': 'private, max-age=300',
        'x-content-type-options': 'nosniff',
      },
    });
  });

  return router;
}
