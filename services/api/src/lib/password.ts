// Passwort-Hashing für den echten Login — scrypt aus node:crypto, KEINE
// Fremd-Abhängigkeit. scrypt ist speicherhart und damit gegen GPU-Angriffe
// robuster als reines bcrypt-Tuning; die Parameter unten (N=16384) brauchen
// ~16 MB je Prüfung, was einen Login spürbar bremst, ohne den Server zu stören.
//
// Format: "scrypt$<saltHex>$<hashHex>". Der Salt steckt im Hash-String, jede
// Registrierung bekommt einen eigenen (randomBytes). Verglichen wird
// zeitkonstant (timingSafeEqual), damit die Dauer nichts über die Korrektheit
// verrät.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/**
 * Prüft ein Passwort gegen einen gespeicherten Hash. Gibt bei jedem Fehler
 * (falsches Format, falsches Passwort) false zurück — nie einen Fehler, der die
 * Ursache verriete. Immer zeitkonstant, sofern das Format stimmt.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  const [scheme, saltHex, hashHex] = parts;
  if (parts.length !== 3 || scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, 'hex');
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;
  const actual = scryptSync(password, salt, expected.length, { N, r: R, p: P });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Ein fester, gültiger Dummy-Hash. Wird verwendet, wenn es die E-Mail NICHT
 * gibt: Dann wird trotzdem eine echte scrypt-Prüfung gefahren, damit ein
 * Angreifer aus der Antwortzeit NICHT ablesen kann, ob die Adresse existiert.
 * (Hash eines Zufallsworts, das niemand kennt.)
 */
export const DUMMY_PASSWORD_HASH =
  'scrypt$00000000000000000000000000000000$' +
  scryptSync('rsm-timing-equalizer', Buffer.alloc(16), KEYLEN, { N, r: R, p: P }).toString('hex');
