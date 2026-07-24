-- ============================================================================
-- 98_modules_batch4.sql — test class (k): modules batch 4 (migration 0011).
--
--   * chat_messages
--       team channel   — read = team member OR club trainer; write = team
--                        member only (a club trainer who is NOT in the team may
--                        READ but not POST). Sender is always the caller's own
--                        member row (spoofing the sender -> 42501).
--       direct message — read/write = sender & recipient only; a third party
--                        (even a club trainer) sees NOTHING.
--   * checkins — read/insert = own (self-checkin) OR trainer; a member may NOT
--       record for someone else; soft-delete = trainer only.
--   * regional_events — read = every member; write = trainer only.
--
-- Seed baseline for club A (seed.sql): chat = 5 team (b-03) + 3 direct
-- (a-01 <-> a-09); checkins = 4 (a-09 owns exactly 1); regional_events = 3.
-- Personas: coach Sandra 90..01/a-01 (team member of b-03), member Katrin
-- 90..09/a-09 (NOT in b-03, is a DM party), admin Thomas 90..04/a-04 (trainer,
-- NOT in b-03, NOT a DM party), treasurer Beate 90..03/a-03 (non-trainer),
-- platform admin 90..90.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- COACH Sandra (90..01 / a-01) — team member of b-03 AND a DM party.
-- Reads + writes the team channel; sees the whole club's check-ins; trainer.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  -- team channel b-03: 5 seeded messages, visible to the team member
  perform testkit.is_eq('chat: coach reads the 5 team messages of b-03',
    (select count(*) from app.chat_messages
      where channel_type = 'team' and team_id = 'b0000000-0000-4000-8000-000000000003'), 5);
  -- direct thread a-01 <-> a-09: she is a party -> sees all 3
  perform testkit.is_eq('chat: coach (a-01) sees her 3 direct messages',
    (select count(*) from app.chat_messages where channel_type = 'direct'), 3);

  -- she MAY post to her team channel
  perform testkit.succeeds('chat: coach MAY post to her team channel (b-03)',
    $q$insert into app.chat_messages (club_id, channel_type, team_id, sender_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001', 'team',
               'b0000000-0000-4000-8000-000000000003',
               'a0000000-0000-4000-8000-000000000001', 'Aufwärmen nicht vergessen')$q$);

  -- checkins: trainer sees ALL 4
  perform testkit.is_eq('checkins: coach (trainer) sees all 4', (select count(*) from app.checkins), 4);
  -- trainer MAY check ANOTHER member in (a-16)
  perform testkit.succeeds('checkins: coach MAY check another member in',
    $q$insert into app.checkins (club_id, member_id, method)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000016', 'manual')$q$);
  -- trainer MAY soft-delete a check-in (a-09's ck-01)
  perform testkit.affects('checkins: coach MAY soft-delete a check-in (1 row)',
    $q$update app.checkins set deleted_at = now()
        where id = 'c4ec0000-0000-4000-8000-000000000001'$q$, 1);

  -- regional_events: read 3, and MAY create + edit (trainer)
  perform testkit.is_eq('regional_events: coach reads the 3', (select count(*) from app.regional_events), 3);
  perform testkit.succeeds('regional_events: coach MAY create one',
    $q$insert into app.regional_events (club_id, title, starts_on)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Test-Cup', current_date + 30)$q$);
  perform testkit.affects('regional_events: coach MAY edit a seeded one (1 row)',
    $q$update app.regional_events set location = 'Neue Halle'
        where id = '4e670000-0000-4000-8000-000000000001'$q$, 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- MEMBER Katrin (90..09 / a-09) — NOT in team b-03, but a DM party. Self-
-- service check-in only; may not curate regional events.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  -- team channel of a team she is NOT a member of -> invisible (0)
  perform testkit.is_eq('chat: non-team-member sees 0 team messages of b-03',
    (select count(*) from app.chat_messages
      where channel_type = 'team' and team_id = 'b0000000-0000-4000-8000-000000000003'), 0);
  -- but her OWN direct thread is fully visible (3)
  perform testkit.is_eq('chat: DM party (a-09) sees all 3 direct messages',
    (select count(*) from app.chat_messages where channel_type = 'direct'), 3);

  -- she MAY NOT post to a team she is not part of (not a team member)
  perform testkit.throws('chat: non-team-member MAY NOT post to that team channel',
    $q$insert into app.chat_messages (club_id, channel_type, team_id, sender_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001', 'team',
               'b0000000-0000-4000-8000-000000000003',
               'a0000000-0000-4000-8000-000000000009', 'darf ich nicht')$q$, '42501');
  -- she MAY send a direct message to a club member (recipient a-01)
  perform testkit.succeeds('chat: member MAY send a direct message to a club member',
    $q$insert into app.chat_messages (club_id, channel_type, sender_member_id, recipient_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001', 'direct',
               'a0000000-0000-4000-8000-000000000009',
               'a0000000-0000-4000-8000-000000000001', 'Kurze Rückfrage')$q$);
  -- she MAY NOT spoof the sender (send AS another member a-05)
  perform testkit.throws('chat: member MAY NOT post AS another member (sender spoofing)',
    $q$insert into app.chat_messages (club_id, channel_type, sender_member_id, recipient_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001', 'direct',
               'a0000000-0000-4000-8000-000000000005',
               'a0000000-0000-4000-8000-000000000001', 'nicht ich')$q$, '42501');

  -- checkins: she sees only her OWN (ck-01 -> 1)
  perform testkit.is_eq('checkins: member sees only her own (1)', (select count(*) from app.checkins), 1);
  -- self-checkin allowed
  perform testkit.succeeds('checkins: member MAY check HERSELF in',
    $q$insert into app.checkins (club_id, member_id, method)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000009', 'qr')$q$);
  -- checking someone else in is denied
  perform testkit.throws('checkins: member MAY NOT check ANOTHER member in',
    $q$insert into app.checkins (club_id, member_id, method)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000005', 'qr')$q$, '42501');
  -- she may NOT soft-delete even her own check-in (trainer-only) -> 0 rows
  perform testkit.affects('checkins: member cannot soft-delete her own check-in (0 rows, trainer-only)',
    $q$update app.checkins set deleted_at = now()
        where id = 'c4ec0000-0000-4000-8000-000000000001'$q$, 0);

  -- regional_events: reads all 3, but MAY NOT create (not a trainer)
  perform testkit.is_eq('regional_events: member reads the 3', (select count(*) from app.regional_events), 3);
  perform testkit.throws('regional_events: member MAY NOT create one (not a trainer)',
    $q$insert into app.regional_events (club_id, title, starts_on)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Hack', current_date)$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- ADMIN Thomas (90..04 / a-04) — a club TRAINER, but NOT a member of b-03 and
-- NOT a party of the DM thread. Proves: trainer READS team channels but cannot
-- POST to a team he is not in, and a DM stays invisible to a third party.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;

do $$
begin
  -- trainer read-across of the team channel (5) even though not a team member
  perform testkit.is_eq('chat: club trainer READS the team channel of b-03 (5)',
    (select count(*) from app.chat_messages
      where channel_type = 'team' and team_id = 'b0000000-0000-4000-8000-000000000003'), 5);
  -- but the DIRECT thread between a-01 and a-09 is invisible to him (0)
  perform testkit.is_eq('chat: third party (even a trainer) sees NONE of the direct messages (0)',
    (select count(*) from app.chat_messages where channel_type = 'direct'), 0);
  -- and he may NOT post to a team channel he is not a member of
  perform testkit.throws('chat: trainer MAY NOT post to a team he is not a member of',
    $q$insert into app.chat_messages (club_id, channel_type, team_id, sender_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001', 'team',
               'b0000000-0000-4000-8000-000000000003',
               'a0000000-0000-4000-8000-000000000004', 'nicht mein Team')$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- TREASURER Beate (90..03 / a-03) — a club member but NOT a trainer: may read
-- regional events, but never curate them.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('regional_events: treasurer reads the 3', (select count(*) from app.regional_events), 3);
  perform testkit.throws('regional_events: treasurer MAY NOT create one (not a trainer)',
    $q$insert into app.regional_events (club_id, title, starts_on)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Nope', current_date)$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- PLATFORM ADMIN (90..90) — cross-club READ of regional events (is_club_member
-- short-circuits true), but NOT a trainer -> no writes.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","app_metadata":{"is_platform_admin":true}}',
  true);
-- 0075: der blosse Claim oeffnet nichts mehr. Gemessen wird der ECHTE Zustand —
-- Claim UND eingeschaltete Einsicht, wie die Audit-Middleware sie setzt.
select set_config('app.operator_override', 'on', true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('regional_events: platform admin reads across tenants (3)',
    (select count(*) from app.regional_events), 3);
end;
$$;
rollback;

-- (Schreib-Sperre: mit dem BLOSSEN Claim gemessen — diese Zusage ist von 0075
--  unberuehrt. Was der EINGESCHALTETE Betreiber schreiben darf, entscheidet
--  0051/0074 und misst 99q.)
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","app_metadata":{"is_platform_admin":true}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.throws('regional_events: platform admin MAY NOT create one (not a trainer)',
    $q$insert into app.regional_events (club_id, title, starts_on)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Platform', current_date)$q$, '42501');
end;
$$;
rollback;
