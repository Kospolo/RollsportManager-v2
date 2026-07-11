-- ============================================================================
-- 99b_wettkampf.sql — test class (k): Wettkampf-Tiefe (migration 0018).
--
--   * routine_shares    — read = every club member; create link / revoke =
--                         is_club_trainer (owner/admin/moderator/coach/
--                         guest_coach). A treasurer or plain member reads but
--                         cannot create or revoke. A foreign-club user sees 0
--                         and cannot plant a share.
--   * standings source  — GET /competitions/{id}/standings reads
--                         routine_scores + competition_entries + routines, all
--                         select = is_club_member. A member of club A sees the
--                         Kreispokal (c-02) scores/entries; club B sees 0.
--   * federation source — GET /competitions/{id}/federation-export reads
--                         competition_entries (member-visible via RLS); the
--                         trainer-only gate is enforced in the API guard
--                         (requireClubRole COACH_ROLES) — represented at the DB
--                         layer by the routine_shares trainer-write test below.
--   * public token view — GET /public/routines/{token} is resolved in SERVICE
--                         MODE (no claims). The exact resolver WHERE clause
--                         returns the live tokens and NOTHING for revoked /
--                         expired / unknown tokens (the 404 paths). anon has no
--                         access to app.routine_shares at all (42501).
--
-- Seed baseline (club A c1ab…01): 4 routine_shares
--   f5a…01 Feuervogel  token shr_feuervogel_7Qk2mX9pLtRv3Bd  live
--   f5a…02 Sommerregen token shr_sommerregen_Za8Wc1Ne5Yh0Uf live (expires +30)
--   f5a…03 Mondlicht   token shr_mondlicht_REVOKED_kQ4dP     revoked
--   f5a…04 Nordwind    token shr_nordwind_EXPIRED_9wLmT      expired (-2)
-- Kreispokal c-02 (done): 3 entries + 3 placed scores. Club B (deadbeef…): none.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Plain MEMBER (Katrin, 90..09) — reads shares + standings/federation source,
-- writes no share.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('routine_shares: member sees all 4',
    (select count(*) from app.routine_shares), 4);

  -- standings source: the Kreispokal scores are member-visible (read = member)
  perform testkit.is_eq('standings: member sees the 3 Kreispokal scores',
    (select count(*) from app.routine_scores
      where competition_id = 'c0000000-0000-4000-8000-000000000002'), 3);
  perform testkit.is_eq('standings: member sees the 3 Kreispokal entries',
    (select count(*) from app.competition_entries
      where competition_id = 'c0000000-0000-4000-8000-000000000002'), 3);

  -- placement is now readable (migration 0018 column)
  perform testkit.is_eq('placement: member reads the winning placement (1)',
    (select placement from app.routine_scores
      where competition_id = 'c0000000-0000-4000-8000-000000000002'
        and routine_id = 'd0000000-0000-4000-8000-000000000002'), 1);

  -- member is not a trainer -> cannot create a share
  perform testkit.throws('routine_shares: member MAY NOT create (not trainer)',
    $q$insert into app.routine_shares (club_id, routine_id, token)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'd0000000-0000-4000-8000-000000000001', 'shr_member_hack')$q$, '42501');

  -- member revoke is silently filtered by RLS (not trainer -> 0 rows)
  perform testkit.affects('routine_shares: member revoke filtered by RLS (0 rows)',
    $q$update app.routine_shares set revoked = true
       where id = 'f5a00000-0000-4000-8000-000000000001'$q$, 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- TREASURER (Beate, 90..03) — is_club_member (reads) but NOT is_club_trainer.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('routine_shares: treasurer reads 4',
    (select count(*) from app.routine_shares), 4);
  -- treasurer manages finance, NOT routines -> no share creation
  perform testkit.throws('routine_shares: treasurer MAY NOT create (not trainer)',
    $q$insert into app.routine_shares (club_id, routine_id, token)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'd0000000-0000-4000-8000-000000000001', 'shr_treasurer_hack')$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- COACH (Sandra, 90..01) — is_club_trainer: creates + revokes share links.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  -- a coach IS a trainer -> may create a share link
  perform testkit.succeeds('routine_shares: coach MAY create a share',
    $q$insert into app.routine_shares (club_id, routine_id, token)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'd0000000-0000-4000-8000-000000000003', 'shr_coach_ok_abc123')$q$);
  -- ... and may revoke an existing one
  perform testkit.affects('routine_shares: coach MAY revoke a share (1 row)',
    $q$update app.routine_shares set revoked = true
       where id = 'f5a00000-0000-4000-8000-000000000001'$q$, 1);
  -- score with placement (Live-Scoring) is trainer-writable
  perform testkit.succeeds('routine_scores: coach MAY record a placed live score',
    $q$insert into app.routine_scores
         (club_id, routine_id, competition_id, scored_on,
          technical_score, components_score, total_score, placement)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'd0000000-0000-4000-8000-000000000001',
               'c0000000-0000-4000-8000-000000000002', current_date,
               22.0, 20.0, 42.0, 2)$q$);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- CROSS-TENANT: club B owner (Bert, deadbeef-9000-..-01) sees NOTHING of club A
-- and cannot plant a share into club A. No data leak.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"deadbeef-9000-4000-8000-000000000001","role":"authenticated","club_roles":{"deadbeef-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('tenant isolation: club B owner sees 0 club A shares',
    (select count(*) from app.routine_shares
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 0);
  perform testkit.is_eq('tenant isolation: club B owner sees 0 club A Kreispokal scores',
    (select count(*) from app.routine_scores
      where competition_id = 'c0000000-0000-4000-8000-000000000002'), 0);
  -- even an owner cannot create a share in a club that is not theirs
  perform testkit.throws('tenant isolation: club B owner MAY NOT plant a club A share',
    $q$insert into app.routine_shares (club_id, routine_id, token)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'd0000000-0000-4000-8000-000000000001', 'shr_crosstenant_hack')$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- PUBLIC token view (service mode): the exact resolver WHERE clause from
-- routes/public-routines.ts. Live tokens resolve to exactly ONE Kür; revoked,
-- expired and unknown tokens resolve to nothing (the 404 paths). The resolver
-- joins only routines + clubs — never club_members — so no personal/finance
-- leak is even reachable through this path.
-- ---------------------------------------------------------------------------
begin;
set local role service_role;

do $$
declare
  fn record;
begin
  -- helper: resolvable count for a token, mirroring the API query exactly
  perform testkit.is_eq('public: live token (Feuervogel) resolves to 1 Kür',
    (select count(*) from app.routine_shares sh
       join app.routines r on r.id = sh.routine_id and r.deleted_at is null
       join app.clubs   cl on cl.id = sh.club_id and cl.deleted_at is null
      where sh.token = 'shr_feuervogel_7Qk2mX9pLtRv3Bd'
        and sh.deleted_at is null and sh.revoked = false
        and (sh.expires_at is null or sh.expires_at > now())), 1);

  perform testkit.is_eq('public: second live token (Sommerregen, future expiry) resolves to 1',
    (select count(*) from app.routine_shares sh
       join app.routines r on r.id = sh.routine_id and r.deleted_at is null
      where sh.token = 'shr_sommerregen_Za8Wc1Ne5Yh0Uf'
        and sh.deleted_at is null and sh.revoked = false
        and (sh.expires_at is null or sh.expires_at > now())), 1);

  -- the resolved payload carries only non-personal fields (title + club name)
  select r.title, cl.name as club_name into fn
    from app.routine_shares sh
    join app.routines r on r.id = sh.routine_id
    join app.clubs   cl on cl.id = sh.club_id
   where sh.token = 'shr_feuervogel_7Qk2mX9pLtRv3Bd';
  if fn.title <> 'Feuervogel' or fn.club_name is null then
    perform testkit.fail('public: payload exposes Kür title + club name',
      format('got title=%s club=%s', fn.title, fn.club_name));
  end if;
  perform testkit.ok('public: payload exposes Kür title + club name (no personal data)');

  -- REVOKED token -> 0 rows -> API 404
  perform testkit.is_eq('public: revoked token resolves to 0 (404)',
    (select count(*) from app.routine_shares sh
      where sh.token = 'shr_mondlicht_REVOKED_kQ4dP'
        and sh.deleted_at is null and sh.revoked = false
        and (sh.expires_at is null or sh.expires_at > now())), 0);

  -- EXPIRED token -> 0 rows -> API 404
  perform testkit.is_eq('public: expired token resolves to 0 (404)',
    (select count(*) from app.routine_shares sh
      where sh.token = 'shr_nordwind_EXPIRED_9wLmT'
        and sh.deleted_at is null and sh.revoked = false
        and (sh.expires_at is null or sh.expires_at > now())), 0);

  -- UNKNOWN token -> 0 rows -> API 404
  perform testkit.is_eq('public: unknown token resolves to 0 (404)',
    (select count(*) from app.routine_shares sh
      where sh.token = 'shr_does_not_exist'
        and sh.deleted_at is null and sh.revoked = false), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- anon has no access to app.routine_shares at all (no anon policy -> 42501):
-- the public view is ONLY reachable through the service-mode API resolver,
-- never by a raw anon client hitting the table directly.
-- ---------------------------------------------------------------------------
begin;
set local role anon;

do $$
begin
  perform testkit.throws('anon: cannot read routine_shares directly',
    $q$select count(*) from app.routine_shares$q$, '42501');
  perform testkit.throws('anon: cannot read routine_scores directly',
    $q$select count(*) from app.routine_scores$q$, '42501');
end;
$$;
rollback;
