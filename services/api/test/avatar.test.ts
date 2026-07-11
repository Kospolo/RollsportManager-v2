// avatarUrlFor - pure helper, no HTTP/DB (lib/avatar.ts, migration 0020).

import { describe, expect, it } from 'vitest';
import { avatarUrlFor } from '../src/lib/avatar.js';

describe('avatarUrlFor', () => {
  it('derives the served /media URL from an avatar key', () => {
    expect(avatarUrlFor('9f2c-e1.jpg')).toBe('/media/9f2c-e1.jpg');
  });

  it('returns null when there is no photo (null/undefined/empty)', () => {
    expect(avatarUrlFor(null)).toBeNull();
    expect(avatarUrlFor(undefined)).toBeNull();
    expect(avatarUrlFor('')).toBeNull();
  });
});
