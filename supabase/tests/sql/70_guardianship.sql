-- ============================================================================
-- 70_guardianship.sql — test class (g): parents/guardians and children.
--
-- Parents act for their OWN children via app.guardianships (RSVPs, invoices),
-- but never for foreign children. Nobody can self-assign a guardianship
-- (that would be an escalation path to foreign family data).
--
-- Seed families: Katrin -> Lina + Emma, Stefanie -> Sofia + Ben,
--                Petra -> Finn.
-- ============================================================================

begin;

-- fixture (superuser, rolled back): an invoice addressed to CHILD Lina, so
-- the guardian visibility rule is really exercised via the child's row
insert into app.invoices (club_id, member_id, number, title, amount_cents, status, issued_on, due_on)
values ('c1ab0000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000007',
        'R-TEST-0100', 'Wettkampfmeldung — Lina (Kind)', 2500, 'open',
        current_date, current_date + 14);

-- ---------------------------------------------------------------------------
-- Katrin (guardian of Lina a0..07 and Emma a0..08)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('guardianship: parent sees exactly her own family relations (2 of 5)',
    (select count(*) from app.guardianships), 2);
  perform testkit.is_eq('guardianship: parent sees own + child invoices (2 own + 1 Lina = 3)',
    (select count(*) from app.invoices), 3);
  perform testkit.is_eq('guardianship: the child''s invoice is visible to the guardian',
    (select count(*) from app.invoices
      where member_id = 'a0000000-0000-4000-8000-000000000007'), 1);
  perform testkit.succeeds('guardianship: parent MAY RSVP for her own child',
    $q$insert into app.event_rsvps (club_id, event_id, member_id, status)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'e0000000-0000-4000-8000-000000000013',
               'a0000000-0000-4000-8000-000000000007', 'going')$q$);
  perform testkit.affects('guardianship: parent MAY update her child''s existing RSVP (1 row)',
    $q$update app.event_rsvps set status = 'sick'
        where event_id  = 'e0000000-0000-4000-8000-000000000007'
          and member_id = 'a0000000-0000-4000-8000-000000000007'$q$, 1);
  perform testkit.throws('guardianship: RSVP for a FOREIGN child is rejected',
    $q$insert into app.event_rsvps (club_id, event_id, member_id, status)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'e0000000-0000-4000-8000-000000000013',
               'a0000000-0000-4000-8000-000000000013', 'going')$q$, '42501');
  perform testkit.affects('guardianship: updating a FOREIGN child''s RSVP is a silent no-op',
    $q$update app.event_rsvps set status = 'declined'
        where event_id  = 'e0000000-0000-4000-8000-000000000007'
          and member_id = 'a0000000-0000-4000-8000-000000000013'$q$, 0);
  perform testkit.throws('guardianship: self-assigning a foreign child as own is rejected',
    $q$insert into app.guardianships (club_id, guardian_member_id, child_member_id)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000009',
               'a0000000-0000-4000-8000-000000000013')$q$, '42501');
  perform testkit.affects('guardianship: parent cannot rewire existing relations (0 rows)',
    $q$update app.guardianships
         set child_member_id = 'a0000000-0000-4000-8000-000000000013'
       where guardian_member_id = 'a0000000-0000-4000-8000-000000000009'$q$, 0);
  perform testkit.throws('guardianship: parents cannot write attendance, not even for own children',
    $q$insert into app.attendance (club_id, event_id, member_id, status)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'e0000000-0000-4000-8000-000000000013',
               'a0000000-0000-4000-8000-000000000007', 'present')$q$, '42501');
end;
$$;

-- ---------------------------------------------------------------------------
-- Stefanie (guardian of Sofia + Ben, NOT of Lina)
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000012","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('guardianship: other parent sees only her own invoices (2)',
    (select count(*) from app.invoices), 2);
  perform testkit.is_eq('guardianship: Lina''s invoice is invisible to a foreign parent',
    (select count(*) from app.invoices
      where member_id = 'a0000000-0000-4000-8000-000000000007'), 0);
  perform testkit.is_eq('guardianship: other parent sees only her own relations (2)',
    (select count(*) from app.guardianships), 2);
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin (Thomas): full guardianship visibility + legitimate management
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('guardianship: admin sees all relations of the club (5)',
    (select count(*) from app.guardianships), 5);
  perform testkit.succeeds('guardianship: admin MAY create a relation (office task)',
    $q$insert into app.guardianships (club_id, guardian_member_id, child_member_id)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000014',
               'a0000000-0000-4000-8000-000000000008')$q$);
end;
$$;

rollback;
