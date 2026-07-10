// ============================================================================
// smoke.mjs - API smoke suite against the throwaway harness DB.
// Started by scripts/api-db-test.sh AFTER migrations + seed are applied and
// the API is listening. Uses only the seeded demo club (RSV Neckarsulm).
//
// Positive AND negative cases: the negatives prove that the RLS impersonation
// actually reaches the database (403s produced by Postgres, not just guards).
// ============================================================================

import { SignJWT } from 'jose';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3022';
const SECRET = process.env.AUTH_JWT_SECRET ?? 'rsm2-harness-smoke-secret-0123456789';

const CLUB = 'c1ab0000-0000-4000-8000-000000000001';
const FOREIGN_CLUB = 'deadbeef-0000-4000-8000-000000000001';
const SUB = {
  coach: '90000000-0000-4000-8000-000000000001', // Sandra Vogel
  owner: '90000000-0000-4000-8000-000000000002', // Jürgen Häberle (the ONLY owner)
  treasurer: '90000000-0000-4000-8000-000000000003', // Beate Schäfer
  admin: '90000000-0000-4000-8000-000000000004', // Thomas Krüger
  guest: '90000000-0000-4000-8000-000000000006', // Milena Öztürk (valid 30 days)
  parent: '90000000-0000-4000-8000-000000000009', // Katrin Grünewald (member)
  moderator: '90000000-0000-4000-8000-000000000014', // Petra Köhler (moderator)
  platform: '90000000-0000-4000-8000-000000000090', // RSM Plattform-Admin (no club row)
};
const MEMBER = {
  owner: 'a0000000-0000-4000-8000-000000000002',
  admin: 'a0000000-0000-4000-8000-000000000004',
  linaChildOfParent: 'a0000000-0000-4000-8000-000000000007',
  sofiaNotHerChild: 'a0000000-0000-4000-8000-000000000010',
  petraPlainMember: 'a0000000-0000-4000-8000-000000000014',
  stefanieMember: 'a0000000-0000-4000-8000-000000000012',
};

let failures = 0;
function ok(label) {
  console.log(`  ok: ${label}`);
}
function fail(label, extra) {
  failures += 1;
  console.error(`  FAIL: ${label}${extra ? ` - ${extra}` : ''}`);
}
function assertEq(label, actual, expected) {
  if (actual === expected) ok(`${label} = ${JSON.stringify(actual)}`);
  else fail(label, `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

async function token(sub, role, club = CLUB) {
  return new SignJWT({ sub, role: 'authenticated', club_roles: { [club]: role } })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setAudience('authenticated')
    .setExpirationTime('10m')
    .sign(new TextEncoder().encode(SECRET));
}

async function call(method, path, { as, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (as) headers.authorization = `Bearer ${as}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let json;
  try {
    json = await res.json();
  } catch {
    json = undefined;
  }
  return { status: res.status, json };
}

/** Platform-admin token: no club role, app_metadata.is_platform_admin (mirrors GoTrue). */
async function platformToken() {
  return new SignJWT({
    sub: SUB.platform,
    role: 'authenticated',
    club_roles: {},
    is_platform_admin: true,
    app_metadata: { is_platform_admin: true },
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setAudience('authenticated')
    .setExpirationTime('10m')
    .sign(new TextEncoder().encode(SECRET));
}

const t = {
  coach: await token(SUB.coach, 'coach'),
  owner: await token(SUB.owner, 'owner'),
  treasurer: await token(SUB.treasurer, 'treasurer'),
  admin: await token(SUB.admin, 'admin'),
  guest: await token(SUB.guest, 'guest_coach'),
  parent: await token(SUB.parent, 'member'),
  moderator: await token(SUB.moderator, 'moderator'),
  platform: await platformToken(),
  foreign: await token('99999999-0000-4000-8000-000000000099', 'owner', FOREIGN_CLUB),
};

console.log('[smoke] health & auth');
assertEq('GET /health', (await call('GET', '/health')).status, 200);
assertEq('GET /clubs without token -> 401', (await call('GET', '/clubs')).status, 401);

console.log('[smoke] RLS-scoped reads');
{
  const r = await call('GET', '/clubs', { as: t.coach });
  assertEq('coach sees exactly 1 club', r.json.length, 1);
  assertEq('...named RSV Neckarsulm', r.json[0]?.name, 'RSV Neckarsulm');
}
{
  const r = await call('GET', `/clubs/${CLUB}/members`, { as: t.coach });
  assertEq('coach sees roster of 24', r.json.length, 24);
}
{
  const r = await call('GET', `/invoices?club_id=${CLUB}`, { as: t.treasurer });
  assertEq('treasurer sees 10 invoices', r.json.length, 10);
  const openSum = r.json
    .filter((i) => i.status === 'open')
    .reduce((s, i) => s + i.amount_cents, 0);
  assertEq('open invoice sum = 38100 cents (381,00 EUR)', openSum, 38100);
}
{
  const r = await call('GET', `/invoices?club_id=${CLUB}`, { as: t.parent });
  assertEq('parent sees only own/children invoices (2)', r.json.length, 2);
}
{
  const r = await call('GET', `/entitlements/${CLUB}`, { as: t.parent });
  assertEq('member reads club entitlement (1 manual)', r.json.length, 1);
  assertEq('...source manual', r.json[0]?.source, 'manual');
}

console.log('[smoke] tenant isolation');
{
  const r = await call('GET', '/clubs', { as: t.foreign });
  assertEq('foreign-club token sees 0 clubs', r.json.length, 0);
  const m = await call('GET', `/clubs/${CLUB}/members`, { as: t.foreign });
  assertEq('foreign-club token blocked from roster (403)', m.status, 403);
}

console.log('[smoke] RSVP (parent mode via guardianship)');
const events = (await call('GET', `/events?club_id=${CLUB}`, { as: t.parent })).json;
assertEq('parent sees 15 events', events.length, 15);
const someEvent = events[events.length - 1];
{
  const r = await call('PUT', `/events/${someEvent.id}/rsvp`, {
    as: t.parent,
    body: { member_id: MEMBER.linaChildOfParent, status: 'going', comment: 'Wir kommen!' },
  });
  assertEq('parent RSVPs for own child -> 200', r.status, 200);
  assertEq('...status stored', r.json?.status, 'going');
}
{
  const r = await call('PUT', `/events/${someEvent.id}/rsvp`, {
    as: t.parent,
    body: { member_id: MEMBER.sofiaNotHerChild, status: 'declined' },
  });
  assertEq('parent RSVP for a FOREIGN child rejected by RLS (403)', r.status, 403);
}

console.log('[smoke] attendance (guest_coach, server-side expiry check)');
{
  const r = await call('PUT', `/events/${someEvent.id}/attendance`, {
    as: t.guest,
    body: { member_id: MEMBER.linaChildOfParent, status: 'present' },
  });
  assertEq('valid guest_coach records attendance -> 200', r.status, 200);
}
{
  const r = await call('PUT', `/events/${someEvent.id}/attendance`, {
    as: t.parent,
    body: { member_id: MEMBER.linaChildOfParent, status: 'present' },
  });
  assertEq('plain member cannot record attendance (403)', r.status, 403);
}

console.log('[smoke] role changes (v1 gap + last owner)');
{
  const r = await call('PATCH', `/clubs/${CLUB}/members/${MEMBER.admin}/role`, {
    as: t.admin,
    body: { role: 'treasurer' },
  });
  assertEq('admin changing OWN role -> 403', r.status, 403);
}
{
  const r = await call('PATCH', `/clubs/${CLUB}/members/${MEMBER.owner}/role`, {
    as: t.admin,
    body: { role: 'member' },
  });
  assertEq('admin demoting the owner -> 403', r.status, 403);
}
{
  // Jürgen is the ONLY owner and targets his OWN row: the self-change rule
  // fires first (403). The distinct last-owner 409 (a second owner demoting
  // the last one) is unreachable with this seed and covered by unit tests.
  const r = await call('PATCH', `/clubs/${CLUB}/members/${MEMBER.owner}/role`, {
    as: t.owner,
    body: { role: 'admin' },
  });
  assertEq('owner demoting himself (= last owner) -> 403 (self-change blocked)', r.status, 403);
}
{
  const r = await call('PATCH', `/clubs/${CLUB}/members/${MEMBER.petraPlainMember}/role`, {
    as: t.owner,
    body: { role: 'coach' },
  });
  assertEq('owner promotes member to coach -> 200', r.status, 200);
  assertEq('...new role persisted', r.json?.role, 'coach');
}

console.log('[smoke] money ops (service-mode number + DB-verified role)');
{
  const r = await call('POST', '/invoices', {
    as: t.treasurer,
    body: {
      club_id: CLUB,
      member_id: MEMBER.petraPlainMember,
      title: 'Nachtrag Wettkampfgebühr',
      amount_cents: 1500,
      issue: true,
    },
  });
  assertEq('treasurer creates invoice -> 201', r.status, 201);
  const numberOk = /^R-\d{4}-0091$/.test(r.json?.number ?? '');
  if (numberOk) ok(`race-free number continues the seed sequence (${r.json.number})`);
  else fail('invoice number', `got ${r.json?.number}, expected R-YYYY-0091`);

  const rem = await call('POST', `/invoices/${r.json.id}/send-reminder`, { as: t.treasurer });
  assertEq('send-reminder bumps dunning_level to 1', rem.json?.dunning_level, 1);
}
{
  const r = await call('POST', '/invoices', {
    as: t.coach,
    body: {
      club_id: CLUB,
      member_id: MEMBER.petraPlainMember,
      title: 'Sollte nicht gehen',
      amount_cents: 100,
    },
  });
  assertEq('coach cannot create invoices (403)', r.status, 403);
}
{
  // forged claims: token says treasurer, but the DB row says plain member ->
  // the service-mode DB verification must reject it (Blueprint risk #16)
  const forged = await token(SUB.parent, 'treasurer');
  const r = await call('POST', '/invoices', {
    as: forged,
    body: {
      club_id: CLUB,
      member_id: MEMBER.petraPlainMember,
      title: 'Forged claims',
      amount_cents: 100,
    },
  });
  assertEq('stale/forged treasurer claim rejected against DB (403)', r.status, 403);
}

console.log('[smoke] moderator hierarchy + member master data (0007 matrix)');
{
  // moderator may edit member master data (can_manage_members)
  const r = await call('PATCH', `/clubs/${CLUB}/members/${MEMBER.stefanieMember}`, {
    as: t.moderator,
    body: { last_name: 'Müller-Test' },
  });
  assertEq('moderator edits member master data -> 200', r.status, 200);
  assertEq('...last_name persisted', r.json?.last_name, 'Müller-Test');
  assertEq('...role untouched by the master-data endpoint', r.json?.role, 'member');
}
{
  // moderator may NOT promote anyone to admin (target rank too high)
  const r = await call('PATCH', `/clubs/${CLUB}/members/${MEMBER.stefanieMember}/role`, {
    as: t.moderator,
    body: { role: 'admin' },
  });
  assertEq('moderator promoting to admin -> 403', r.status, 403);
}
{
  // moderator MAY set a member to coach (below its own rank)
  const r = await call('PATCH', `/clubs/${CLUB}/members/${MEMBER.stefanieMember}/role`, {
    as: t.moderator,
    body: { role: 'coach' },
  });
  assertEq('moderator setting member -> coach -> 200', r.status, 200);
  assertEq('...role persisted', r.json?.role, 'coach');
}
{
  // treasurer manages members but may only create PLAIN members
  const bad = await call('POST', `/clubs/${CLUB}/members`, {
    as: t.treasurer,
    body: { first_name: 'Kass', last_name: 'Enwart', role: 'coach' },
  });
  assertEq('treasurer creating a coach -> 403', bad.status, 403);
  const good = await call('POST', `/clubs/${CLUB}/members`, {
    as: t.treasurer,
    body: { first_name: 'Neu', last_name: 'Mitglied' },
  });
  assertEq('treasurer creating a plain member -> 201', good.status, 201);
}

console.log('[smoke] teams CRUD (is_club_admin) + roster');
{
  const created = await call('POST', `/clubs/${CLUB}/teams`, {
    as: t.owner,
    body: { name: 'Smoke-Team', age_group: 'U15' },
  });
  assertEq('owner creates a team -> 201', created.status, 201);
  const teamId = created.json?.id;

  const denied = await call('POST', `/clubs/${CLUB}/teams`, {
    as: t.coach,
    body: { name: 'Coach darf nicht' },
  });
  assertEq('coach cannot create teams (is_club_admin) -> 403', denied.status, 403);

  const renamed = await call('PATCH', `/clubs/${CLUB}/teams/${teamId}`, {
    as: t.moderator,
    body: { name: 'Smoke-Team umbenannt' },
  });
  assertEq('moderator renames the team -> 200', renamed.status, 200);
  assertEq('...name persisted', renamed.json?.name, 'Smoke-Team umbenannt');

  const roster = await call('PUT', `/clubs/${CLUB}/teams/${teamId}/members`, {
    as: t.owner,
    body: { skater_member_ids: [MEMBER.stefanieMember], coach_member_ids: [MEMBER.admin] },
  });
  assertEq('owner sets the team roster -> 200', roster.status, 200);
  assertEq('...skater linked', roster.json?.skater_member_ids?.includes(MEMBER.stefanieMember), true);
  assertEq('...coach linked', roster.json?.coach_member_ids?.includes(MEMBER.admin), true);

  const del = await call('DELETE', `/clubs/${CLUB}/teams/${teamId}`, { as: t.owner });
  assertEq('owner soft-deletes the team -> 200', del.status, 200);
  assertEq('...status deleted', del.json?.status, 'deleted');
}

console.log('[smoke] platform console (is_platform_admin ONLY)');
{
  const stats = await call('GET', '/platform/stats', { as: t.platform });
  assertEq('platform admin reads stats -> 200', stats.status, 200);
  if ((stats.json?.clubs ?? 0) >= 1) ok(`stats.clubs >= 1 (${stats.json.clubs})`);
  else fail('platform stats.clubs', `got ${stats.json?.clubs}`);

  const clubs = await call('GET', '/platform/clubs', { as: t.platform });
  assertEq('platform admin lists clubs -> 200', clubs.status, 200);
  const seen = clubs.json?.find?.((c) => c.id === CLUB);
  if (seen && typeof seen.member_count === 'number') ok(`club carries member_count (${seen.member_count})`);
  else fail('platform club member_count', `got ${JSON.stringify(seen)}`);

  const users = await call('GET', '/platform/users', { as: t.platform });
  assertEq('platform admin lists users -> 200', users.status, 200);

  const denied = await call('GET', '/platform/clubs', { as: t.owner });
  assertEq('club owner is NOT a platform admin -> 403', denied.status, 403);
}

console.log('');
if (failures > 0) {
  console.error(`[smoke] ${failures} assertion(s) FAILED`);
  process.exit(1);
}
console.log('[smoke] ALL SMOKE CHECKS PASSED');
