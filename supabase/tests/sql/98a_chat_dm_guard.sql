-- ============================================================================
-- 98a_chat_dm_guard.sql — test class (k2): who may DIRECT-message whom
-- (migration 0043) + the chat isolation claims re-checked under impersonation.
--
--   * adult  -> foreign child        = 42501   (the point of 0043)
--   * child  -> unrelated adult      = 42501   (symmetric, no "write me first")
--   * parent -> own child            = allowed (app.guardianships)
--   * coach  -> child of THEIR team  = allowed (team_members.role='coach')
--   * coach  -> child of a team they do NOT coach = 42501
--   * adult  -> adult                = allowed (unchanged from 0011)
--   * child  -> child                = allowed (deliberately left open, 0043)
--   * sender row from ANOTHER club   = 42501   (tenancy, second find in 0043)
--   * club A member sees NOTHING of club B chat, and vice versa
--   * a non-party sees nothing of a direct thread (re-check, now via SQL)
--
-- Personas (seed.sql): Sandra Vogel 90..01/a-01 coach of b-02 + b-03;
-- Thomas Krueger 90..04/a-04 admin, in NO team; Katrin Gruenewald 90..09/a-09
-- parent of Lina a-07 (b-02) and Emma a-08 (b-01); Beate Schaefer 90..03/a-03
-- treasurer, in no team. Children have birth_date, adults do not.
-- Children a-07/a-08 have NO account -> they cannot be impersonated; the rule
-- is a PAIR predicate, so their side is proven via app.chat_dm_allowed and via
-- an insert with the child as sender under a temporarily attached profile.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The pair predicate itself, checked as superuser (no RLS in the way).
-- This is the rule in one place; the policy tests below prove it is WIRED UP.
-- ---------------------------------------------------------------------------
do $$
begin
  -- who is a minor at all (seed: adults carry birth_date = null)
  perform testkit.is_eq('dm-guard: Lina (a-07, born 2014) counts as a minor',
    (select count(*) from (select 1 where app.chat_is_minor('a0000000-0000-4000-8000-000000000007')) z), 1);
  perform testkit.is_eq('dm-guard: Sandra (a-01, no birth_date) does NOT count as a minor',
    (select count(*) from (select 1 where app.chat_is_minor('a0000000-0000-4000-8000-000000000001')) z), 0);
  perform testkit.is_eq('dm-guard: Hanna (a-23, born 2008) still counts as a minor (under 18)',
    (select count(*) from (select 1 where app.chat_is_minor('a0000000-0000-4000-8000-000000000023')) z), 1);

  -- the four combinations
  perform testkit.is_eq('dm-guard: adult -> adult allowed (Katrin a-09 -> Sandra a-01)',
    (select count(*) from (select 1 where app.chat_dm_allowed(
      'a0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001')) z), 1);
  perform testkit.is_eq('dm-guard: child -> child allowed (Lina a-07 -> Sofia a-10)',
    (select count(*) from (select 1 where app.chat_dm_allowed(
      'a0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000010')) z), 1);
  perform testkit.is_eq('dm-guard: parent -> own child allowed (Katrin a-09 -> Lina a-07)',
    (select count(*) from (select 1 where app.chat_dm_allowed(
      'a0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000007')) z), 1);
  perform testkit.is_eq('dm-guard: own child -> parent allowed, symmetric (Lina a-07 -> Katrin a-09)',
    (select count(*) from (select 1 where app.chat_dm_allowed(
      'a0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000009')) z), 1);

  -- TRAINER:INNEN ERREICHEN IHRE SCHUETZLINGE — the belastende Gegenprobe zur Sperre
  perform testkit.is_eq('dm-guard: coach Sandra (a-01, coach of b-02) MAY reach Lina (a-07, in b-02)',
    (select count(*) from (select 1 where app.chat_dm_allowed(
      'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000007')) z), 1);
  perform testkit.is_eq('dm-guard: coach Sandra MAY reach Maja (a-16, in her b-03)',
    (select count(*) from (select 1 where app.chat_dm_allowed(
      'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000016')) z), 1);
  perform testkit.is_eq('dm-guard: Anna-Lena (a-05, coach of b-01) MAY reach Emma (a-08, in b-01)',
    (select count(*) from (select 1 where app.chat_dm_allowed(
      'a0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000008')) z), 1);
  perform testkit.is_eq('dm-guard: guest coach Milena (a-06, coach of b-03) MAY reach Johanna (a-17, in b-03)',
    (select count(*) from (select 1 where app.chat_dm_allowed(
      'a0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000017')) z), 1);
  -- ... but a coach is NOT a free pass for every child of the club
  perform testkit.is_eq('dm-guard: coach Sandra may NOT reach Nele (a-20, only in b-01 which she does not coach)',
    (select count(*) from (select 1 where app.chat_dm_allowed(
      'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000020')) z), 0);

  -- the board is NOT a trainer for this purpose (is_club_trainer would say yes)
  perform testkit.is_eq('dm-guard: admin Thomas (a-04, in no team) may NOT reach Lina (a-07)',
    (select count(*) from (select 1 where app.chat_dm_allowed(
      'a0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000007')) z), 0);
  perform testkit.is_eq('dm-guard: owner Juergen (a-02) may NOT reach Maja (a-16)',
    (select count(*) from (select 1 where app.chat_dm_allowed(
      'a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000016')) z), 0);
  perform testkit.is_eq('dm-guard: treasurer Beate (a-03) may NOT reach Finn (a-13)',
    (select count(*) from (select 1 where app.chat_dm_allowed(
      'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000013')) z), 0);
  -- a foreign PARENT is just an adult: Katrin is not Sofia's guardian
  perform testkit.is_eq('dm-guard: Katrin (a-09) may NOT reach Sofia (a-10) - not HER child',
    (select count(*) from (select 1 where app.chat_dm_allowed(
      'a0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000010')) z), 0);
  -- symmetric: the child cannot open the door from its side either
  perform testkit.is_eq('dm-guard: Sofia (a-10) may NOT reach Katrin (a-09) - symmetric',
    (select count(*) from (select 1 where app.chat_dm_allowed(
      'a0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000009')) z), 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- ADMIN Thomas (90..04 / a-04) — an adult in NO team. The board member who
-- could message every child of the club before 0043.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;

do $$
begin
  -- THE regression this migration exists for
  perform testkit.throws('dm-guard: admin MAY NOT direct-message a child of the club (Lina a-07)',
    $q$insert into app.chat_messages (club_id, channel_type, sender_member_id, recipient_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001', 'direct',
               'a0000000-0000-4000-8000-000000000004',
               'a0000000-0000-4000-8000-000000000007', 'Hallo Lina')$q$, '42501');
  perform testkit.throws('dm-guard: admin MAY NOT direct-message a teenager either (Hanna a-23)',
    $q$insert into app.chat_messages (club_id, channel_type, sender_member_id, recipient_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001', 'direct',
               'a0000000-0000-4000-8000-000000000004',
               'a0000000-0000-4000-8000-000000000023', 'Hallo Hanna')$q$, '42501');
  -- an image-only message is not a loophole (content check is a different check)
  perform testkit.throws('dm-guard: admin MAY NOT send a child an IMAGE-only direct message',
    $q$insert into app.chat_messages (club_id, channel_type, sender_member_id, recipient_member_id, image_url)
       values ('c1ab0000-0000-4000-8000-000000000001', 'direct',
               'a0000000-0000-4000-8000-000000000004',
               'a0000000-0000-4000-8000-000000000007', 'https://example.org/x.jpg')$q$, '42501');
  -- but the adults of the club stay reachable — this is not a mute button
  perform testkit.succeeds('dm-guard: admin MAY still direct-message an adult (Beate a-03)',
    $q$insert into app.chat_messages (club_id, channel_type, sender_member_id, recipient_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001', 'direct',
               'a0000000-0000-4000-8000-000000000004',
               'a0000000-0000-4000-8000-000000000003', 'Kurze Rueckfrage zum Beitrag')$q$);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- COACH Sandra (90..01 / a-01) — coach of b-02 and b-03. Proves the carve-out
-- is real: she reaches HER skaters, and only those.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.succeeds('dm-guard: coach MAY direct-message a child of HER team (Lina a-07, b-02)',
    $q$insert into app.chat_messages (club_id, channel_type, sender_member_id, recipient_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001', 'direct',
               'a0000000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000007', 'Denk an die Kuer am Samstag')$q$);
  perform testkit.throws('dm-guard: coach MAY NOT direct-message a child of a team she does not coach (Nele a-20, b-01)',
    $q$insert into app.chat_messages (club_id, channel_type, sender_member_id, recipient_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001', 'direct',
               'a0000000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000020', 'Hallo Nele')$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- PARENT Katrin (90..09 / a-09) — guardian of Lina (a-07) and Emma (a-08).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.succeeds('dm-guard: parent MAY direct-message her OWN child (Lina a-07)',
    $q$insert into app.chat_messages (club_id, channel_type, sender_member_id, recipient_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001', 'direct',
               'a0000000-0000-4000-8000-000000000009',
               'a0000000-0000-4000-8000-000000000007', 'Bring die Schoner mit')$q$);
  perform testkit.throws('dm-guard: parent MAY NOT direct-message SOMEONE ELSE child (Sofia a-10)',
    $q$insert into app.chat_messages (club_id, channel_type, sender_member_id, recipient_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001', 'direct',
               'a0000000-0000-4000-8000-000000000009',
               'a0000000-0000-4000-8000-000000000010', 'Hallo Sofia')$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- THE CHILD'S SIDE. a-07/a-08 have no account in the seed, so a child cannot be
-- impersonated as shipped. Attach a throwaway profile to Lina INSIDE this
-- transaction (rolled back) to prove the symmetric direction is enforced by the
-- POLICY and not just by the predicate.
-- ---------------------------------------------------------------------------
begin;
insert into auth.users (id, email) values
  ('7e577e57-0000-4000-8000-000000000007', 'lina.test@example.org')
  on conflict (id) do nothing;
insert into app.profiles (id, display_name) values
  ('7e577e57-0000-4000-8000-000000000007', 'Lina Gruenewald')
  on conflict (id) do nothing;
update app.club_members set profile_id = '7e577e57-0000-4000-8000-000000000007'
  where id = 'a0000000-0000-4000-8000-000000000007';

select set_config('request.jwt.claims',
  '{"sub":"7e577e57-0000-4000-8000-000000000007","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.throws('dm-guard: a CHILD may not open a thread with an unrelated adult (Beate a-03)',
    $q$insert into app.chat_messages (club_id, channel_type, sender_member_id, recipient_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001', 'direct',
               'a0000000-0000-4000-8000-000000000007',
               'a0000000-0000-4000-8000-000000000003', 'Hallo')$q$, '42501');
  perform testkit.succeeds('dm-guard: a CHILD may write to her own coach (Sandra a-01, b-02)',
    $q$insert into app.chat_messages (club_id, channel_type, sender_member_id, recipient_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001', 'direct',
               'a0000000-0000-4000-8000-000000000007',
               'a0000000-0000-4000-8000-000000000001', 'Ich komme heute spaeter')$q$);
  perform testkit.succeeds('dm-guard: a CHILD may write to her own parent (Katrin a-09)',
    $q$insert into app.chat_messages (club_id, channel_type, sender_member_id, recipient_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001', 'direct',
               'a0000000-0000-4000-8000-000000000007',
               'a0000000-0000-4000-8000-000000000009', 'Holst du mich ab?')$q$);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- TENANCY — the second find in 0043: the SENDER row must belong to the club of
-- the message. Build a dual-membership person (member of club A AND club B)
-- inside the transaction; without the new check she could post into club A
-- carrying her club-B identity.
-- ---------------------------------------------------------------------------
begin;
insert into auth.users (id, email) values
  ('d0a1d0a1-0000-4000-8000-000000000001', 'doppel@example.org') on conflict (id) do nothing;
insert into app.profiles (id, display_name) values
  ('d0a1d0a1-0000-4000-8000-000000000001', 'Doppel Mitglied') on conflict (id) do nothing;
-- her row in club A ...
insert into app.club_members (id, club_id, profile_id, first_name, last_name, role, status, joined_on)
values ('d0a1d0a1-a000-4000-8000-00000000000a', 'c1ab0000-0000-4000-8000-000000000001',
        'd0a1d0a1-0000-4000-8000-000000000001', 'Doppel', 'Mitglied', 'member', 'active', '2024-01-01');
-- ... and her row in club B
insert into app.club_members (id, club_id, profile_id, first_name, last_name, role, status, joined_on)
values ('d0a1d0a1-a000-4000-8000-00000000000b', 'deadbeef-0000-4000-8000-000000000001',
        'd0a1d0a1-0000-4000-8000-000000000001', 'Doppel', 'Mitglied', 'member', 'active', '2024-01-01');

select set_config('request.jwt.claims',
  '{"sub":"d0a1d0a1-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member","deadbeef-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  -- both rows are hers (is_own_member says yes to either) - that was the hole
  perform testkit.throws('tenancy: may NOT post into club A carrying the club-B sender row',
    $q$insert into app.chat_messages (club_id, channel_type, sender_member_id, recipient_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001', 'direct',
               'd0a1d0a1-a000-4000-8000-00000000000b',
               'a0000000-0000-4000-8000-000000000003', 'aus dem falschen Verein')$q$, '42501');
  -- with the RIGHT row of that club it works — the check is about the club, not about her
  perform testkit.succeeds('tenancy: MAY post into club A with her club-A sender row',
    $q$insert into app.chat_messages (club_id, channel_type, sender_member_id, recipient_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001', 'direct',
               'd0a1d0a1-a000-4000-8000-00000000000a',
               'a0000000-0000-4000-8000-000000000003', 'aus dem richtigen Verein')$q$);
  -- and a recipient from the OTHER club stays impossible (0011, re-checked)
  perform testkit.throws('tenancy: may NOT direct-message ACROSS clubs (A sender -> B recipient)',
    $q$insert into app.chat_messages (club_id, channel_type, sender_member_id, recipient_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001', 'direct',
               'd0a1d0a1-a000-4000-8000-00000000000a',
               'deadbeef-a000-4000-8000-000000000002', 'Verein A schreibt Verein B')$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- CROSS-TENANT READ — club B's owner must see nothing of club A's chat.
-- (Seeded: 5 team messages in b-03 + 3 direct in club A; club B has none.)
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"deadbeef-9000-4000-8000-000000000001","role":"authenticated","club_roles":{"deadbeef-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('tenancy: club B owner sees 0 chat messages of club A',
    (select count(*) from app.chat_messages
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 0);
  perform testkit.is_eq('tenancy: club B owner sees 0 messages of club A team b-03 (trainer read-across stops at the club)',
    (select count(*) from app.chat_messages
      where channel_type = 'team' and team_id = 'b0000000-0000-4000-8000-000000000003'), 0);
  -- and he cannot post into club A either
  perform testkit.throws('tenancy: club B owner MAY NOT post into a club A team channel',
    $q$insert into app.chat_messages (club_id, channel_type, team_id, sender_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001', 'team',
               'b0000000-0000-4000-8000-000000000003',
               'deadbeef-a000-4000-8000-000000000001', 'fremder Verein')$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- FOREIGN THREADS / FOREIGN TEAM CHANNELS — the two "can someone read what is
-- not theirs" claims, under impersonation.
-- Treasurer Beate (90..03 / a-03): in NO team, NOT a party of the a-01<->a-09
-- thread, and NOT is_club_trainer.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('isolation: treasurer sees 0 of the 3 direct messages she is not a party of',
    (select count(*) from app.chat_messages where channel_type = 'direct'), 0);
  perform testkit.is_eq('isolation: treasurer (no team, not a trainer) sees 0 team messages',
    (select count(*) from app.chat_messages where channel_type = 'team'), 0);
end;
$$;
rollback;
