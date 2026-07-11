// ============================================================================
// media-storage.test.ts - the pure/file-system helpers of the media module
// (modules/media/storage.ts). No HTTP, no DB.
// ============================================================================

import { describe, expect, it, afterAll } from 'vitest';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ALLOWED_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
  MEDIA_DIR,
  assertValidKey,
  contentTypeFromKey,
  deleteBytes,
  galleryKindFor,
  generateStorageKey,
  isAllowedContentType,
  readBytes,
  saveBytes,
} from '../src/modules/media/storage.js';

describe('storage keys', () => {
  it('generates opaque keys with the content type extension', () => {
    const key = generateStorageKey('image/png');
    expect(key.endsWith('.png')).toBe(true);
    // opaque: a uuid, never derived from a filename
    expect(key).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(generateStorageKey('image/png')).not.toBe(key); // random
  });

  it('accepts flat safe keys, rejects traversal/separators/empty', () => {
    expect(() => assertValidKey('abc-123.png')).not.toThrow();
    for (const bad of ['', '../etc/passwd', 'a/b.png', '..', 'x'.repeat(201), 'a b.png']) {
      expect(() => assertValidKey(bad)).toThrow();
    }
  });
});

describe('content type allowlist', () => {
  it('accepts images/videos/documents and rejects the rest', () => {
    expect(isAllowedContentType('image/jpeg')).toBe(true);
    expect(isAllowedContentType('application/pdf')).toBe(true);
    expect(isAllowedContentType('video/mp4')).toBe(true);
    expect(isAllowedContentType('application/x-sh')).toBe(false);
    expect(isAllowedContentType('')).toBe(false);
    expect(isAllowedContentType(undefined)).toBe(false);
  });

  it('classifies gallery kind by content type', () => {
    expect(galleryKindFor('image/png')).toBe('photo');
    expect(galleryKindFor('video/mp4')).toBe('video');
  });

  it('maps a key extension back to a content type', () => {
    expect(contentTypeFromKey('x.pdf')).toBe('application/pdf');
    expect(contentTypeFromKey('x.unknownext')).toBe('application/octet-stream');
  });

  it('has a sane upload cap', () => {
    expect(MAX_UPLOAD_BYTES).toBe(25 * 1024 * 1024);
    expect(Object.keys(ALLOWED_CONTENT_TYPES).length).toBeGreaterThan(5);
  });
});

describe('byte round-trip', () => {
  const key = `vitest-${Date.now()}.txt`;
  afterAll(async () => {
    await rm(join(MEDIA_DIR, key), { force: true });
  });

  it('saves and reads bytes back', async () => {
    const bytes = new TextEncoder().encode('hallo welt');
    await saveBytes(key, bytes);
    const back = await readBytes(key);
    expect(back).toBeDefined();
    expect(new TextDecoder().decode(back!)).toBe('hallo welt');
  });

  it('reads committed seed assets via the fallback directory', async () => {
    // seed-doc-satzung-2026.pdf is a committed demo asset (supabase/seed/media)
    const back = await readBytes('seed-doc-satzung-2026.pdf');
    expect(back).toBeDefined();
    expect(new TextDecoder().decode(back!.slice(0, 5))).toBe('%PDF-');
  });

  it('returns undefined for an unknown key', async () => {
    expect(await readBytes('does-not-exist-xyz.png')).toBeUndefined();
  });
});

describe('deleteBytes (DELETE /me/photo blob removal)', () => {
  it('removes an uploaded blob and reports true, then false when already gone', async () => {
    const key = `vitest-del-${Date.now()}.txt`;
    await saveBytes(key, new TextEncoder().encode('weg damit'));
    expect(await readBytes(key)).toBeDefined();

    expect(await deleteBytes(key)).toBe(true); // first removal hits the file
    expect(await readBytes(key)).toBeUndefined(); // and it is really gone
    expect(await deleteBytes(key)).toBe(false); // idempotent: nothing left
  });

  it('never deletes committed seed assets and reports false', async () => {
    // The seed asset lives in SEED_MEDIA_DIR, which deleteBytes never touches.
    expect(await deleteBytes('seed-doc-satzung-2026.pdf')).toBe(false);
    expect(await readBytes('seed-doc-satzung-2026.pdf')).toBeDefined();
  });

  it('rejects an unsafe key just like the other byte helpers', async () => {
    await expect(deleteBytes('../etc/passwd')).rejects.toThrow();
  });
});
