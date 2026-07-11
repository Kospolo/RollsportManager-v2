// ============================================================================
// lib/avatar.ts - derive the served profile-photo URL from a stored avatar_key.
//
// club_members.avatar_key (migration 0020) is the OPAQUE media key of a
// member's profile photo. The bytes are served by the existing binary media
// route (GET /media/{key}, modules/media/routes.ts), which RLS-checks the key
// against the club roster before streaming. Responses expose the ready-to-use
// relative URL as avatar_url (null when no photo is set). Clients prefix it
// with the API base like every other media URL.
// ============================================================================

/** Relative served URL for an avatar key, or null when none is set. */
export function avatarUrlFor(avatarKey: string | null | undefined): string | null {
  return avatarKey ? `/media/${avatarKey}` : null;
}
