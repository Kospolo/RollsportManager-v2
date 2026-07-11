// ============================================================================
// modules/media/storage.ts - the file-bytes layer for the PRO modules
// (Galerie & Dokumente, migration 0012).
//
// DESIGN (deliberately simple, real, and prod-swappable — there is no object
// storage in this environment yet):
//   * On upload the API writes the bytes under a BIND-MOUNTED directory
//     (MEDIA_DIR, default <repo>/.dev/media, gitignored) keyed by an OPAQUE,
//     random storage_key. The DB only ever stores that key + content_type +
//     size (schema 0012), never the blob.
//   * On serve the API streams the bytes back with the stored content_type.
//   * Seeded demo rows reference committed placeholder assets under
//     supabase/seed/media/ (SEED_MEDIA_DIR); reads fall back there when a key
//     is not in MEDIA_DIR, so the seed serves real bytes in any checkout.
//
// PROD PATH (documented, not built here): swap this module for object storage
// (S3/R2/Supabase Storage) + short-lived SIGNED URLs. The schema already holds
// url/storage_key/content_type, so only this serving layer changes — routes,
// RLS and the PRO gate stay identical.
//
// Everything here is pure/deterministic where possible (key generation,
// validation, allowlist, size cap) so it is unit-testable without HTTP or a DB.
// ============================================================================

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Config (ENV is only the fallback — user preference "Einstellungen ins Admin";
// operational overrides would later come from a settings table, like config.ts).
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
// modules/media -> src -> api -> services -> <repo root>
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..', '..');

/** Where uploaded bytes are written (bind mount, gitignored). */
export const MEDIA_DIR = process.env['MEDIA_DIR'] ?? join(REPO_ROOT, '.dev', 'media');

/** Read-only bundled demo assets the seed references (fallback on read). */
export const SEED_MEDIA_DIR = join(REPO_ROOT, 'supabase', 'seed', 'media');

/** Hard upload cap (Referenz: Galerie/Dokumente sind keine Rohvideo-Archive). */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * Accepted upload content types → canonical file extension. Only images/videos
 * (Galerie) and the usual document types (Dokumente) are allowed; anything
 * else is rejected before a single byte is written.
 */
export const ALLOWED_CONTENT_TYPES: Readonly<Record<string, string>> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

export function isAllowedContentType(contentType: string | undefined | null): contentType is string {
  return typeof contentType === 'string' && contentType.toLowerCase() in ALLOWED_CONTENT_TYPES;
}

/** True for content types that belong in the Galerie (photo/video). */
export function isGalleryContentType(contentType: string): boolean {
  const ct = contentType.toLowerCase();
  return ct.startsWith('image/') || ct.startsWith('video/');
}

/** photo|video for an allowed gallery content type. */
export function galleryKindFor(contentType: string): 'photo' | 'video' {
  return contentType.toLowerCase().startsWith('video/') ? 'video' : 'photo';
}

// ---------------------------------------------------------------------------
// Storage keys — opaque, random, filesystem-safe. Never derived from user
// input (no original filename), so a key leaks nothing and cannot traverse.
// ---------------------------------------------------------------------------

const KEY_RE = /^[A-Za-z0-9._-]+$/;

/** A fresh opaque key: <uuid><ext>, e.g. "9f2c…e1.jpg". */
export function generateStorageKey(contentType: string): string {
  const ext = ALLOWED_CONTENT_TYPES[contentType.toLowerCase()] ?? '';
  return `${randomUUID()}${ext}`;
}

/**
 * Reject anything that is not a flat, safe key. Guards the serve route against
 * path traversal (`..`, absolute paths, separators). Throws on violation.
 */
export function assertValidKey(key: string): void {
  if (!key || key.length > 200 || !KEY_RE.test(key) || key.includes('..')) {
    throw new Error(`invalid storage key: ${JSON.stringify(key)}`);
  }
}

// ---------------------------------------------------------------------------
// Byte I/O
// ---------------------------------------------------------------------------

/** Persist bytes under MEDIA_DIR keyed by an opaque storage_key. */
export async function saveBytes(key: string, bytes: Uint8Array): Promise<void> {
  assertValidKey(key);
  await mkdir(MEDIA_DIR, { recursive: true });
  await writeFile(join(MEDIA_DIR, key), bytes);
}

/**
 * Read bytes for a key: MEDIA_DIR first (uploads), then the committed seed
 * assets (demo rows). Returns undefined when neither has the file.
 */
export async function readBytes(key: string): Promise<Uint8Array | undefined> {
  assertValidKey(key);
  for (const dir of [MEDIA_DIR, SEED_MEDIA_DIR]) {
    try {
      return await readFile(join(dir, key));
    } catch {
      /* try next location */
    }
  }
  return undefined;
}

/**
 * Best-effort removal of an uploaded blob (e.g. when a member clears their
 * profile photo). Only ever touches MEDIA_DIR — the committed seed assets in
 * SEED_MEDIA_DIR are never deleted. Returns true when a file was removed,
 * false when there was nothing to remove (already gone / seed-only key).
 * Never throws: the DB row is the source of truth, a stray blob is harmless.
 */
export async function deleteBytes(key: string): Promise<boolean> {
  assertValidKey(key);
  try {
    await rm(join(MEDIA_DIR, key));
    return true;
  } catch {
    return false;
  }
}

/** Best-effort content type from a key's extension (fallback only). */
export function contentTypeFromKey(key: string): string {
  const ext = extname(key).toLowerCase();
  for (const [ct, e] of Object.entries(ALLOWED_CONTENT_TYPES)) {
    if (e === ext) return ct;
  }
  return 'application/octet-stream';
}
