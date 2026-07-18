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
/** Der aufgeloeste Rang einer Faehigkeit aus einer /me/capabilities-Antwort. */
function rankOfCapability(resolution, key) {
  return resolution?.capabilities?.find((c) => c.capability_key === key)?.rank;
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
// 0050 (Zielgruppe): VERSCHAERFT von 15 auf 12. Katrin ist selbst in KEINEM
// Team; sie sieht ab jetzt nur die Termine ihrer Kinder (a-07 in t-02, a-08 in
// t-01) plus die beiden Vereinsveranstaltungen — nicht mehr die 4 Termine des
// fremden Teams t-03. Die 16 im Seed (14 Team- + 2 Vereinstermine) sieht nur
// noch der Vorstand. Die Zeile prueft also strenger als vorher, nicht laxer.
const events = (await call('GET', `/events?club_id=${CLUB}`, { as: t.parent })).json;
assertEq('parent sees only her children\'s events + club-wide ones (12 of 16)', events.length, 12);
assertEq('parent sees BOTH club-wide events', events.filter((e) => e.audience === 'club').length, 2);
{
  // Gegenprobe an derselben Stelle: der Vorstand sieht alle 16.
  const all = (await call('GET', `/events?club_id=${CLUB}`, { as: t.owner })).json;
  assertEq('owner sees all 16 events', all.length, 16);
}
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

console.log('[smoke] Vereinsveranstaltung: das Haekchen ist rechtepflichtig (0050)');
{
  const body = (audience, teamIds) => ({
    club_id: CLUB,
    type: 'other',
    title: 'Smoke-Vereinsfest',
    starts_at: new Date(Date.now() + 86400000).toISOString(),
    ends_at: new Date(Date.now() + 90000000).toISOString(),
    audience,
    team_ids: teamIds,
  });
  // "ja verein — darf aber nicht jeder was eintragen": coach darf Termine
  // anlegen, aber KEINE Vereinsveranstaltung.
  const c = await call('POST', '/events', { as: t.coach, body: body('club', []) });
  assertEq('coach cannot publish a club-wide event (403)', c.status, 403);
  const m = await call('POST', '/events', { as: t.parent, body: body('club', []) });
  assertEq('member cannot publish a club-wide event (403)', m.status, 403);
  const tr = await call('POST', '/events', { as: t.treasurer, body: body('club', []) });
  assertEq('treasurer cannot publish a club-wide event (403)', tr.status, 403);
  // Der moderator gehoert zum Vorstand und DARF. Er kam vor 0050 nicht einmal
  // bis hierher: EVENT_WRITE_ROLES kannte ihn nicht, obwohl events_insert ihn
  // seit 0007 durchlaesst (API/DB-Divergenz, live gemessen).
  const mod = await call('POST', '/events', { as: t.moderator, body: body('club', []) });
  assertEq('moderator publishes a club-wide event (201)', mod.status, 201);
  // Der Vorstand darf.
  const o = await call('POST', '/events', { as: t.owner, body: body('club', []) });
  assertEq('owner publishes a club-wide event (201)', o.status, 201);
  assertEq('...and it is stored as club-wide', o.json?.audience, 'club');
  // 'club' + Teams waere eine zweite Wahrheit -> 400 aus dem Contract.
  const bad = await call('POST', '/events', {
    as: t.owner,
    body: body('club', ['b0000000-0000-4000-8000-000000000001']),
  });
  assertEq('club-wide event with team_ids rejected (400)', bad.status, 400);
  // Eigenbefund: die Trainerin haengt Termine nur an IHRE Teams. Sandra
  // betreut t-02/t-03, NICHT t-01 (Minis).
  const foreign = await call('POST', '/events', {
    as: t.coach,
    body: body('teams', ['b0000000-0000-4000-8000-000000000001']),
  });
  assertEq('coach cannot create an event for a team she does not coach (403)', foreign.status, 403);
  const own = await call('POST', '/events', {
    as: t.coach,
    body: body('teams', ['b0000000-0000-4000-8000-000000000002']),
  });
  assertEq('coach creates an event for her OWN team (201)', own.status, 201);
  // Der Vorstand darf fuer JEDES Team anlegen - auch der moderator, der kein
  // Team betreut. Faellt er in den coach-Zweig, bekaeme er hier 403.
  const modTeam = await call('POST', '/events', {
    as: t.moderator,
    body: body('teams', ['b0000000-0000-4000-8000-000000000001']),
  });
  assertEq('moderator creates an event for ANY team (201)', modTeam.status, 201);
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

// ============================================================================
// RBAC Phase 2 — GET /me/capabilities (RBAC-DESIGN §6).
//
// Das ist der Endpunkt, der die 0025-Zusage API-seitig einloest: die Rechte
// kommen aus der DATENBANK, nicht aus dem Claim. Geprueft wird deshalb genau
// das, was der Claim NICHT kann: Mehrfachrollen und Sofortwirkung.
// ============================================================================
{
  console.log('\n[smoke] --- /me/capabilities (RBAC Phase 2) ---');

  // Die Skala, wie lib/capabilities.ts sie kodiert. Der Vergleich unten nagelt
  // sie an die Datenbank: `rank` UND `level` kommen beide aus app.cap_ranks —
  // stimmt CAPABILITY_LEVELS.indexOf(level) nicht mit rank ueberein, ist die
  // TS-Kodierung von app.level_rank abgewichen und jeder requireCap-Guard
  // rechnet falsch. Bewusst hier (HTTP) statt in vitest: nur so wird die ECHTE
  // DB-Skala geprueft und nicht eine zweite Handliste gegen sich selbst.
  const CAPABILITY_LEVELS = ['none', 'read_own', 'read_team', 'read_all', 'edit', 'manage'];

  const caps = async (as, club = CLUB) =>
    call('GET', `/me/capabilities?club_id=${club}`, { as });
  const rankOfCap = (json, key) =>
    json?.capabilities?.find((c) => c.capability_key === key)?.rank;

  // --- Aufloesung je Persona: deckt sie sich mit dem Seed? -------------------
  const ownerCaps = await caps(t.owner);
  assertEq('owner reads /me/capabilities -> 200', ownerCaps.status, 200);
  assertEq('...owner role_keys aus der DB', JSON.stringify(ownerCaps.json?.role_keys), '["owner"]');
  // owner ist protected -> cap_rank schliesst ueberall auf 5 kurz (0025:232).
  // Unveraendert auch nach 0032: die Durchsetzung bleibt 5, nur die gemeldete
  // STUFE wird auf die Skala ausgedrueckt. Genau das friert auch
  // 93e_rbac_resolution.sql:96-113 als "harte Garantie" ein.
  const ownerNot5 = (ownerCaps.json?.capabilities ?? []).filter((c) => c.rank !== 5);
  if (ownerNot5.length === 0) ok('...owner hat auf JEDER Faehigkeit Rang 5 (protected)');
  else fail('owner ranks', `nicht 5: ${ownerNot5.map((c) => c.capability_key).join(',')}`);

  // NEU (0032): die gemeldete Stufe liegt bei JEDER Faehigkeit in allowed_levels.
  // Vorher meldete der owner z. B. member_contact=manage, obwohl die Skala nur
  // {none,read_all} kennt — ein Admin-Dropdown aus allowed_levels fand den Wert
  // nicht. Das galt bei 17 von 32 Faehigkeiten (alle mit max(allowed) < 5).
  const offScale = (ownerCaps.json?.capabilities ?? []).filter(
    (c) => !c.allowed_levels.includes(c.level),
  );
  if (offScale.length === 0) {
    ok('...owner: die gemeldete Stufe liegt bei JEDER Faehigkeit in allowed_levels');
  } else {
    fail('owner level ausserhalb allowed_levels',
      JSON.stringify(offScale.map((c) => ({ k: c.capability_key, level: c.level, allowed: c.allowed_levels }))));
  }
  assertEq('...owner member_contact meldet read_all (nicht das erfundene manage)',
    ownerCaps.json?.capabilities?.find((c) => c.capability_key === 'member_contact')?.level,
    'read_all');

  // DIE Skalen-Kontrolle (siehe oben) — bewusst an einer NICHT geschuetzten
  // Persona. Beim protected owner gilt indexOf(level) === rank seit 0032
  // ABSICHTLICH nicht mehr: rank ist die Durchsetzung (5, auch ueber der
  // Skala), level dieselbe Berechtigung AUF der Skala. Die Invariante hier an
  // ihm zu messen, hiesse den einen Sonderfall zu pruefen statt der Skala.
  const coachScaleCaps = await caps(t.coach);
  assertEq('coach reads /me/capabilities -> 200 (fuer die Skalen-Kontrolle)', coachScaleCaps.status, 200);
  const scaleMismatch = (coachScaleCaps.json?.capabilities ?? []).filter(
    (c) => CAPABILITY_LEVELS.indexOf(c.level) !== c.rank,
  );
  if (scaleMismatch.length === 0) {
    ok('...TS-Skala deckt sich mit app.level_rank (indexOf(level) === rank, ohne Kurzschluss)');
  } else {
    fail('TS-Skala vs. app.level_rank', JSON.stringify(scaleMismatch.slice(0, 3)));
  }

  const treasurerCaps = await caps(t.treasurer);
  assertEq('treasurer reads /me/capabilities -> 200', treasurerCaps.status, 200);
  assertEq('...treasurer finance = manage (5)', rankOfCap(treasurerCaps.json, 'finance'), 5);
  assertEq('...treasurer member_contact = read_all (3)',
    rankOfCap(treasurerCaps.json, 'member_contact'), 3);
  // Der Kassenwart schreibt keine Kueren — vor UND nach dem Split (0028).
  assertEq('...treasurer routines_edit = none (0)', rankOfCap(treasurerCaps.json, 'routines_edit'), 0);
  assertEq('...treasurer routines (Lesen) = read_own (1)', rankOfCap(treasurerCaps.json, 'routines'), 1);

  const coachCaps = await caps(t.coach);
  assertEq('coach reads /me/capabilities -> 200', coachCaps.status, 200);
  assertEq('...coach routines (Lesen) = read_team (2)', rankOfCap(coachCaps.json, 'routines'), 2);
  assertEq('...coach routines_edit (Schreiben) = edit (4)', rankOfCap(coachCaps.json, 'routines_edit'), 4);
  assertEq('...coach attendance = edit (4)', rankOfCap(coachCaps.json, 'attendance'), 4);
  assertEq('...coach finance = read_own (1)', rankOfCap(coachCaps.json, 'finance'), 1);
  assertEq('...coach roles = none (0)', rankOfCap(coachCaps.json, 'roles'), 0);

  const memberCaps = await caps(t.parent);
  assertEq('member reads /me/capabilities -> 200', memberCaps.status, 200);
  assertEq('...member routines = read_own (1)', rankOfCap(memberCaps.json, 'routines'), 1);
  assertEq('...member routines_edit = none (0)', rankOfCap(memberCaps.json, 'routines_edit'), 0);
  assertEq('...member member_contact = none (0)', rankOfCap(memberCaps.json, 'member_contact'), 0);
  assertEq('...member members = read_all (3), NICHT manage',
    rankOfCap(memberCaps.json, 'members'), 3);

  // Der Katalog reist vollstaendig mit — das Admin-UI braucht Labels + Optionen.
  const first = memberCaps.json?.capabilities?.[0];
  if (first?.label_de && first?.label_en && Array.isArray(first?.allowed_levels)) {
    ok('...Katalog liefert bilinguale Labels + allowed_levels mit');
  } else {
    fail('capability catalog', `got ${JSON.stringify(first)}`);
  }

  // --- Gegenprobe: kein Mitglied, keine Aufloesung --------------------------
  assertEq('Fremde bekommt KEINE Aufloesung fuer diesen Verein -> 403',
    (await caps(t.foreign)).status, 403);

  // --- GESCHUETZTE FAEHIGKEITEN (0032) --------------------------------------
  // Der Katalog muss owner_only mitliefern, sonst baut das Admin-UI ein
  // Dropdown, das beim Speichern 403 liefert.
  const ownerOnlyKeys = (ownerCaps.json?.capabilities ?? [])
    .filter((c) => c.owner_only === true)
    .map((c) => c.capability_key)
    .sort();
  assertEq('...der Katalog meldet owner_only fuer genau lockers/member_contact/finance',
    JSON.stringify(ownerOnlyKeys), JSON.stringify(['finance', 'lockers', 'member_contact']));
}

// ============================================================================
// Geschuetzte Faehigkeiten + die Inhaber-Rolle (0032) ueber HTTP.
//
// Belegt war: eine Moderatorin hob per PUT .../roles/{ihreRolleId}/permissions
// ihre EIGENE Rolle bei 'lockers' von read_own auf manage (200) und sah danach
// alle 8 Schliessfaecher statt 0 — quer zur Privacy-Entscheidung 0021. Und die
// protected owner-Rolle liess sich in "Putzkraft" umbenennen (200).
// ============================================================================
{
  console.log('\n[smoke] --- geschuetzte Faehigkeiten + Inhaber-Rolle (0032) ---');
  const roles = await call('GET', `/clubs/${CLUB}/roles`, { as: t.owner });
  const roleId = (key) => roles.json?.find((r) => r.key === key)?.id;
  const modRole = roleId('moderator');
  const ownerRole = roleId('owner');
  if (modRole && ownerRole) ok('Rollen-Ids gefunden (moderator + owner)');
  else fail('roles lookup', JSON.stringify(roles.json)?.slice(0, 200));

  const setPerms = (as, rid, permissions) =>
    call('PUT', `/clubs/${CLUB}/roles/${rid}/permissions`, { as, body: { permissions } });

  // Die Moderatorin HAT roles:manage — sonst belegt der Test nichts.
  const modCaps = await call('GET', `/me/capabilities?club_id=${CLUB}`, { as: t.moderator });
  assertEq('Vorbedingung: die Moderatorin hat roles = manage (5)',
    modCaps.json?.capabilities?.find((c) => c.capability_key === 'roles')?.rank, 5);

  // ... und kommt trotzdem nicht an die geschuetzten Faehigkeiten.
  assertEq('Moderatorin hebt ihre EIGENE Rolle bei lockers NICHT auf manage -> 403',
    (await setPerms(t.moderator, modRole, [{ capability_key: 'lockers', level: 'manage' }])).status, 403);
  assertEq('...member_contact ebenso wenig -> 403',
    (await setPerms(t.moderator, modRole, [{ capability_key: 'member_contact', level: 'read_all' }])).status, 403);
  assertEq('...finance ebenso wenig -> 403',
    (await setPerms(t.moderator, modRole, [{ capability_key: 'finance', level: 'manage' }])).status, 403);

  // Und der Schaden ist ausgeblieben: sie sieht weiterhin KEINE Schliessfaecher.
  const modLockers = await call('GET', `/lockers?club_id=${CLUB}`, { as: t.moderator });
  assertEq('...und sie sieht weiterhin 0 Schliessfaecher (der eigentliche Schaden)',
    (modLockers.json ?? []).length, 0);

  // Gegenprobe 1: NICHT geschuetzte Faehigkeiten darf sie weiterhin setzen —
  // sonst waere der Rollen-Admin insgesamt entmachtet statt gezielt begrenzt.
  assertEq('Moderatorin setzt eine NICHT geschuetzte Faehigkeit weiterhin (news) -> 200',
    (await setPerms(t.moderator, modRole, [{ capability_key: 'news', level: 'read_all' }])).status, 200);

  // Gegenprobe 2: der Inhaber darf die geschuetzte Faehigkeit vergeben.
  assertEq('der Inhaber DARF lockers vergeben -> 200',
    (await setPerms(t.owner, modRole, [{ capability_key: 'lockers', level: 'manage' }])).status, 200);
  // ... und das wirkt sofort (Mehrfachrollen/Aufloesung ohne neuen Token).
  const modLockers2 = await call('GET', `/lockers?club_id=${CLUB}`, { as: t.moderator });
  assertEq('...und die Moderatorin sieht danach sofort alle 8 (gleicher Token)',
    (modLockers2.json ?? []).length, 8);
  // Aufraeumen: zurueck auf den Seed-Stand.
  assertEq('zurueckgesetzt auf read_own -> 200',
    (await setPerms(t.owner, modRole, [{ capability_key: 'lockers', level: 'read_own' }])).status, 200);

  // Die Inhaber-Rolle: Rechte UND Name sind unantastbar.
  assertEq('die Rechte der Inhaber-Rolle bleiben geschuetzt -> 409',
    (await setPerms(t.owner, ownerRole, [{ capability_key: 'news', level: 'none' }])).status, 409);
  assertEq('die Inhaber-Rolle laesst sich NICHT umbenennen (war "Putzkraft") -> 409',
    (await call('PATCH', `/clubs/${CLUB}/roles/${ownerRole}`, {
      as: t.owner, body: { name_de: 'Putzkraft', name_en: 'Cleaner' },
    })).status, 409);
  // Gegenprobe: jede ANDERE Systemrolle bleibt frei benennbar.
  assertEq('eine andere Systemrolle bleibt frei benennbar -> 200',
    (await call('PATCH', `/clubs/${CLUB}/roles/${roleId('coach')}`, {
      as: t.owner, body: { name_de: 'Uebungsleitung', name_en: 'Head coach' },
    })).status, 200);
}

// ============================================================================
// POST /routines — das Kernfeature WIRKLICH ausueben, nicht nur die
// Capability-Raenge daneben abfragen.
//
// WARUM DIESER BLOCK EXISTIERT: der Smoke hat zu 'routines' bisher NUR die
// Raenge oben geprueft (routines_edit = 4 usw.) und deshalb "ALL PASSED"
// gemeldet, WAEHREND POST /routines fuer ALLE 8 Personas 403 lieferte — auch
// fuer den Vereinsinhaber. Ein Rang ist kein Beweis, dass der Endpoint geht.
// Ursache war das `returning *` im INSERT (Details: routes/routines.ts und
// supabase/tests/sql/93f_routines_returning.sql).
//
// Teams: b-03 Kuergruppe Leistung (Sandra=coach UND Milena=guest_coach betreuen
// es), b-01 Minis & Anfaenger (Sandra betreut es NICHT).
// ============================================================================
{
  console.log('\n[smoke] --- POST /routines: Kuer anlegen (der echte Pfad, inkl. RETURNING) ---');
  const TEAM_EIGEN = 'b0000000-0000-4000-8000-000000000003';
  const TEAM_FREMD = 'b0000000-0000-4000-8000-000000000001';
  const mkRoutine = (as, body) => call('POST', '/routines', { as, body });

  // --- Die 5 Trainer-Rollen legen an: 201 + eine echte Kuer zurueck ---------
  for (const [label, as] of [
    ['owner', t.owner], ['admin', t.admin], ['moderator', t.moderator],
    ['coach', t.coach], ['guest_coach', t.guest],
  ]) {
    const r = await mkRoutine(as, {
      club_id: CLUB, team_id: TEAM_EIGEN,
      title: `Smoke-Kuer ${label}`, skater_member_ids: [],
    });
    assertEq(`${label} legt eine Kuer an -> 201`, r.status, 201);
    if (r.json?.id && r.json?.title === `Smoke-Kuer ${label}` && r.json?.status === 'draft') {
      ok(`...${label} bekommt die angelegte Kuer zurueck (id + title + status)`);
    } else {
      fail(`POST /routines als ${label}`, `got ${JSON.stringify(r.json)}`);
    }
    // Der Beweis, dass die Kuer WIRKLICH da ist: ueber den Lesepfad wiederfinden.
    const list = await call('GET', `/routines?club_id=${CLUB}`, { as });
    if ((list.json ?? []).some((x) => x.id === r.json?.id)) {
      ok(`...${label} findet sie danach in GET /routines wieder`);
    } else {
      fail(`GET /routines als ${label}`, `angelegte Kuer ${r.json?.id} fehlt in der Liste`);
    }
  }

  // --- Wer NICHT schreiben darf, darf auch weiterhin nicht ------------------
  assertEq('treasurer legt KEINE Kuer an -> 403',
    (await mkRoutine(t.treasurer, {
      club_id: CLUB, team_id: TEAM_EIGEN, title: 'darf nicht', skater_member_ids: [],
    })).status, 403);
  assertEq('member legt KEINE Kuer an -> 403',
    (await mkRoutine(t.parent, {
      club_id: CLUB, team_id: TEAM_EIGEN, title: 'darf nicht', skater_member_ids: [],
    })).status, 403);
  assertEq('Vereinsfremde legt KEINE Kuer an -> 403',
    (await mkRoutine(t.foreign, {
      club_id: CLUB, team_id: TEAM_EIGEN, title: 'darf nicht', skater_member_ids: [],
    })).status, 403);

  // --- Die Asymmetrie: Schreiben ist weiter als Lesen ----------------------
  // Ein coach DARF fuer ein fremdes Team schreiben (routines_edit), saehe das
  // Ergebnis aber nie (can_read_routine). Die API bricht deshalb mit 422 ab,
  // statt eine unsichtbare Geisterzeile zu hinterlassen.
  assertEq('coach legt KEINE Kuer fuer ein fremdes Team an -> 422',
    (await mkRoutine(t.coach, {
      club_id: CLUB, team_id: TEAM_FREMD, title: 'fremdes Team', skater_member_ids: [],
    })).status, 422);
  assertEq('coach legt KEINE teamlose Kuer an (saehe er nicht) -> 422',
    (await mkRoutine(t.coach, {
      club_id: CLUB, title: 'ohne Team', skater_member_ids: [],
    })).status, 422);
  // Der owner sieht alles im Verein -> fuer ihn ist beides regulaer.
  assertEq('owner legt sehr wohl eine teamlose Kuer an -> 201',
    (await mkRoutine(t.owner, {
      club_id: CLUB, title: 'Smoke-Kuer owner ohne Team', skater_member_ids: [],
    })).status, 201);

  // --- Mit Laeufer:innen (der n:m-Zweig schreibt routine_skaters) -----------
  {
    const r = await mkRoutine(t.coach, {
      club_id: CLUB, team_id: TEAM_EIGEN, title: 'Smoke-Kuer mit Laeuferin',
      skater_member_ids: [MEMBER.linaChildOfParent],
    });
    assertEq('coach legt eine Kuer MIT Laeuferin an -> 201', r.status, 201);
    if (JSON.stringify(r.json?.skater_member_ids) === JSON.stringify([MEMBER.linaChildOfParent])) {
      ok('...die Laeuferin kommt in skater_member_ids zurueck');
    } else {
      fail('routine skaters', `got ${JSON.stringify(r.json?.skater_member_ids)}`);
    }
  }
}

// ============================================================================
// Kueren-Medien: Musik + Bild DIREKT an eine Kuer hochladen (multipart).
//
// DER KERNBEWEIS (die Lehre aus dem Mandanten-Leck, Revert 6dafb38):
// Der erste Versuch nahm einen vom CLIENT gelieferten storage_key. Ein Trainer
// aus Verein A konnte den Key von Verein B anhaengen -> media_assets(club_id=A,
// storage_path=B-Bytes) -> GET /media/{key} lieferte FREMDE Kinderfotos an alle
// Mitglieder von A. Diese Bauform macht den Angriff STRUKTURELL unmoeglich: es
// gibt keinen client-gelieferten storage_key mehr. Der Upload laeuft in EINEM
// multipart-Schritt DIREKT an die Kuer, der Server erzeugt den Key und setzt
// club_id = routine.club_id. Der Block beweist:
//   * ein JSON-Body mit storage_key (die ALTE Angriffsform) prallt ab (400).
//   * untergeschobene storage_key/storage_path-Felder haben KEINE Wirkung — der
//     Server nimmt seinen eigenen frischen Key, nie den fremden Pfad.
//   * ein Fremdverein-Mitglied bekommt den Key nicht (404).
// Plus die uebrigen Wachen: fremdes Team -> 404, sichtbares Mitglied -> 403,
// Bild-als-Audio/Audio-als-Bild -> 415, und der Positivpfad Ende-zu-Ende.
// ============================================================================
{
  console.log('\n[smoke] --- Kueren-Medien: Musik + Bild DIREKT hochladen (multipart) ---');
  const TEAM_EIGEN = 'b0000000-0000-4000-8000-000000000003'; // b-03: Sandra ist Trainerin
  const TEAM_FREMD = 'b0000000-0000-4000-8000-000000000001'; // b-01: Sandra ist KEINE Trainerin
  const KATRIN = 'a0000000-0000-4000-8000-000000000009';     // einfaches Mitglied (Profil = SUB.parent)

  // Eine Kuer im EIGENEN Team, Skaterin = Katrin (einfaches Mitglied). Damit
  // kann t.parent die Kuer LESEN (read_own), aber nicht als Trainer:in anhaengen
  // -> sauberer 403 (Rolle), abgegrenzt vom 404 (Sichtbarkeit) des treasurer.
  const created = await call('POST', '/routines', {
    as: t.coach,
    body: { club_id: CLUB, team_id: TEAM_EIGEN, title: 'Smoke-Kuer Medien', skater_member_ids: [KATRIN] },
  });
  assertEq('Kuer fuer den Medien-Test anlegen -> 201', created.status, 201);
  const routineId = created.json?.id;

  // multipart-POST DIREKT an die Kuer (Blob/FormData wie im Browser). extraFields
  // erlaubt es, untergeschobene storage_key/-path mitzuschicken (Angriffsprobe).
  const attach = async (as, routine, kind, bytes, type, name, extraFields = {}) => {
    const form = new FormData();
    form.set('file', new Blob([bytes], { type }), name);
    for (const [k, v] of Object.entries(extraFields)) form.set(k, v);
    const res = await fetch(`${BASE}/routines/${routine}/${kind}`, {
      method: 'POST', headers: { authorization: `Bearer ${as}` }, body: form,
    });
    let json; try { json = await res.json(); } catch { json = undefined; }
    return { status: res.status, json };
  };
  const serve = (as, key) =>
    fetch(`${BASE}/media/${encodeURIComponent(key)}`, { headers: { authorization: `Bearer ${as}` } });

  const mp3 = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x21, 0x11]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);

  // --- KERNBEWEIS 1: der Angreifer kann keinen fremden Key referenzieren -----
  // Untergeschobene storage_key/storage_path (echter Pfad einer FREMDEN
  // media_assets-Seedzeile: Feuervogel-Kuer) werden IGNORIERT. Der Server nimmt
  // seinen eigenen frischen Key.
  const FOREIGN_SEED_PATH = 'clubs/rsv-neckarsulm/routines/feuervogel.mp3';
  const attackAttach = await attach(t.coach, routineId, 'audio', mp3, 'audio/mpeg', 'x.mp3', {
    storage_key: FOREIGN_SEED_PATH,
    storage_path: FOREIGN_SEED_PATH,
    club_id: FOREIGN_CLUB,
  });
  assertEq('multipart-Attach mit untergeschobenem Key -> 200', attackAttach.status, 200);
  const serverKey = attackAttach.json?.audio_url?.replace('/media/', '');
  if (serverKey && serverKey !== FOREIGN_SEED_PATH && attackAttach.json?.audio_url === `/media/${serverKey}`) {
    ok(`...der Server hat einen EIGENEN Key erzeugt (${serverKey}), nicht den fremden Pfad`);
  } else {
    fail('attack key', `audio_url=${attackAttach.json?.audio_url} (erwartet einen frischen Server-Key)`);
  }
  // Der Fremdpfad ist als flacher key gar nicht adressierbar (enthaelt '/',
  // assertValidKey wirft -> 400) und selbst wenn, gaebe media_assets_select ihn
  // nicht frei. Beweis: er ist NICHT abrufbar (400 invalid-key, nicht 200).
  {
    const attempt = (await serve(t.coach, FOREIGN_SEED_PATH)).status;
    if (attempt === 400 || attempt === 404) ok(`...der untergeschobene Fremdpfad ist NICHT abrufbar -> ${attempt}`);
    else fail('foreign path serve', `erwartet 400/404, bekam ${attempt}`);
  }
  // KERNBEWEIS 2: die ALTE Angriffsform (JSON-Body mit storage_key) prallt ab.
  assertEq('JSON-Body mit storage_key (alte Angriffsform) -> 400 (kein multipart-file)',
    (await call('POST', `/routines/${routineId}/audio`, {
      as: t.coach, body: { storage_key: FOREIGN_SEED_PATH, mime_type: 'audio/mpeg', size_bytes: 10 },
    })).status, 400);

  // --- Positivpfad Ende-zu-Ende: echte mp3 direkt an die Kuer ---------------
  const upA = await attach(t.coach, routineId, 'audio', mp3, 'audio/mpeg', 'kuer.mp3', {
    music_title: 'Feuervogel', music_bpm: '92', duration_ms: '141000',
  });
  assertEq('POST /routines/{id}/audio (multipart) -> 200', upA.status, 200);
  if (typeof upA.json?.audio_asset_id === 'string' && upA.json.audio_asset_id.length > 0) {
    ok('...audio_asset_id ist gesetzt');
  } else {
    fail('audio attach', `audio_asset_id fehlt: ${JSON.stringify(upA.json)}`);
  }
  assertEq('...music_title wurde uebernommen', upA.json?.music_title, 'Feuervogel');
  assertEq('...music_bpm wurde uebernommen', upA.json?.music_bpm, 92);
  const audioKey = upA.json?.audio_url?.replace('/media/', '');
  assertEq('...audio_url zeigt auf /media/<server-key>', upA.json?.audio_url, `/media/${audioKey}`);

  // Persistenz ueber den Lesepfad + die Bytes ueber GET /media/{key}.
  const reread = await call('GET', `/routines/${routineId}`, { as: t.coach });
  assertEq('GET /routines/{id}: audio_asset_id persistiert', reread.json?.audio_asset_id, upA.json?.audio_asset_id);
  const serveA = await serve(t.coach, audioKey);
  assertEq('GET /media/{audioKey} -> 200', serveA.status, 200);
  assertEq('...content-type der Bytes = audio/mpeg', serveA.headers.get('content-type'), 'audio/mpeg');
  assertEq('...Byte-Laenge stimmt', (await serveA.arrayBuffer()).byteLength, mp3.length);

  // KERNBEWEIS 3: der Key ist auf den Verein der Kuer begrenzt — ein
  // Fremdverein-Owner bekommt ihn NICHT (media_assets_select = is_club_member).
  assertEq('Fremdverein-Mitglied ruft den Kuer-Audio-Key ab -> 404',
    (await serve(t.foreign, audioKey)).status, 404);

  // --- Bild: upload -> serve ------------------------------------------------
  const upI = await attach(t.coach, routineId, 'image', png, 'image/png', 'cover.png');
  assertEq('POST /routines/{id}/image (multipart) -> 200', upI.status, 200);
  if (typeof upI.json?.image_asset_id === 'string' && upI.json.image_asset_id.length > 0) {
    ok('...image_asset_id ist gesetzt');
  } else {
    fail('image attach', `image_asset_id fehlt: ${JSON.stringify(upI.json)}`);
  }
  const imgKey = upI.json?.image_url?.replace('/media/', '');
  assertEq('GET /media/{imgKey} -> 200', (await serve(t.coach, imgKey)).status, 200);

  // --- Typ-Vertauscher scheitert (Bild als Musik, Musik als Bild) -> 415 ----
  assertEq('Bild-Typ an /audio -> 415',
    (await attach(t.coach, routineId, 'audio', png, 'image/png', 'x.png')).status, 415);
  assertEq('Audio-Typ an /image -> 415',
    (await attach(t.coach, routineId, 'image', mp3, 'audio/mpeg', 'x.mp3')).status, 415);

  // --- Rechte: sichtbares Mitglied -> 403, unsichtbar -> 404, fremdes Team --
  assertEq('Mitglied (sieht die Kuer, aber keine Trainerrolle) -> 403',
    (await attach(t.parent, routineId, 'audio', mp3, 'audio/mpeg', 'x.mp3')).status, 403);
  assertEq('treasurer (sieht die Kuer NICHT) -> 404',
    (await attach(t.treasurer, routineId, 'audio', mp3, 'audio/mpeg', 'x.mp3')).status, 404);

  // Fremdes Team: der owner legt eine Kuer in b-01 an (Sandra ist dort KEINE
  // Trainerin) -> can_read_routine faellt fuer sie auf 404, wie bei /markers.
  const foreignTeamRoutine = await call('POST', '/routines', {
    as: t.owner, body: { club_id: CLUB, team_id: TEAM_FREMD, title: 'Smoke b-01', skater_member_ids: [] },
  });
  assertEq('owner legt Kuer im fremden Team an -> 201', foreignTeamRoutine.status, 201);
  assertEq('coach haengt Musik an eine Kuer eines NICHT betreuten Teams -> 404',
    (await attach(t.coach, foreignTeamRoutine.json?.id, 'audio', mp3, 'audio/mpeg', 'x.mp3')).status, 404);

  // --- DELETE loest wieder (Feld null, Bytes weg) --------------------------
  const del = await call('DELETE', `/routines/${routineId}/audio`, { as: t.coach });
  assertEq('DELETE /routines/{id}/audio -> 200', del.status, 200);
  assertEq('...audio_asset_id ist wieder null', del.json?.audio_asset_id, null);
  assertEq('geloeste Musik ist nicht mehr abrufbar -> 404', (await serve(t.coach, audioKey)).status, 404);
}

// ============================================================================
// /reports/anniversaries — das Datenleck ist zu, das FEATURE ist wieder da.
//
// GESCHICHTE IN ZWEI SCHRITTEN, damit niemand den zweiten fuer einen Rueckbau
// des ersten haelt:
//
//  1. URSPRUNG: der Report gab JEDEM Mitglied `date` + `years`. Bei einem
//     Geburtstag ist `years` das ALTER -> `date - years` = exaktes
//     Geburtsdatum. Belegt war das Geburtsdatum eines 10-jaehrigen Kindes,
//     ausgeliefert an eine familienfremde Gast-Trainerin, obwohl der Roster
//     birth_date fuer dieselbe Person redigiert.
//  2. ERSTE ANTWORT: member_contact >= read_all -> coach/member/guest_coach
//     bekamen 403. Leck zu — aber der Verein wusste auch nicht mehr, wer
//     Geburtstag hat. Ein abgeschaltetes Feature ist keine geloeste Aufgabe.
//  3. JETZT: getrennt nach Art. Geburtstag -> Tag+Monat, years=null (der
//     Verein soll WANN wissen, nicht WIE ALT). Jubilaeum -> years bleibt, dort
//     ist die Zahl der ganze Sinn. Damit brauchen die Geburtstage keine
//     Spaltenschranke mehr, und alle duerfen wieder gucken.
//
// DIE INVARIANTE, die dieser Block bewacht, ist damit NICHT mehr
// "Report-Zugang == Roster-Zugang", sondern die schaerfere:
//   AUS DIESEM REPORT LAESST SICH KEIN GEBURTSDATUM REKONSTRUIEREN — fuer
//   KEINE Rolle, auch nicht fuer den Vorstand.
// ============================================================================
{
  console.log('\n[smoke] --- /reports/anniversaries: sichtbar fuer alle, ohne Alter ---');
  const ann = async (as) => call('GET', `/reports/anniversaries?club_id=${CLUB}`, { as });

  const treas = await ann(t.treasurer);
  assertEq('treasurer liest Jubilaeen -> 200', treas.status, 200);
  if ((treas.json?.length ?? 0) > 0) ok(`...mit Eintraegen (${treas.json.length})`);
  else fail('anniversaries treasurer', `got ${JSON.stringify(treas.json)}`);
  assertEq('owner liest Jubilaeen -> 200', (await ann(t.owner)).status, 200);
  assertEq('admin liest Jubilaeen -> 200', (await ann(t.admin)).status, 200);
  assertEq('moderator liest Jubilaeen -> 200', (await ann(t.moderator)).status, 200);

  // Der Verein darf wieder gratulieren: genau die drei, die vorher 403 bekamen.
  assertEq('guest_coach sieht Geburtstage wieder -> 200', (await ann(t.guest)).status, 200);
  assertEq('coach sieht Geburtstage wieder -> 200', (await ann(t.coach)).status, 200);
  assertEq('member sieht Geburtstage wieder -> 200', (await ann(t.parent)).status, 200);

  // DIE KERNZUSAGE: kein Geburtstag traegt jemals `years` — fuer NIEMANDEN.
  // Ohne years ist `date` nur Tag+Monat und rekonstruiert nichts.
  for (const [name, tok] of [
    ['owner', t.owner], ['admin', t.admin], ['moderator', t.moderator],
    ['treasurer', t.treasurer], ['coach', t.coach], ['member', t.parent],
    ['guest_coach', t.guest],
  ]) {
    const rows = (await ann(tok)).json ?? [];
    const birthdays = rows.filter((r) => r.kind === 'birthday');
    const leaky = birthdays.filter((r) => r.years !== null && r.years !== undefined);
    if (leaky.length === 0) {
      ok(`...${name}: ${birthdays.length} Geburtstag(e), 0 davon mit Alter (nicht rekonstruierbar)`);
    } else {
      fail(`${name} Geburtstags-Leck`, `${leaky.length} Eintraege mit years: ${JSON.stringify(leaky[0])}`);
    }
  }

  // Der Original-Fall, wortwoertlich: Emma (2016-11-03) und die familienfremde
  // Gast-Trainerin. Sie muss den TAG sehen und darf das JAHR nicht ableiten.
  {
    const rows = (await ann(t.guest)).json ?? [];
    const emma = rows.find((r) => r.kind === 'birthday' && r.member_name.includes('Emma'));
    if (emma && emma.years === null && emma.date.endsWith('-11-03')) {
      ok(`...guest_coach sieht "Emma hat am 3.11. Geburtstag" — aber nicht, dass sie 2016 geboren ist`);
    } else {
      fail('Emma-Fall', `got ${JSON.stringify(emma)}`);
    }
  }

  // Vereinsjubilaeen sind das GEGENTEIL der Geburtstage: dort ist `years` der ganze
  // Sinn ("10 Jahre dabei") und laesst sich deshalb NICHT wegnullen, ohne den Report
  // kaputtzumachen. Damit ist `date` minus `years` aber exakt joined_on — eine
  // Spalte, die derselbe Server im Roster redigiert (SENSITIVE_MEMBER_FIELDS).
  //
  // Hier stand vorher die Zusicherung "Jubilaeen behalten ihre Jahre" — geprueft
  // ausgerechnet als coach. Sie war GRUEN, waehrend eine vereinsfremde Gast-Trainerin
  // joined_on fuer 5 Personen tagesgenau rekonstruieren konnte. Der Test bewachte
  // das Leck, statt es zu finden.
  //
  // Auch "nur `years` nullen" reicht nicht: bei einem 5-Jahres-Raster erscheint eine
  // Person ueberhaupt nur, wenn joined_on ein Vielfaches von 5 zurueckliegt — die
  // blosse Anwesenheit engt das Jahr schon ein. Bei Geburtstagen ist diese
  // Rundheits-Falle durch "ALLE statt nur runde" geschlossen; bei Jubilaeen geht das
  // nicht, denn ein Jubilaeum IST das Raster. Also: ganze Zeilen weg.
  //
  // DIE REGEL, gegen die richtige Referenz geprueft (nicht gegen eine Wunschliste):
  // Jubilaeums-Zeilen erscheinen GENAU DANN, wenn derselben Person der Roster
  // joined_on zeigt. Report und Roster muessen dieselbe Antwort geben — sonst ist
  // der Report wieder ein Umgehungspfad um die eigene Redigierung.
  const rosterShows = async (as, field) => {
    const r = await call('GET', `/clubs/${CLUB}/members`, { as });
    return (r.json ?? []).some((m) => m[field] !== null && m[field] !== undefined);
  };
  for (const [name, tok] of [
    ['owner', t.owner], ['admin', t.admin], ['moderator', t.moderator],
    ['treasurer', t.treasurer], ['coach', t.coach], ['member', t.parent],
    ['guest_coach', t.guest],
  ]) {
    const memberships = ((await ann(tok)).json ?? []).filter((r) => r.kind === 'membership');
    const rosterJoinedOn = await rosterShows(tok, 'joined_on');
    if ((memberships.length > 0) !== rosterJoinedOn) {
      fail(
        `${name}: Report widerspricht dem Roster`,
        `${memberships.length} Jubilaeums-Zeile(n), aber Roster zeigt joined_on=${rosterJoinedOn}` +
          (memberships.length ? ` — z.B. ${JSON.stringify(memberships[0])} => joined_on ableitbar` : ''),
      );
    } else if (rosterJoinedOn) {
      // Wer joined_on ohnehin sieht, MUSS die Zahl bekommen — sonst ist der Report
      // fuer die, die das Jubilaeum ausrichten, wertlos.
      if (memberships.every((r) => typeof r.years === 'number')) {
        ok(`...${name}: darf joined_on sehen -> ${memberships.length} Jubilaeum/Jubilaeen MIT Jahren`);
      } else {
        fail(`${name}: Jubilaeum ohne Jahre`, `got ${JSON.stringify(memberships[0])}`);
      }
    } else {
      ok(`...${name}: joined_on redigiert -> 0 Jubilaeen, nichts zu rekonstruieren`);
    }
  }

  // Die Redigierung im Roster selbst bleibt unberuehrt — Gegenprobe, damit obiges
  // nicht deshalb "stimmig" ist, weil der Roster kaputt ist und allen alles zeigt.
  // treasurer (privilegiert) sieht alles, member/guest_coach gar keine KONTAKTdaten.
  // Der coach ist seit 0054 ZEILENWEISE (nur eigenes Team) und wird direkt darunter
  // PRAEZISER geprueft (eigenes Team sichtbar, fremdes redigiert) statt hier grob.
  for (const [name, tok, expected] of [
    ['treasurer', t.treasurer, true],
    ['member', t.parent, false],
    ['guest_coach', t.guest, false],
  ]) {
    const rosterOk = await rosterShows(tok, 'birth_date');
    if (rosterOk === expected) ok(`...${name}: Roster-Redigierung von birth_date unveraendert (${rosterOk ? 'sichtbar' : 'redigiert'})`);
    else fail(`${name} roster redaction`, `roster_birth_date=${rosterOk}, expected ${expected}`);
  }

  // 0054 — der coach (Sandra, betreut t-02 + t-03) sieht die KONTAKTdaten
  // (birth_date) der Kinder SEINER Teams, aber NICHT die eines fremden Teams. Genau
  // die zeilenweise Grenze aus maySeeContactOf (privileged || _coach_of_member),
  // durch die echte HTTP-Schicht. VERSCHAERFT die fruehere grobe "coach sieht
  // nichts"-Zeile (die vor 0054 galt) zu einer Zwei-Richtungs-Pruefung.
  {
    const EMMA_T01 = 'a0000000-0000-4000-8000-000000000008'; // Kind in t-01 — NICHT Sandras Team
    const rosterField = async (tok, memberId, field) => {
      const r = await call('GET', `/clubs/${CLUB}/members`, { as: tok });
      return (r.json ?? []).find((m) => m.id === memberId)?.[field];
    };
    const linaBirth = await rosterField(t.coach, MEMBER.linaChildOfParent, 'birth_date');
    if (linaBirth) ok('...coach sieht birth_date eines Kindes SEINES Teams (Lina, t-02) — 0054');
    else fail('coach roster contact (0054, eigenes Team)', `Lina birth_date=${JSON.stringify(linaBirth)}, expected non-null`);
    const emmaBirth = await rosterField(t.coach, EMMA_T01, 'birth_date');
    if (emmaBirth === null) ok('...coach sieht birth_date eines FREMD-Team-Kindes NICHT (Emma, t-01)');
    else fail('coach roster contact (0054, fremdes Team)', `Emma birth_date=${JSON.stringify(emmaBirth)}, expected null`);
  }
}

// ============================================================================
// Das SELBST-PROFIL (0045) durch die echte HTTP-Schicht.
//
// Der Befund des Nutzers war: "wenn das mitglied was ueber sich eintraegt, dann
// das auch — jetzt aktuell geht garnicht". Es gab die Spalten nicht. Hier faehrt
// der ganze Weg: schreiben, im Roster wiederfinden, und die drei Grenzen, an
// denen es NICHT geht.
//
// Die scharfe Zusage, die dieser Block bewacht:
//   Das Selbst-Profil ist das EINZIGE, was ein Mitglied ueber ein anderes
//   Mitglied erfaehrt, das ueber Name/Foto/Rolle hinausgeht — und es steht dort
//   NUR, weil die Person es selbst hingeschrieben hat.
// ============================================================================
{
  console.log('\n[smoke] --- Selbst-Profil: die Person schreibt, der Verein liest ---');
  const KATRIN_M = 'a0000000-0000-4000-8000-000000000009';
  const prof = (as, memberId, body) =>
    call('PATCH', `/clubs/${CLUB}/members/${memberId}/profile`, { as, body });
  const rosterOf = async (as, memberId, field) => {
    const r = await call('GET', `/clubs/${CLUB}/members`, { as });
    return (r.json ?? []).find((m) => m.id === memberId)?.[field];
  };

  // 1. Die eigene Person.
  const own = await prof(t.parent, KATRIN_M, {
    motto: 'Immer mit Schwung', favorite_discipline: 'Solotanz', skating_since: 2005,
  });
  assertEq('Katrin pflegt ihr eigenes Profil -> 200', own.status, 200);
  assertEq('...das Motto steht in der Antwort', own.json?.profile_motto, 'Immer mit Schwung');
  assertEq('...die Jahreszahl auch', own.json?.profile_skating_since, 2005);

  // 2. DAS KIND OHNE KONTO — der Fall, fuer den das Feature gebaut ist.
  assertEq('die Mutter pflegt das Profil ihres KINDES (Lina) -> 200',
    (await prof(t.parent, MEMBER.linaChildOfParent, { motto: 'Ich uebe den Flip' })).status, 200);

  // 3. DIE GRENZEN.
  assertEq('Katrin schreibt NICHT am fremden Kind (Sofia) -> 403',
    (await prof(t.parent, MEMBER.sofiaNotHerChild, { motto: 'gekapert' })).status, 403);
  // Der ADMIN darf die Zeile verwalten — die STIMME des Kindes ist trotzdem nicht seine.
  assertEq('der ADMIN legt dem Kind KEIN Motto in den Mund -> 403',
    (await prof(t.admin, MEMBER.linaChildOfParent, { motto: 'Ich liebe Rollkunstlauf!!' })).status, 403);
  // Die Leitplanke: eine hineinkopierte Telefonnummer wird abgewiesen (CHECK -> 422).
  assertEq('eine Telefonnummer im Motto eines Kindes -> 422',
    (await prof(t.parent, MEMBER.linaChildOfParent, { motto: 'ruf mich an 01761234567' })).status, 422);
  assertEq('eine E-Mail im Motto eines Kindes -> 422',
    (await prof(t.parent, MEMBER.linaChildOfParent, { motto: 'schreib mir lina@example.org' })).status, 422);

  // 4. DIE BESTELLUNG: andere Mitglieder sehen es. Geprueft als guest_coach —
  //    die vereinsfremdeste Person mit Zugang, die es ueberhaupt gibt.
  assertEq('ein anderes Mitglied (coach) liest Katrins Motto im Roster',
    await rosterOf(t.coach, KATRIN_M, 'profile_motto'), 'Immer mit Schwung');
  assertEq('auch die Gast-Trainerin liest Linas Motto (freiwillig veroeffentlicht)',
    await rosterOf(t.guest, MEMBER.linaChildOfParent, 'profile_motto'), 'Ich uebe den Flip');

  // 5. Und die Redigierung ringsum steht weiter: das Selbst-Profil ist sichtbar,
  //    die KONTAKTdaten desselben Kindes sind es NICHT — geprueft an der Gast-
  //    Trainerin. Sie sieht das Motto (0045, freiwillig veroeffentlicht), ist aber
  //    vom Kontakt-Zugang (0054/maySeeContactOf) BEWUSST ausgeschlossen (guest_coach
  //    = vereinsextern auf Zeit). So bleibt bewiesen, dass das Selbst-Profil keine
  //    Kontaktspalte mit aufgerissen hat. (Der TEAM-coach SIEHT den Kontakt jetzt —
  //    das ist 0054 und wird oben zeilenweise geprueft; er taugt hier nicht mehr.)
  assertEq('...waehrend birth_date desselben Kindes fuer die Gast-Trainerin redigiert bleibt',
    await rosterOf(t.guest, MEMBER.linaChildOfParent, 'birth_date'), null);
  assertEq('...und die E-Mail von Katrin ebenso',
    await rosterOf(t.guest, KATRIN_M, 'email'), null);

  // 6. Moderation: leeren darf der Vorstand (nur schreiben nicht).
  const cleared = await call('PATCH', `/clubs/${CLUB}/members/${MEMBER.linaChildOfParent}`,
    { as: t.admin, body: { first_name: 'Lina' } });
  assertEq('der ADMIN pflegt weiter normale Stammdaten -> 200', cleared.status, 200);
}

// ============================================================================
// DAS 360-GRAD-PROFIL (routes/member-profile.ts) durch die echte HTTP-Schicht.
//
//   GET /clubs/{clubId}/members/{memberId}/profile
//
// Die scharfe Zusage: JEDE Sektion ist SERVERSEITIG rollen-gestaffelt, und "darf
// ich nicht" (null) ist von "leer" ([]) UNTERSCHIEDEN. Geprueft an Lina (a-07,
// Kind, Team t-02) aus fuenf Blickwinkeln, die je einen anderen Gate-Zweig treffen:
//   owner        — privilegiert: sieht ALLES.
//   treasurer    — Finanz/Verwaltung: Finanzen JA, aber Kueren NULL (kein
//                  routine-Leser -> beweist null != []).
//   coach Sandra — betreut Linas Team t-02: Kontakt JA (0054), Beurteilung JA
//                  (coaches_member), Kueren JA — aber Finanzen/Konsent NULL.
//   guest Milena — betreut t-03, NICHT Linas Team: Kontakt NEIN, Beurteilung
//                  NULL — ABER die Galerie-Fotos JA, weil die Anzeige AN DER
//                  EINWILLIGUNG haengt, nicht an der Rolle (0056).
//   parent Katrin— Vormund von Lina: Kontakt/Selbst-Profil/Finanzen/Beurteilung/
//                  Konsent JA (Familie), aber die Verwaltungs-Kontaktfelder NEIN.
// ============================================================================
{
  console.log('\n[smoke] --- 360-Grad-Profil: eine Person, jede Sektion gestaffelt ---');
  const LINA = MEMBER.linaChildOfParent;
  const prof = (as) => call('GET', `/clubs/${CLUB}/members/${LINA}/profile`, { as });
  const isNull = (v) => v === null || v === undefined;
  const notNull = (label, v) => { if (!isNull(v)) ok(label); else fail(label, `expected present, got ${JSON.stringify(v)}`); };
  const mustNull = (label, v) => { if (isNull(v)) ok(label); else fail(label, `expected null (darf ich nicht), got a value`); };

  // owner — sieht alles.
  const po = await prof(t.owner);
  assertEq('owner: Profil -> 200', po.status, 200);
  assertEq('owner: Stammkopf traegt die Person', po.json?.member?.id, LINA);
  assertEq('owner: contact_visible', po.json?.contact_visible, true);
  assertEq('owner: admin_contact_visible', po.json?.admin_contact_visible, true);
  assertEq('owner: self_profile_visible', po.json?.self_profile_visible, true);
  notNull('owner: Finanzen sichtbar (Objekt)', po.json?.finance);
  notNull('owner: Beurteilungen sichtbar', po.json?.assessments);
  notNull('owner: Konsent-Uebersicht sichtbar', po.json?.consents);
  notNull('owner: Kueren sichtbar', po.json?.routines);
  notNull('owner: Galerie-Fotos sichtbar', po.json?.photos);

  // treasurer — Finanzen JA, Kueren NULL (der scharfe null-vs-leer-Beweis).
  const pt = await prof(t.treasurer);
  assertEq('treasurer: Profil -> 200', pt.status, 200);
  notNull('treasurer: Finanzen sichtbar (Kasse)', pt.json?.finance);
  mustNull('treasurer: Kueren NICHT sichtbar -> null, nicht [] (kein routine-Leser)', pt.json?.routines);

  // coach Sandra (betreut t-02) — Kontakt+Beurteilung+Kueren JA, Finanzen/Konsent NULL.
  const pc = await prof(t.coach);
  assertEq('coach: Profil -> 200', pc.status, 200);
  assertEq('coach: contact_visible (0054, eigenes Team)', pc.json?.contact_visible, true);
  assertEq('coach: admin_contact_visible NEIN (nur privilegiert)', pc.json?.admin_contact_visible, false);
  notNull('coach: Beurteilungen sichtbar (coaches_member)', pc.json?.assessments);
  notNull('coach: Kueren sichtbar (Team-Trainer)', pc.json?.routines);
  mustNull('coach: Finanzen NICHT sichtbar -> null', pc.json?.finance);
  mustNull('coach: Konsent-Uebersicht NICHT sichtbar -> null', pc.json?.consents);

  // guest_coach Milena (betreut t-03, NICHT Linas Team) — Kontakt/Beurteilung NEIN,
  // ABER Galerie-Fotos JA (Anzeige haengt an der Einwilligung, nicht an der Rolle).
  const pg = await prof(t.guest);
  assertEq('guest_coach: Profil -> 200', pg.status, 200);
  assertEq('guest_coach: contact_visible NEIN (fremdes Team, vereinsextern)', pg.json?.contact_visible, false);
  mustNull('guest_coach: Beurteilungen NICHT sichtbar -> null', pg.json?.assessments);
  mustNull('guest_coach: Kueren NICHT sichtbar -> null (fremdes Team)', pg.json?.routines);
  notNull('guest_coach: Galerie-Fotos SICHTBAR — Einwilligung, nicht Rolle (0056)', pg.json?.photos);
  if (Array.isArray(pg.json?.photos) && pg.json.photos.length >= 1) ok('guest_coach: das eingewilligte Foto ist wirklich da (>=1)');
  else fail('guest_coach: eingewilligtes Foto', `photos=${JSON.stringify(pg.json?.photos)}`);

  // parent Katrin (Vormund von Lina) — Familie sieht viel, aber keine Verwaltungsfelder.
  const pp = await prof(t.parent);
  assertEq('parent: Profil -> 200', pp.status, 200);
  assertEq('parent: contact_visible (Vormund)', pp.json?.contact_visible, true);
  assertEq('parent: admin_contact_visible NEIN (nur privilegiert)', pp.json?.admin_contact_visible, false);
  assertEq('parent: self_profile_visible (Vormund)', pp.json?.self_profile_visible, true);
  notNull('parent: Finanzen sichtbar (eigenes Kind, 0002-Privacy)', pp.json?.finance);
  notNull('parent: Beurteilungen sichtbar (Familie)', pp.json?.assessments);
  notNull('parent: Konsent-Uebersicht sichtbar (Familie)', pp.json?.consents);

  // Mandantenschnitt: die fremde Person (anderer Verein) bekommt hier nichts.
  assertEq('fremder Verein: kein Zugriff auf dieses Profil -> 403',
    (await prof(t.foreign)).status, 403);
}

// ============================================================================
// RBAC Phase 2 Schritt 6 — die Rollen-Admin-Endpoints (routes/roles.ts).
//
// Der KERNBEWEIS von Phase 2 steht hier: eine Zweitrolle wirkt SOFORT durch die
// API — an derselben Stelle, die vorher 403 gab, ohne dass die Person einen
// neuen Token holt. Genau das konnte der claim-basierte Guard nie.
// ============================================================================
{
  console.log('\n[smoke] --- Rollen-Admin + Mehrfachrollen (RBAC Phase 2) ---');

  assertEq('jedes Mitglied liest den Faehigkeiten-Katalog -> 200',
    (await call('GET', '/capabilities', { as: t.parent })).status, 200);

  const rolesRes = await call('GET', `/clubs/${CLUB}/roles`, { as: t.owner });
  assertEq('owner liest die Rollen -> 200', rolesRes.status, 200);
  assertEq('...7 Systemrollen', rolesRes.json?.filter((r) => r.is_system).length, 7);
  const roleByKey = Object.fromEntries((rolesRes.json ?? []).map((r) => [r.key, r]));

  // --- Rechte: wer darf hier ueberhaupt schreiben? --------------------------
  assertEq('treasurer legt KEINE Rolle an (roles=none) -> 403',
    (await call('POST', `/clubs/${CLUB}/roles`, {
      as: t.treasurer, body: { key: 'darf_nicht', name_de: 'Darf nicht', name_en: 'Must not' },
    })).status, 403);
  assertEq('coach legt KEINE Rolle an -> 403',
    (await call('POST', `/clubs/${CLUB}/roles`, {
      as: t.coach, body: { key: 'darf_auch_nicht', name_de: 'Nein', name_en: 'No' },
    })).status, 403);

  // --- Systemrollen + owner-Matrix sind geschuetzt --------------------------
  assertEq('Systemrolle loeschen -> 409 (nicht 500)',
    (await call('DELETE', `/clubs/${CLUB}/roles/${roleByKey.coach?.id}`, { as: t.owner })).status, 409);
  assertEq('owner-Matrix aendern -> 409 (protected)',
    (await call('PUT', `/clubs/${CLUB}/roles/${roleByKey.owner?.id}/permissions`, {
      as: t.owner, body: { permissions: [{ capability_key: 'finance', level: 'none' }] },
    })).status, 409);
  assertEq('Stufe ausserhalb allowed_levels -> 422',
    (await call('PUT', `/clubs/${CLUB}/roles/${roleByKey.member?.id}/permissions`, {
      as: t.owner, body: { permissions: [{ capability_key: 'routines_edit', level: 'read_team' }] },
    })).status, 422);

  // --- Eigene Rolle: anlegen, Rechte geben, loeschen ------------------------
  const created = await call('POST', `/clubs/${CLUB}/roles`, {
    as: t.owner, body: { key: 'kuerwart', name_de: 'Kürwart:in', name_en: 'Routine warden' },
  });
  assertEq('owner legt eine eigene Rolle an -> 201', created.status, 201);
  assertEq('...is_system erzwungen false', created.json?.is_system, false);
  assertEq('...protected erzwungen false', created.json?.protected, false);
  assertEq('...derselbe Schluessel nochmal -> 409',
    (await call('POST', `/clubs/${CLUB}/roles`, {
      as: t.owner, body: { key: 'kuerwart', name_de: 'X', name_en: 'X' },
    })).status, 409);

  const customId = created.json?.id;
  const perms = await call('PUT', `/clubs/${CLUB}/roles/${customId}/permissions`, {
    as: t.owner, body: { permissions: [{ capability_key: 'routines_edit', level: 'edit' }] },
  });
  assertEq('owner setzt die Matrix der eigenen Rolle -> 200', perms.status, 200);

  // ==========================================================================
  // DER KERNBEWEIS: Mehrfachrollen wirken SOFORT durch die API.
  // Katrin (member) darf keine Anwesenheit erfassen — das ist eine Coach-Sache
  // (weiter oben schon als 403 belegt). Sie bekommt die Rolle coach DAZU (ihre
  // Primaerrolle bleibt member, ihr TOKEN BLEIBT DERSELBE) und darf es danach.
  // Genau das konnte der claim-basierte Guard nie: im Token steht "member".
  // ==========================================================================
  const KATRIN = 'a0000000-0000-4000-8000-000000000009';
  const recordAttendance = (as) =>
    call('PUT', `/events/${someEvent.id}/attendance`, {
      as, body: { member_id: MEMBER.linaChildOfParent, status: 'present' },
    });
  const capRank = async (as, key) =>
    rankOfCapability((await call('GET', `/me/capabilities?club_id=${CLUB}`, { as })).json, key);

  assertEq('VORHER: Katrin (nur member) erfasst KEINE Anwesenheit -> 403',
    (await recordAttendance(t.parent)).status, 403);
  // 0045: Ausgangslage ist jetzt read_own (1) statt read_all (3) — der Nutzer
  // hat die Stufe fuer 'member' gekappt ("trainer und hoeher ... aber rest
  // nicht"), und seit 0045 steuert sie auch das LESEN. Die Zusage dieses Blocks
  // bleibt woertlich dieselbe: die Zweitrolle wirkt SOFORT, ohne neuen Token.
  assertEq('...ihr attendance-Rang ist read_own (1, seit 0045), nicht edit',
    await capRank(t.parent, 'attendance'), 1);

  const assign = await call('PUT', `/clubs/${CLUB}/members/${KATRIN}/roles`, {
    as: t.owner, body: { role_ids: [roleByKey.member?.id, roleByKey.coach?.id] },
  });
  assertEq('owner gibt Katrin die Zweitrolle coach -> 200', assign.status, 200);
  assertEq('...sie haelt jetzt ZWEI Rollen', assign.json?.length, 2);

  // DERSELBE Token wie oben - t.parent wurde nicht neu erzeugt.
  const afterCaps = (await call('GET', `/me/capabilities?club_id=${CLUB}`, { as: t.parent })).json;
  assertEq('NACHHER: ihr attendance-Rang steigt auf edit (4) — ohne neuen Token',
    rankOfCapability(afterCaps, 'attendance'), 4);
  assertEq('...role_keys zeigt BEIDE Rollen (der Claim kennt nur eine)',
    JSON.stringify([...(afterCaps?.role_keys ?? [])].sort()), '["coach","member"]');
  // Und jetzt wirkt es auch DURCH die API — der Guard fragt seit Schritt 7 die
  // Datenbank statt den Claim. Im Token steht unveraendert "member".
  assertEq('NACHHER: dieselbe Anfrage, derselbe Token -> jetzt 200',
    (await recordAttendance(t.parent)).status, 200);

  // Gegenprobe: die Zweitrolle gibt NICHT alles. coach hat roles=none.
  assertEq('Gegenprobe: sie darf trotzdem KEINE Rollen anlegen -> 403',
    (await call('POST', `/clubs/${CLUB}/roles`, {
      as: t.parent, body: { key: 'immer_noch_nicht', name_de: 'Nein', name_en: 'No' },
    })).status, 403);

  // Und zurueck: Rolle entziehen -> das Recht ist sofort wieder weg.
  assertEq('owner entzieht die Zweitrolle wieder -> 200',
    (await call('PUT', `/clubs/${CLUB}/members/${KATRIN}/roles`, {
      as: t.owner, body: { role_ids: [roleByKey.member?.id] },
    })).status, 200);
  assertEq('...und Katrin erfasst SOFORT keine Anwesenheit mehr -> 403',
    (await recordAttendance(t.parent)).status, 403);

  // --- Rolle loeschen: erst zugewiesen (409), dann frei (204) ---------------
  await call('PUT', `/clubs/${CLUB}/members/${KATRIN}/roles`, {
    as: t.owner, body: { role_ids: [roleByKey.member?.id, customId] },
  });
  assertEq('zugewiesene Rolle loeschen -> 409 (FK RESTRICT, nicht 500)',
    (await call('DELETE', `/clubs/${CLUB}/roles/${customId}`, { as: t.owner })).status, 409);
  await call('PUT', `/clubs/${CLUB}/members/${KATRIN}/roles`, {
    as: t.owner, body: { role_ids: [roleByKey.member?.id] },
  });
  assertEq('nach dem Entziehen loeschbar -> 200 (Deleted-Huelle, Hauskonvention)',
    (await call('DELETE', `/clubs/${CLUB}/roles/${customId}`, { as: t.owner })).status, 200);

  // --- Trainer-Teams (§1.4) -------------------------------------------------
  // Team b-03 "Kuergruppe Leistung": 6 Skater + 2 Trainerinnen (Sandra a0..01,
  // Milena a0..06). Hanna Foerster (a0..23) ist dort SKATERIN.
  const TEAM_B3 = 'b0000000-0000-4000-8000-000000000003';
  const SANDRA = 'a0000000-0000-4000-8000-000000000001';
  const MILENA = 'a0000000-0000-4000-8000-000000000006';
  const HANNA_SKATER = 'a0000000-0000-4000-8000-000000000023';
  const setCoaches = (as, ids) =>
    call('PUT', `/clubs/${CLUB}/teams/${TEAM_B3}/coaches`, { as, body: { member_ids: ids } });

  assertEq('treasurer setzt KEINE Trainer (teams=none) -> 403',
    (await setCoaches(t.treasurer, [SANDRA])).status, 403);
  // Die Falle: on-conflict-do-update haette Hanna STILL aus dem Skater-Roster
  // gekippt (team_members_uq ist (team_id, member_id) OHNE role).
  assertEq('Skaterin als Trainerin setzen -> 409 (statt sie still aus dem Roster zu kippen)',
    (await setCoaches(t.owner, [SANDRA, MILENA, HANNA_SKATER])).status, 409);

  const coaches = await setCoaches(t.owner, [SANDRA]);
  assertEq('owner setzt die Trainerinnen des Teams -> 200', coaches.status, 200);
  assertEq('...Milena wurde entfernt, Sandra bleibt', JSON.stringify(coaches.json), JSON.stringify([SANDRA]));
  // Wieder-Hinzufuegen einer soft-geloeschten Zeile: der Unique-Index filtert
  // deleted_at NICHT -> ein blindes INSERT liefe auf 23505.
  const readd = await setCoaches(t.owner, [SANDRA, MILENA]);
  assertEq('soft-geloeschte Trainerin wieder hinzufuegen -> 200 (kein 23505)', readd.status, 200);
  assertEq('...beide wieder da', readd.json?.length, 2);
}

// ============================================================================
// Vereinslogo (0060) — Upload nur owner/admin, oeffentliche Serve-Route.
// ============================================================================
{
  const owner = await token(SUB.owner, 'owner');
  const member = await token(SUB.parent, 'member');

  // Ein winziges gueltiges PNG (1x1) als multipart-Datei.
  const PNG_1x1 = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);
  const uploadLogo = async (as) => {
    const form = new FormData();
    form.append('file', new Blob([PNG_1x1], { type: 'image/png' }), 'logo.png');
    const res = await fetch(`${BASE}/clubs/${CLUB}/logo`, {
      method: 'POST',
      headers: as ? { authorization: `Bearer ${as}` } : {},
      body: form,
    });
    let json;
    try { json = await res.json(); } catch { json = undefined; }
    return { status: res.status, json };
  };

  // Ein normales Mitglied darf KEIN Logo setzen (Vereins-Stammdaten = owner/admin).
  assertEq('logo: ein normales Mitglied kann KEIN Logo hochladen -> 403',
    (await uploadLogo(member)).status, 403);

  // Der Inhaber laedt hoch -> 200, logo_asset_id gesetzt.
  const up = await uploadLogo(owner);
  assertEq('logo: der Inhaber laedt ein Logo hoch -> 200', up.status, 200);
  if (typeof up.json?.logo_asset_id === 'string' && up.json.logo_asset_id.length > 0) {
    ok('logo: die Antwort traegt eine logo_asset_id (serverseitig erzeugt)');
  } else {
    fail('logo: die Antwort traegt eine logo_asset_id', JSON.stringify(up.json));
  }

  // Jedes Mitglied sieht am Verein, dass ein Logo existiert.
  const clubAsMember = await call('GET', `/clubs/${CLUB}`, { as: member });
  if (clubAsMember.json?.logo_asset_id) ok('logo: das Mitglied sieht logo_asset_id am Verein (statt Initialen)');
  else fail('logo: das Mitglied sieht logo_asset_id am Verein', JSON.stringify(clubAsMember.json));

  // Die Serve-Route ist OEFFENTLICH (kein Token) und liefert die Bytes.
  const publicLogo = await fetch(`${BASE}/public/clubs/${CLUB}/logo`);
  assertEq('logo: GET /public/clubs/{id}/logo ist oeffentlich abrufbar -> 200', publicLogo.status, 200);
  assertEq('logo: ...mit content-type image/png',
    publicLogo.headers.get('content-type'), 'image/png');

  // Entfernen (owner) -> logo_asset_id wieder null (schoener Normalfall = Initialen).
  const del = await call('DELETE', `/clubs/${CLUB}/logo`, { as: owner });
  assertEq('logo: der Inhaber entfernt das Logo -> 200', del.status, 200);
  assertEq('logo: ...logo_asset_id ist wieder null (Normalfall: Initialen)', del.json?.logo_asset_id, null);
  assertEq('logo: ...danach liefert die oeffentliche Route 404',
    (await fetch(`${BASE}/public/clubs/${CLUB}/logo`)).status, 404);
}

// ============================================================================
// Finanz-Modul abschaltbar (0061) — AUS = per API nichts Finanzielles mehr,
// die DATEN bleiben, wieder EIN = alles zurueck. members/manage bleiben Kern.
// ============================================================================
{
  const owner = await token(SUB.owner, 'owner');
  const admin = await token(SUB.admin, 'admin');
  const setFinance = (as, enabled) =>
    call('PUT', `/clubs/${CLUB}/modules/finance`, { as, body: { enabled } });
  const invoicesLen = async (as) => (await call('GET', `/invoices?club_id=${CLUB}`, { as })).json?.length;
  const feesLen = async (as) => (await call('GET', `/member-fees?club_id=${CLUB}`, { as })).json?.length;
  const openCount = async (as) =>
    (await call('GET', `/reports/summary?club_id=${CLUB}`, { as })).json?.open_invoices_count;
  const financeSection = async (as) =>
    (await call('GET', `/clubs/${CLUB}/members/${MEMBER.owner}/profile`, { as })).json?.finance;

  // --- AN (Ausgangslage) --- Baseline dynamisch: fruehere Smoke-Abschnitte
  // koennen Rechnungen angelegt haben; entscheidend ist AUS=0 und danach zurueck.
  const baseInvoices = await invoicesLen(admin);
  const baseFees = await feesLen(admin);
  if (baseInvoices > 0) ok(`finance AN: admin sieht Rechnungen (API, ${baseInvoices})`);
  else fail('finance AN: admin sieht Rechnungen (API)', String(baseInvoices));
  if (baseFees > 0) ok(`finance AN: admin sieht Beitraege (API, ${baseFees})`);
  else fail('finance AN: admin sieht Beitraege (API)', String(baseFees));
  if ((await openCount(admin)) > 0) ok('finance AN: reports/summary meldet offene Rechnungen (>0)');
  else fail('finance AN: reports/summary meldet offene Rechnungen (>0)', String(await openCount(admin)));
  if ((await financeSection(owner)) !== null && (await financeSection(owner)) !== undefined)
    ok('finance AN: das 360-Profil enthaelt die Finanz-Sektion');
  else fail('finance AN: das 360-Profil enthaelt die Finanz-Sektion', 'null');

  // --- Abschalten (owner) ---
  const off = await setFinance(owner, false);
  assertEq('finance: der Inhaber schaltet finance AUS -> 200 (kein Kernmodul mehr)', off.status, 200);
  assertEq('finance: ...der Server meldet enabled=false', off.json?.enabled, false);

  assertEq('finance AUS: GET /invoices liefert 0 (RLS-Gate, nicht nur die Kachel)', await invoicesLen(admin), 0);
  assertEq('finance AUS: GET /member-fees liefert 0', await feesLen(admin), 0);
  assertEq('finance AUS: reports/summary open_invoices_count = 0 (Service-Mode-Check)', await openCount(admin), 0);
  assertEq('finance AUS: reports/annual -> 403 (rein finanziell, Modul aus)',
    (await call('GET', `/reports/annual?club_id=${CLUB}&year=2025`, { as: admin })).status, 403);
  assertEq('finance AUS: das 360-Profil hat KEINE Finanz-Sektion (null)', await financeSection(owner), null);
  // Schreiben ueber den Service-Mode-Pfad (Rechnung anlegen) ist ebenfalls dicht.
  assertEq('finance AUS: POST /invoices -> 403 (Service-Mode-Modulcheck)',
    (await call('POST', '/invoices', {
      as: admin,
      body: { club_id: CLUB, member_id: MEMBER.owner, title: 'Trotzdem', amount_cents: 100 },
    })).status, 403);

  // --- Wieder EIN -> alles zurueck (die Daten waren nie weg) ---
  assertEq('finance: der Inhaber schaltet finance wieder EIN -> 200',
    (await setFinance(owner, true)).status, 200);
  assertEq('finance wieder AN: die Rechnungen sind zurueck (Daten blieben in der DB)', await invoicesLen(admin), baseInvoices);

  // --- members/manage bleiben Kern: 409, nicht abschaltbar ---
  assertEq('finance: "members" bleibt Kern -> 409 (nicht abschaltbar)',
    (await call('PUT', `/clubs/${CLUB}/modules/members`, { as: owner, body: { enabled: false } })).status, 409);
  assertEq('finance: "manage" bleibt Kern -> 409 (nicht abschaltbar)',
    (await call('PUT', `/clubs/${CLUB}/modules/manage`, { as: owner, body: { enabled: false } })).status, 409);
}

// ===========================================================================
// Fahrgemeinschaften (0066) — ueber HTTP, nicht ueber SQL.
//
// Die SQL-Suite (99n) beweist die Policies. Hier geht es um die Frage, ob die
// ROUTE dieselbe Antwort gibt: liefert sie die Rueckrufnummer wirklich nur an
// Beteiligte, weist sie Minderjaehrige und Fremde ab, und scheitert eine
// Ueberbuchung mit einer verstaendlichen Meldung statt mit einem 500er?
// ===========================================================================
{
  console.log('\n[smoke] Fahrgemeinschaften (0066)');
  const parent = await token(SUB.parent, 'member');      // Katrin, Fahrerin von fa-01
  const coach = await token(SUB.coach, 'coach');         // Sandra, unbeteiligt
  const moderator = await token(SUB.moderator, 'moderator');

  const EVENT_WETTKAMPF = 'e0000000-0000-4000-8000-000000000012';
  const RIDE_KATRIN = 'fa000000-0000-4000-8000-000000000001';
  const RIDE_VOLL = 'fa000000-0000-4000-8000-000000000002';

  const list = await call('GET', `/events/${EVENT_WETTKAMPF}/rides`, { as: parent });
  assertEq('rides: die Mutter sieht beide Fahrten zum Wettkampf', list.json?.length, 2);

  const katrinRide = list.json?.find((r) => r.id === RIDE_KATRIN);
  assertEq('rides: die eigene Fahrt zeigt die Rueckrufnummer', typeof katrinRide?.rueckrufnummer, 'string');
  assertEq('rides: ...und meldet kontakt_sichtbar=true', katrinRide?.kontakt_sichtbar, true);
  assertEq('rides: die Mitfahrer stehen dran (2 Zusagen)', katrinRide?.riders?.length, 2);
  assertEq('rides: plaetze_frei ist ausgerechnet (3 - 2)', katrinRide?.plaetze_frei, 1);

  // DER KERN: der unbeteiligte Trainer sieht die Fahrten, aber KEINE Nummer.
  const coachList = await call('GET', `/events/${EVENT_WETTKAMPF}/rides`, { as: coach });
  assertEq('rides: der unbeteiligte coach sieht die Fahrten', coachList.json?.length, 2);
  assertEq('rides: ...aber KEINE Rueckrufnummer (null, serverseitig)',
    coachList.json?.every((r) => r.rueckrufnummer === null), true);
  assertEq('rides: ...und kontakt_sichtbar=false sagt ihm ehrlich warum',
    coachList.json?.every((r) => r.kontakt_sichtbar === false), true);

  // Die Verwaltung darf mitlesen (Aufsichtspflicht, ausdrueckliche Vorgabe).
  const modList = await call('GET', `/events/${EVENT_WETTKAMPF}/rides`, { as: moderator });
  assertEq('rides: die Verwaltung sieht alle Nummern (Aufsichtspflicht)',
    modList.json?.every((r) => typeof r.rueckrufnummer === 'string'), true);

  // Fahrt anbieten — Erwachsene.
  const offer = await call('POST', `/events/${EVENT_WETTKAMPF}/rides`, {
    as: parent,
    body: {
      abfahrtsort: 'Netto-Parkplatz Neckarsulm',
      abfahrtszeit: new Date(Date.now() + 9 * 864e5).toISOString(),
      plaetze_gesamt: 2,
      rueckrufnummer: '+49 151 00000001',
    },
  });
  assertEq('rides: Erwachsene darf eine Fahrt anbieten -> 201', offer.status, 201);
  assertEq('rides: ...die neue Fahrt ist offen', offer.json?.status, 'offen');
  assertEq('rides: ...mit 2 freien Plaetzen', offer.json?.plaetze_frei, 2);

  // Ein fremdes Kind eintragen -> 403 (RLS, nicht UI).
  const fremd = await call('POST', `/rides/${offer.json?.id}/riders`, {
    as: parent,
    body: { member_id: MEMBER.sofiaNotHerChild },
  });
  assertEq('rides: fremdes Kind eintragen -> 403', fremd.status, 403);

  // Das EIGENE Kind eintragen -> 201.
  const eigenes = await call('POST', `/rides/${offer.json?.id}/riders`, {
    as: parent,
    body: { member_id: MEMBER.linaChildOfParent },
  });
  assertEq('rides: das eigene Kind eintragen -> 201', eigenes.status, 201);
  assertEq('rides: ...ein Platz weniger frei', eigenes.json?.plaetze_frei, 1);

  // Ueberbuchung: die volle Fahrt fa-02 nimmt niemanden mehr auf -> 422 Klartext.
  // Bewusst mit EMMA (a-08, Katrins zweitem Kind): Lina sitzt in fa-02 bereits
  // drin, ihre erneute Zusage waere eine gueltige Bestaetigung (201) und kaeme
  // nie beim Platz-Zaehler an — der Test bewiese dann nichts.
  const EMMA_CHILD_OF_PARENT = 'a0000000-0000-4000-8000-000000000008';
  const voll = await call('POST', `/rides/${RIDE_VOLL}/riders`, {
    as: parent,
    body: { member_id: EMMA_CHILD_OF_PARENT },
  });
  assertEq('rides: Zusage zur VOLLEN Fahrt -> 422 (kein 500)', voll.status, 422);
  if (typeof voll.json?.detail === 'string' && voll.json.detail.includes('voll'))
    ok('rides: ...mit verstaendlichem Klartext ("... ist voll ...")');
  else fail('rides: ...mit verstaendlichem Klartext', JSON.stringify(voll.json?.detail));

  // Zusage zurueckziehen -> der Platz wird frei.
  const riderId = eigenes.json?.riders?.find((r) => r.member_id === MEMBER.linaChildOfParent)?.id;
  const zurueck = await call('PATCH', `/rides/${offer.json?.id}/riders/${riderId}`, {
    as: parent,
    body: { status: 'abgesagt' },
  });
  assertEq('rides: Zusage zurueckziehen -> 200', zurueck.status, 200);
  assertEq('rides: ...der Platz ist wieder frei', zurueck.json?.plaetze_frei, 2);

  // Fahrt absagen.
  const absage = await call('PATCH', `/rides/${offer.json?.id}`, {
    as: parent,
    body: { status: 'abgesagt' },
  });
  assertEq('rides: eigene Fahrt absagen -> 200', absage.status, 200);
  assertEq('rides: ...status=abgesagt', absage.json?.status, 'abgesagt');

  // Eine FREMDE Fahrt bearbeiten darf sie nicht (RLS filtert -> 403).
  const fremdeFahrt = await call('PATCH', `/rides/${RIDE_VOLL}`, {
    as: parent,
    body: { abfahrtsort: 'Woanders' },
  });
  assertEq('rides: fremde Fahrt bearbeiten -> 403', fremdeFahrt.status, 403);
}

console.log('');
if (failures > 0) {
  console.error(`[smoke] ${failures} assertion(s) FAILED`);
  process.exit(1);
}
console.log('[smoke] ALL SMOKE CHECKS PASSED');
