-- ============================================================================
-- 99_modules_batch5.sql — test class (l): modules batch 5 (migration 0012).
-- The two PRO-gated modules: gallery_items + documents.
--
--   PRO gate (app.is_club_pro): club A holds an ACTIVE pro entitlement (seed:
--   metadata tier=pro,status=active) -> members read, trainers curate. Club B
--   holds a NON-pro entitlement -> the modules are invisible AND unwritable
--   there, even for its owner (a trainer). This isolates the entitlement gate
--   from the ordinary member/trainer gate.
--
-- Seed baseline for club A: 4 gallery items + 3 documents.
-- Personas: coach Sandra 90..01/a-01 (trainer), member Katrin 90..09/a-09,
-- treasurer Beate 90..03/a-03 (member, NOT a trainer), platform admin 90..90,
-- club B owner deadbeef-90..01 (trainer of the non-pro club).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- MEMBER Katrin (a-09) — club A is PRO, so she READS gallery + documents, but
-- as a non-trainer she may NOT curate them. Proves read = member + PRO.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('pro-gate: is_club_pro(club A) is true (active pro entitlement)',
    (select case when app.is_club_pro('c1ab0000-0000-4000-8000-000000000001') then 1 else 0 end), 1);

  perform testkit.is_eq('gallery: member reads the 4 seeded items (PRO club)',
    (select count(*) from app.gallery_items), 4);
  perform testkit.is_eq('documents: member reads the 3 seeded documents (PRO club)',
    (select count(*) from app.documents), 3);

  -- a plain member is not a trainer -> no curate (RLS with check -> 42501)
  perform testkit.throws('gallery: member MAY NOT add an item (not a trainer)',
    $q$insert into app.gallery_items
        (club_id, title, kind, storage_key, content_type, size_bytes, uploaded_by_member_id)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Hack', 'photo',
               'hack-key-01.png', 'image/png', 10,
               'a0000000-0000-4000-8000-000000000009')$q$, '42501');
  perform testkit.throws('documents: member MAY NOT add a document (not a trainer)',
    $q$insert into app.documents
        (club_id, title, category, storage_key, content_type, size_bytes, uploaded_by_member_id)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Hack', 'allgemein',
               'hack-doc-01.pdf', 'application/pdf', 10,
               'a0000000-0000-4000-8000-000000000009')$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- COACH Sandra (a-01) — trainer of the PRO club: reads, adds and soft-deletes.
-- Proves write = trainer + PRO.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.succeeds('gallery: coach MAY add an item (trainer + PRO)',
    $q$insert into app.gallery_items
        (club_id, title, kind, storage_key, content_type, size_bytes, uploaded_by_member_id)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Neues Foto', 'photo',
               'coach-upload-01.png', 'image/png', 10,
               'a0000000-0000-4000-8000-000000000001')$q$);
  perform testkit.succeeds('documents: coach MAY add a document (trainer + PRO)',
    $q$insert into app.documents
        (club_id, title, category, storage_key, content_type, size_bytes, uploaded_by_member_id)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Protokoll', 'Protokoll',
               'coach-doc-01.pdf', 'application/pdf', 10,
               'a0000000-0000-4000-8000-000000000001')$q$);
  -- soft-delete a seeded gallery item (the UPDATE policy = trainer + PRO)
  perform testkit.affects('gallery: coach MAY soft-delete a seeded item (1 row)',
    $q$update app.gallery_items set deleted_at = now()
        where id = '6a110000-0000-4000-8000-000000000001'$q$, 1);
  perform testkit.affects('documents: coach MAY soft-delete a seeded document (1 row)',
    $q$update app.documents set deleted_at = now()
        where id = 'd0c00000-0000-4000-8000-000000000001'$q$, 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- TREASURER Beate (a-03) — a member but NOT a trainer: reads the PRO modules,
-- never curates them.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('gallery: treasurer reads the 4 items', (select count(*) from app.gallery_items), 4);
  perform testkit.throws('gallery: treasurer MAY NOT add an item (not a trainer)',
    $q$insert into app.gallery_items
        (club_id, title, kind, storage_key, content_type, size_bytes, uploaded_by_member_id)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Nope', 'photo',
               'treasurer-key-01.png', 'image/png', 10,
               'a0000000-0000-4000-8000-000000000003')$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- NON-PRO club B — the ENTITLEMENT gate in isolation. A gallery row is planted
-- as service_role (bypasses RLS); the club B OWNER (a member AND a trainer of
-- his club) still sees NOTHING and cannot write, purely because is_club_pro is
-- false. This is the PRO gate, not the member/trainer gate.
-- ---------------------------------------------------------------------------
begin;
set local role service_role;
insert into app.gallery_items
  (id, club_id, title, kind, storage_key, content_type, size_bytes, uploaded_by_member_id)
values
  ('6a11beef-0000-4000-8000-000000000001', 'deadbeef-0000-4000-8000-000000000001',
   'Verstecktes Foto', 'photo', 'clubb-hidden-01.png', 'image/png', 10,
   'deadbeef-a000-4000-8000-000000000001');
insert into app.documents
  (id, club_id, title, category, storage_key, content_type, size_bytes, uploaded_by_member_id)
values
  ('d0c0beef-0000-4000-8000-000000000001', 'deadbeef-0000-4000-8000-000000000001',
   'Verstecktes Dokument', 'allgemein', 'clubb-hidden-01.pdf', 'application/pdf', 10,
   'deadbeef-a000-4000-8000-000000000001');

reset role;
select set_config('request.jwt.claims',
  '{"sub":"deadbeef-9000-4000-8000-000000000001","role":"authenticated","club_roles":{"deadbeef-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;

do $$
begin
  perform testkit.is_eq('pro-gate: is_club_pro(club B) is false (no pro entitlement)',
    (select case when app.is_club_pro('deadbeef-0000-4000-8000-000000000001') then 1 else 0 end), 0);

  -- owner is a member AND a trainer, yet the PRO gate hides everything
  perform testkit.is_eq('gallery: non-PRO club owner sees 0 items (entitlement gate)',
    (select count(*) from app.gallery_items), 0);
  perform testkit.is_eq('documents: non-PRO club owner sees 0 documents (entitlement gate)',
    (select count(*) from app.documents), 0);

  -- and cannot add despite being a trainer (with check needs is_club_pro)
  perform testkit.throws('gallery: non-PRO club owner MAY NOT add an item (no entitlement)',
    $q$insert into app.gallery_items
        (club_id, title, kind, storage_key, content_type, size_bytes, uploaded_by_member_id)
       values ('deadbeef-0000-4000-8000-000000000001', 'Nope', 'photo',
               'clubb-key-02.png', 'image/png', 10,
               'deadbeef-a000-4000-8000-000000000001')$q$, '42501');
  perform testkit.throws('documents: non-PRO club owner MAY NOT add a document (no entitlement)',
    $q$insert into app.documents
        (club_id, title, category, storage_key, content_type, size_bytes, uploaded_by_member_id)
       values ('deadbeef-0000-4000-8000-000000000001', 'Nope', 'allgemein',
               'clubb-doc-02.pdf', 'application/pdf', 10,
               'deadbeef-a000-4000-8000-000000000001')$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- PLATFORM ADMIN (90..90) — cross-club READ: is_club_member AND is_club_pro
-- both short-circuit true, so the platform admin reads club A's PRO modules
-- (4 gallery + 3 documents), but is NOT a trainer -> no writes.
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
  perform testkit.is_eq('pro-gate: is_club_pro(club A) is true for a platform admin',
    (select case when app.is_club_pro('c1ab0000-0000-4000-8000-000000000001') then 1 else 0 end), 1);
  -- 0075: ZUGEGANGEN. Galerie und Dokumente sind „Inhalte des Vereins, oft mit
  -- Kinderfotos" (0074) — 'gallery' und 'documents' sind nicht freigegeben.
  -- Der PRO-Gate darueber bleibt offen: die Lizenzfrage ist Betrieb.
  perform testkit.is_eq('gallery: platform admin sieht 0 Bilder (0075)',
    (select count(*) from app.gallery_items
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 0);
  perform testkit.is_eq('documents: platform admin sieht 0 Dokumente (0075)',
    (select count(*) from app.documents
      where club_id = 'c1ab0000-0000-4000-8000-000000000001'), 0);
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
  perform testkit.throws('gallery: platform admin MAY NOT add an item (not a trainer)',
    $q$insert into app.gallery_items
        (club_id, title, kind, storage_key, content_type, size_bytes, uploaded_by_member_id)
       values ('c1ab0000-0000-4000-8000-000000000001', 'Platform', 'photo',
               'platform-key-01.png', 'image/png', 10,
               'a0000000-0000-4000-8000-000000000001')$q$, '42501');
end;
$$;
rollback;
