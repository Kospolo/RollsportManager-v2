-- ============================================================================
-- 91_appshell.sql — test class: app-shell base (migration 0016).
--
--   * user_preferences — STRICTLY private: each identity reads/writes only its
--     OWN row (RLS profile_id = auth.uid()). A fellow member sees 0 foreign
--     rows; even a platform admin (the cross-club READER elsewhere) sees only
--     their own. Nobody may plant or edit another user's preferences.
--
--   * club_members self master-data edit (/me PATCH) — a PLAIN member may edit
--     their OWN first/last name, e-mail, birth date (club_members_update_self)
--     WITHOUT can_manage_members, but the protect_club_membership trigger still
--     blocks any self-change to role / status / valid_until (P0001). A member
--     still cannot touch anyone else's row (0 rows under RLS). Managers keep
--     editing other members (regression guard for the added permissive policy).
--
-- Personas (club A, seed): Katrin 90..09 = plain member (m-09 / a0..09);
-- Jürgen 90..02 = owner (m-02 / a0..02); platform admin 90..90 (no membership).
-- Every persona has a seeded preferences row (locale de, theme auto).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Plain MEMBER (Katrin, 90..09)
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  -- preferences: sees exactly her OWN row, never a foreign one
  perform testkit.is_eq('prefs: member sees exactly 1 row (her own)',
    (select count(*) from app.user_preferences), 1);
  perform testkit.is_eq('prefs: member sees 0 foreign prefs (owner''s row is invisible)',
    (select count(*) from app.user_preferences
      where profile_id = '90000000-0000-4000-8000-000000000002'), 0);

  -- preferences: may upsert HER OWN row (update path affects 1)
  perform testkit.affects('prefs: member updates her own theme (1 row)',
    $q$update app.user_preferences set theme = 'dark'
        where profile_id = '90000000-0000-4000-8000-000000000009'$q$, 1);

  -- preferences: may NOT update a foreign row -> filtered by RLS (0 rows)
  perform testkit.affects('prefs: member cannot update a foreign prefs row (0 under RLS)',
    $q$update app.user_preferences set theme = 'dark'
        where profile_id = '90000000-0000-4000-8000-000000000002'$q$, 0);

  -- preferences: may NOT insert a row owned by someone else (WITH CHECK 42501)
  perform testkit.throws('prefs: member cannot insert a prefs row for another user',
    $q$insert into app.user_preferences (profile_id, locale, theme)
       values ('90000000-0000-4000-8000-000000000002', 'de', 'dark')$q$, '42501');

  -- /me PATCH: a plain member MAY edit her OWN master data
  perform testkit.affects('me: member edits her own first_name (1 row)',
    $q$update app.club_members set first_name = 'Katrina'
        where profile_id = '90000000-0000-4000-8000-000000000009'
          and deleted_at is null$q$, 1);
  perform testkit.affects('me: member edits her own e-mail (1 row)',
    $q$update app.club_members set email = 'katrin.neu@example.org'
        where profile_id = '90000000-0000-4000-8000-000000000009'
          and deleted_at is null$q$, 1);

  -- /me PATCH: a member may NOT change her OWN role / status / validity (P0001)
  perform testkit.throws('me: member cannot change her own role (self-escalation blocked)',
    $q$update app.club_members set role = 'admin'
        where profile_id = '90000000-0000-4000-8000-000000000009'$q$, 'P0001');
  perform testkit.throws('me: member cannot change her own status',
    $q$update app.club_members set status = 'inactive'
        where profile_id = '90000000-0000-4000-8000-000000000009'$q$, 'P0001');
  perform testkit.throws('me: member cannot set her own valid_until',
    $q$update app.club_members set valid_until = now() + interval '1 day'
        where profile_id = '90000000-0000-4000-8000-000000000009'$q$, 'P0001');

  -- /me PATCH: a member may NOT edit ANOTHER member's master data (0 under RLS)
  perform testkit.affects('me: member cannot edit a foreign member row (0 under RLS)',
    $q$update app.club_members set first_name = 'Hack'
        where id = 'a0000000-0000-4000-8000-000000000015'$q$, 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- OWNER (Jürgen, 90..02) — regression: managers still edit OTHER members'
-- master data after the added self policy; own prefs stay private.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('prefs: owner also sees only his own 1 row',
    (select count(*) from app.user_preferences), 1);

  -- manager edits another member's master data (can_manage_members) — unbroken
  perform testkit.affects('me/members: owner still edits another member''s name (1 row)',
    $q$update app.club_members set first_name = 'Katrin'
        where id = 'a0000000-0000-4000-8000-000000000009'
          and club_id = 'c1ab0000-0000-4000-8000-000000000001'$q$, 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- PLATFORM ADMIN (90..90) — cross-club READER, but preferences are personal:
-- sees only their OWN row, never another user's.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000090","role":"authenticated","app_metadata":{"is_platform_admin":true}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('prefs: platform admin sees exactly their own 1 row',
    (select count(*) from app.user_preferences), 1);
  perform testkit.is_eq('prefs: platform admin sees 0 of a member''s prefs (private, not cross-club)',
    (select count(*) from app.user_preferences
      where profile_id = '90000000-0000-4000-8000-000000000009'), 0);
end;
$$;
rollback;
