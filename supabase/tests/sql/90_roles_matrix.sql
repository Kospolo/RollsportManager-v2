-- ============================================================================
-- 90_roles_matrix.sql — test class (h): the corrected role matrix (Referenz 1.3).
--
-- Covers the two roles the v1 rebuild had wrong plus the platform layer:
--   * moderator — admin-near: manages members + finance + structure, and MAY
--     change roles, but ONLY of targets below moderator rank (never
--     owner/admin/moderator).
--   * treasurer — manages members + finance, but NEVER changes any role.
--   * platform admin — app_metadata.is_platform_admin: cross-club READ, but no
--     club-role WRITE (platform writes go through the API/service_role).
--
-- Fixtures used from the seed:
--   Petra Köhler (m-14, profile 90..14)  = moderator
--   Beate Schäfer (m-03, profile 90..03) = treasurer
--   Jürgen Häberle (m-02)                = owner
--   Thomas Krüger (m-04)                 = admin
--   Greta Lindner (m-24)                 = plain member (pending)
--   90..90 (no club row)                 = platform admin
-- ============================================================================

-- ---------------------------------------------------------------------------
-- MODERATOR (Petra) — admin-near capabilities
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000014","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"moderator"}}',
  true);
set local role authenticated;

do $$
begin
  -- isClubAdmin: moderator may edit club settings (counts as admin)
  perform testkit.affects('moderator: MAY update club settings (isClubAdmin)',
    $q$update app.clubs set city = 'Neckarsulm-Moderiert'
        where id = 'c1ab0000-0000-4000-8000-000000000001'$q$, 1);

  -- canManageMembers: may add a plain member
  perform testkit.succeeds('moderator: MAY add a plain member',
    $q$insert into app.club_members (club_id, first_name, last_name, role, status)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Mod', 'Neuzugang', 'member', 'pending')$q$);

  -- may change a rank-lower member's role (member -> coach)
  perform testkit.affects('moderator: MAY promote a plain member to coach (rank below)',
    $q$update app.club_members set role = 'coach'
        where id = 'a0000000-0000-4000-8000-000000000024'$q$, 1);

  -- but NOT create/assign admin- or moderator-rank roles
  perform testkit.throws('moderator: MAY NOT promote a member to admin',
    $q$update app.club_members set role = 'admin'
        where id = 'a0000000-0000-4000-8000-000000000024'$q$, 'P0001');
  perform testkit.throws('moderator: MAY NOT promote a member to moderator',
    $q$update app.club_members set role = 'moderator'
        where id = 'a0000000-0000-4000-8000-000000000024'$q$, 'P0001');
  perform testkit.throws('moderator: MAY NOT assign an admin role on INSERT',
    $q$insert into app.club_members (club_id, first_name, last_name, role, status)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Planted', 'Admin', 'admin', 'active')$q$,
    'P0001');

  -- and NOT touch admins or owners at all
  perform testkit.throws('moderator: MAY NOT change an admin''s role',
    $q$update app.club_members set role = 'member'
        where id = 'a0000000-0000-4000-8000-000000000004'$q$, 'P0001');
  perform testkit.throws('moderator: MAY NOT change the owner''s role',
    $q$update app.club_members set role = 'member'
        where id = 'a0000000-0000-4000-8000-000000000002'$q$, 'P0001');

  -- canManageFinance: moderator sees + writes finances
  perform testkit.is_eq('moderator: sees the full cash book (10)',
    (select count(*) from app.ledger_entries), 10);
  perform testkit.is_eq('moderator: sees all invoices (10)',
    (select count(*) from app.invoices), 10);
  perform testkit.succeeds('moderator: MAY create an invoice',
    $q$insert into app.invoices (club_id, member_id, number, title, amount_cents, status)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000009',
               'R-MOD-9001', 'Moderator-Rechnung', 1500, 'draft')$q$);

  -- isTrainer: moderator may create structure (team)
  perform testkit.succeeds('moderator: MAY create a team (isTrainer)',
    $q$insert into app.teams (club_id, name, age_group)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Moderatoren-Team', 'U15')$q$);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- TREASURER (Beate) — members + finance, but NEVER roles
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;

do $$
begin
  -- canManageMembers: may add a plain member and edit non-role fields
  perform testkit.succeeds('treasurer: MAY add a plain member',
    $q$insert into app.club_members (club_id, first_name, last_name, role, status)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Kassen', 'Neuzugang', 'member', 'pending')$q$);
  perform testkit.affects('treasurer: MAY activate a pending member (non-role field)',
    $q$update app.club_members set status = 'active'
        where id = 'a0000000-0000-4000-8000-000000000024'$q$, 1);

  -- but NEVER a role change (Referenz 1.3: kassenwart = keine Rollen)
  perform testkit.throws('treasurer: MAY NOT change a member''s role (UPDATE)',
    $q$update app.club_members set role = 'coach'
        where id = 'a0000000-0000-4000-8000-000000000024'$q$, 'P0001');
  perform testkit.throws('treasurer: MAY NOT assign a non-member role on INSERT',
    $q$insert into app.club_members (club_id, first_name, last_name, role, status)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Kassen', 'Coach', 'coach', 'active')$q$,
    'P0001');

  -- not isClubAdmin: cannot edit club settings (silent no-op, no policy match)
  perform testkit.affects('treasurer: is NOT club admin — club update is a no-op',
    $q$update app.clubs set city = 'Pwned'
        where id = 'c1ab0000-0000-4000-8000-000000000001'$q$, 0);

  -- not a trainer: cannot create structure (RLS reject)
  perform testkit.throws('treasurer: is NOT a trainer — team INSERT is rejected',
    $q$insert into app.teams (club_id, name) values
       ('c1ab0000-0000-4000-8000-000000000001', 'Kassen-Team')$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- PLATFORM ADMIN (90..90) — cross-club READ, but no club-role WRITE
--
-- ### GEAENDERT DURCH MIGRATION 0075 — bewusst, nicht abgeschwaecht ###
-- Hier stand bis 0075: der blosse Plattform-Claim sieht beide Vereine.
-- app.is_club_member (0007:68 / 0025:92) begann seit jeher mit
-- 'app.is_platform_admin() or …' — OHNE die Sitzungsvariable. Damit las ein
-- Plattform-Token 24 Mitgliederzeilen ueber Mandantengrenzen hinweg, ohne dass
-- irgendwo eine Protokollzeile entstehen musste. 0051 hatte den Betreiber-
-- Zugriff ausdruecklich an den Nachweis gekoppelt („kein Einblick ohne
-- Protokollzeile"); dieser Zweig war aelter und umging die Kopplung in der
-- Datenbank vollstaendig. 0074 hat ihn im Kopf unter „Ebenfalls benannt"
-- ausdruecklich als offenen Punkt stehen lassen — 0075 schliesst ihn.
--
-- Fuer den LAUFENDEN BETRIEB aendert das nichts: middleware/operator-access.ts
-- liegt auf '*' und setzt die Einsicht vor jeder Route eines Plattform-Tokens.
-- Was wegfaellt, ist der Weg an der API vorbei.
--
-- Der Block prueft deshalb jetzt BEIDE Lagen — erst die neue Sperre, dann die
-- unveraenderte Zusage aus 0051.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","app_metadata":{"is_platform_admin":true}}',
  true);
set local role authenticated;

do $$
begin
  -- (1) CLAIM ALLEIN: seit 0075 kein Cross-Club-READ mehr.
  perform testkit.is_eq('platform admin: der Claim ALLEIN sieht keinen Verein mehr (0075)',
    (select count(*) from app.clubs), 0);
  perform testkit.is_eq('platform admin: … und keine einzige Mitgliederzeile',
    (select count(*) from app.club_members), 0);

  -- READ only: without a club role the write policies still reject
  perform testkit.throws('platform admin: has no club-role WRITE (team INSERT rejected)',
    $q$insert into app.teams (club_id, name) values
       ('c1ab0000-0000-4000-8000-000000000001', 'Platform-Team')$q$, '42501');
  perform testkit.throws('platform admin: cannot self-plant a club_members row',
    $q$insert into app.club_members (club_id, first_name, last_name, role, status)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Platform', 'Ghost', 'member', 'active')$q$,
    '42501');
end;
$$;
rollback;

-- (2) DERSELBE CLAIM + die eingeschaltete Einsicht (das, was die Middleware vor
--     jedem Request tut): die Zusage aus 0051 haelt unveraendert.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","app_metadata":{"is_platform_admin":true}}',
  true);
select set_config('app.operator_override', 'on', true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('platform admin (Einsicht EIN): sees clubs across ALL tenants (2)',
    (select count(*) from app.clubs), 2);
  perform testkit.is_eq('platform admin (Einsicht EIN): rosters span both clubs (2 distinct club_ids)',
    (select count(distinct club_id) from app.club_members), 2);
  perform testkit.is_eq('platform admin (Einsicht EIN): sees club B''s roster too (3 rows)',
    (select count(*) from app.club_members
      where club_id = 'deadbeef-0000-4000-8000-000000000001'), 3);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- Regression: a normal member gets NO platform powers (no cross-club leak)
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('regression: a member without the platform claim sees only 1 club',
    (select count(*) from app.clubs), 1);
end;
$$;
rollback;
