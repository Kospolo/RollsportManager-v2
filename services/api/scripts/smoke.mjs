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
  // Leonie Schröder - ein ECHTES einfaches Mitglied (member/active, kein Profil).
  // Vorher stand hier a0..14 unter dem Namen "petraPlainMember" - das ist aber
  // Petra Köhler, die MODERATORIN (seed.sql:115), nicht ein einfaches Mitglied.
  // Der Schritt "owner promotes member to coach" hat damit unbemerkt die
  // Moderatorin degradiert; die nachfolgenden Moderator-Tests liefen nur noch
  // durch, weil der Claim im Token "moderator" behauptete. Seit 0025 löst die
  // DB auf -> der Etikettenschwindel fliegt auf. Ziel korrigiert; dass die
  // Degradierung SOFORT wirkt, prüft jetzt der eigene Block weiter unten.
  plainMember: 'a0000000-0000-4000-8000-000000000015',
  moderator: 'a0000000-0000-4000-8000-000000000014',
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
  const r = await call('PATCH', `/clubs/${CLUB}/members/${MEMBER.plainMember}/role`, {
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
      member_id: MEMBER.plainMember,
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
      member_id: MEMBER.plainMember,
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
      member_id: MEMBER.plainMember,
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
console.log('[smoke] RBAC: Rechteaenderung wirkt SOFORT (0025 - Aufloesung aus der DB)');
{
  // Der Kern der Umstellung: der Owner nimmt Petra den Moderator-Rang. Ihr
  // Token sagt WEITERHIN "moderator" und ist noch ~10 Minuten gueltig.
  // Vor 0025 haette dieser Claim getragen (has_club_role las den Token) - die
  // Degradierung waere erst beim naechsten Login wirksam geworden. Jetzt loest
  // die DB auf: die Rechte sind sofort weg.
  const demote = await call('PATCH', `/clubs/${CLUB}/members/${MEMBER.moderator}/role`, {
    as: t.owner,
    body: { role: 'member' },
  });
  assertEq('owner demotes the moderator -> 200', demote.status, 200);

  const r = await call('PATCH', `/clubs/${CLUB}/members/${MEMBER.stefanieMember}`, {
    as: t.moderator, // unveraenderter Token, behauptet weiterhin "moderator"
    body: { last_name: 'Darf-Nicht-Durchgehen' },
  });
  // 404, weil der API-Guard noch den Claim liest (und ihn durchwinkt), die RLS
  // aber die Zeile nicht mehr freigibt -> 0 Zeilen -> "not found". Fail-closed:
  // die Schreiboperation findet NICHT statt. Phase 2 (Guards auf has_cap /
  // /me/capabilities) macht daraus ein sauberes 403.
  assertEq('demoted moderator: roster write blocked IMMEDIATELY despite a valid token -> 404', r.status, 404);

  const roster = await call('GET', `/clubs/${CLUB}/members`, { as: t.owner });
  const stefanie = roster.json?.find((m) => m.id === MEMBER.stefanieMember);
  assertEq(
    '...and the master data really is unchanged',
    stefanie?.last_name !== 'Darf-Nicht-Durchgehen',
    true,
  );

  // Rang zuruecksetzen - die folgenden Bloecke brauchen die Moderatorin wieder.
  const restore = await call('PATCH', `/clubs/${CLUB}/members/${MEMBER.moderator}/role`, {
    as: t.owner,
    body: { role: 'moderator' },
  });
  assertEq('owner restores the moderator -> 200', restore.status, 200);
  const back = await call('PATCH', `/clubs/${CLUB}/members/${MEMBER.stefanieMember}`, {
    as: t.moderator,
    body: { last_name: 'Müller-Test' },
  });
  assertEq('...and the restored moderator may write again IMMEDIATELY -> 200', back.status, 200);
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

console.log('[smoke] modules batch 3 (Trainingsplan / Pflichtstunden / Auswertung)');
{
  const KATRIN = 'a0000000-0000-4000-8000-000000000009'; // member a-09 (= SUB.parent)
  const ANNALENA = 'a0000000-0000-4000-8000-000000000005'; // coach member a-05

  // training_slots: read = member, write = trainer
  const slots = await call('GET', `/training-slots?club_id=${CLUB}`, { as: t.parent });
  assertEq('member reads the training plan -> 200', slots.status, 200);
  if (Array.isArray(slots.json) && slots.json.length === 5) ok('training plan has the 5 seeded slots');
  else fail('training plan length', `got ${slots.json?.length}`);

  const memberSlot = await call('POST', '/training-slots', {
    as: t.parent,
    body: { club_id: CLUB, weekday: 3, starts_time: '17:00', ends_time: '18:00' },
  });
  assertEq('plain member CANNOT create a training slot -> 403', memberSlot.status, 403);

  const coachSlot = await call('POST', '/training-slots', {
    as: t.coach,
    body: { club_id: CLUB, weekday: 3, starts_time: '17:00', ends_time: '18:30', note: 'Smoke-Slot' },
  });
  assertEq('coach creates a training slot -> 201', coachSlot.status, 201);

  // duty_entries: self-service, approved trainer-only
  const own = await call('POST', '/duty-entries', {
    as: t.parent,
    body: { club_id: CLUB, member_id: KATRIN, hours: 2, activity_date: '2026-07-01', kind: 'helper' },
  });
  assertEq('member records her OWN hours -> 201', own.status, 201);
  assertEq('...created unapproved', own.json?.approved, false);

  const forOther = await call('POST', '/duty-entries', {
    as: t.parent,
    body: { club_id: CLUB, member_id: ANNALENA, hours: 2, activity_date: '2026-07-01' },
  });
  assertEq('member records for ANOTHER member -> 403', forOther.status, 403);

  const selfApprove = await call('POST', '/duty-entries', {
    as: t.parent,
    body: { club_id: CLUB, member_id: KATRIN, hours: 2, activity_date: '2026-07-01', approved: true },
  });
  assertEq('member self-APPROVING her hours -> 403', selfApprove.status, 403);

  const coachSees = await call('GET', `/duty-entries?club_id=${CLUB}`, { as: t.coach });
  assertEq('coach lists ALL duty entries -> 200', coachSees.status, 200);
  if ((coachSees.json?.length ?? 0) >= 6) ok(`coach sees all duty entries (${coachSees.json.length})`);
  else fail('coach duty-entries count', `got ${coachSees.json?.length}`);

  const memberSees = await call('GET', `/duty-entries?club_id=${CLUB}`, { as: t.parent });
  assertEq('member lists ONLY her own duty entries -> 200', memberSees.status, 200);
  const foreign = (memberSees.json ?? []).filter((e) => e.member_id !== KATRIN);
  assertEq('...no foreign entries leak to the member', foreign.length, 0);

  // reports/summary: trainer/admin only
  // NOTE: earlier smoke steps mutate this shared DB (create a member, issue an
  // invoice), so assert the SHAPE and sane lower bounds, not exact seed totals.
  const summary = await call('GET', `/reports/summary?club_id=${CLUB}`, { as: t.coach });
  assertEq('coach reads the evaluation summary -> 200', summary.status, 200);
  if ((summary.json?.members_total ?? 0) >= 24) ok(`summary.members_total >= 24 (${summary.json.members_total})`);
  else fail('summary.members_total', `got ${summary.json?.members_total}`);
  if ((summary.json?.open_invoices_total_cents ?? 0) >= 38100) ok(`summary.open_invoices_total_cents >= 38100 (${summary.json.open_invoices_total_cents})`);
  else fail('summary.open_invoices_total_cents', `got ${summary.json?.open_invoices_total_cents}`);
  if (Array.isArray(summary.json?.members_by_team) && summary.json.members_by_team.length === 3) ok('summary.members_by_team lists the 3 teams');
  else fail('summary.members_by_team', `got ${JSON.stringify(summary.json?.members_by_team)}`);
  if (summary.json?.medals && typeof summary.json.medals.gold === 'number') ok(`summary.medals tally present (gold=${summary.json.medals.gold})`);
  else fail('summary.medals', `got ${JSON.stringify(summary.json?.medals)}`);
  if (typeof summary.json?.attendance_rate === 'number') ok(`summary.attendance_rate present (${summary.json.attendance_rate})`);
  else fail('summary.attendance_rate', `got ${summary.json?.attendance_rate}`);

  const denied = await call('GET', `/reports/summary?club_id=${CLUB}`, { as: t.parent });
  assertEq('plain member CANNOT read the evaluation summary -> 403', denied.status, 403);
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

console.log('[smoke] platform console: Betreiber-Konsole base (settings/licenses/payments/products/system)');
{
  // --- Einstellungen: SMTP password is NEVER returned in cleartext ----------
  const s = await call('GET', '/platform/settings', { as: t.platform });
  assertEq('platform admin reads settings -> 200', s.status, 200);
  assertEq('...smtp exposes password_set (bool), not a password', typeof s.json?.smtp?.password_set, 'boolean');
  if (!('password' in (s.json?.smtp ?? {}))) ok('...smtp has NO cleartext password field');
  else fail('smtp masking', 'smtp.password leaked in GET response');
  assertEq('...legal placeholder present', typeof s.json?.legal?.impressum, 'string');

  const patched = await call('PATCH', '/platform/settings', {
    as: t.platform,
    body: { smtp: { password: 'super-secret-pw', host: 'smtp.strato.de' }, feature_flags: { maintenance_mode: true } },
  });
  assertEq('platform admin updates settings -> 200', patched.status, 200);
  assertEq('...smtp host persisted', patched.json?.smtp?.host, 'smtp.strato.de');
  assertEq('...password_set now true', patched.json?.smtp?.password_set, true);
  if (!('password' in (patched.json?.smtp ?? {}))) ok('...PATCH response still masks the password');
  else fail('smtp masking (PATCH)', 'smtp.password leaked in PATCH response');
  assertEq('...feature flag persisted', patched.json?.feature_flags?.maintenance_mode, true);

  assertEq('club owner CANNOT read platform settings -> 403',
    (await call('GET', '/platform/settings', { as: t.owner })).status, 403);
  assertEq('plain member CANNOT patch platform settings -> 403',
    (await call('PATCH', '/platform/settings', { as: t.parent, body: { feature_flags: { x: true } } })).status, 403);

  // --- Lizenzen -------------------------------------------------------------
  const ents = await call('GET', '/platform/entitlements', { as: t.platform });
  assertEq('platform admin lists club licenses -> 200', ents.status, 200);
  const clubRow = ents.json?.find?.((e) => e.club_id === CLUB);
  if (clubRow && typeof clubRow.member_count === 'number') ok(`...club_license row carries member_count (${clubRow.member_count})`);
  else fail('platform entitlements row', `got ${JSON.stringify(clubRow)}`);

  const setLic = await call('PATCH', `/platform/entitlements/${CLUB}`, {
    as: t.platform,
    body: { tier: 'premium', status: 'active', reason: 'smoke manual upgrade' },
  });
  assertEq('platform admin sets a club license -> 200', setLic.status, 200);
  assertEq('...tier persisted', setLic.json?.tier, 'premium');
  assertEq('...status persisted', setLic.json?.status, 'active');
  assertEq('...source is manual', setLic.json?.source, 'manual');

  assertEq('club owner CANNOT patch a license -> 403',
    (await call('PATCH', `/platform/entitlements/${CLUB}`, { as: t.owner, body: { tier: 'pro', status: 'active' } })).status, 403);

  // --- Zahlungen ------------------------------------------------------------
  const pay = await call('GET', '/platform/payments?limit=10', { as: t.platform });
  assertEq('platform admin reads payments feed -> 200', pay.status, 200);
  if (pay.json?.subscription_summary && typeof pay.json.subscription_summary.active === 'number') ok('...subscription_summary present');
  else fail('payments summary', `got ${JSON.stringify(pay.json?.subscription_summary)}`);
  if (pay.json?.page && pay.json.page.limit === 10) ok('...pagination envelope present (limit=10)');
  else fail('payments page', `got ${JSON.stringify(pay.json?.page)}`);
  assertEq('club owner CANNOT read payments -> 403',
    (await call('GET', '/platform/payments', { as: t.owner })).status, 403);

  // --- Produkte / Monetarisierung ------------------------------------------
  const prods = await call('GET', '/platform/products', { as: t.platform });
  assertEq('platform admin lists products -> 200', prods.status, 200);
  const prod = prods.json?.[0];
  if (prod?.id) ok(`...catalog non-empty (first: ${prod.code})`);
  else fail('platform products', `got ${JSON.stringify(prods.json)}`);
  const newPrice = (prod?.price_cents ?? 0) + 100;
  const setProd = await call('PATCH', `/platform/products/${prod.id}`, {
    as: t.platform,
    body: { price_cents: newPrice, active: true },
  });
  assertEq('platform admin updates a product price -> 200', setProd.status, 200);
  assertEq('...price persisted', setProd.json?.price_cents, newPrice);
  assertEq('club owner CANNOT patch a product -> 403',
    (await call('PATCH', `/platform/products/${prod.id}`, { as: t.owner, body: { active: false } })).status, 403);

  // --- System ---------------------------------------------------------------
  const sys = await call('GET', '/platform/system', { as: t.platform });
  assertEq('platform admin reads system snapshot -> 200', sys.status, 200);
  if ((sys.json?.migrations?.count ?? 0) >= 19) ok(`...migrations ledger >= 19 (${sys.json.migrations.count})`);
  else fail('system migrations', `got ${sys.json?.migrations?.count}`);
  assertEq('...health ok', sys.json?.health?.status, 'ok');
  if ((sys.json?.db?.clubs ?? 0) >= 1) ok(`...db.clubs >= 1 (${sys.json.db.clubs})`);
  else fail('system db.clubs', `got ${sys.json?.db?.clubs}`);
  assertEq('club owner CANNOT read system -> 403',
    (await call('GET', '/platform/system', { as: t.owner })).status, 403);
}

console.log('');
if (failures > 0) {
  console.error(`[smoke] ${failures} assertion(s) FAILED`);
  process.exit(1);
}
console.log('[smoke] ALL SMOKE CHECKS PASSED');
