-- ============================================================================
-- 99pA_trainer_notiz.sql — die INTERNE Trainer-Notiz (Migration 0069).
--
-- WARUM DIESE DATEI
-- ---------------------------------------------------------------------------
-- Die Vorgabe des Chefs ist eine AUSSCHLIESSUNG, und eine Ausschliessung kann
-- man nicht dadurch belegen, dass man sie hinschreibt. Sie ist nur so viel wert
-- wie die Messung, die sie NACHSTELLT. Diese Datei misst deshalb jede Zeile der
-- Vorgabe an echten Zeilen, und zu jedem "sieht nichts" gehoert eine
-- GEGENPROBE, die zeigt, dass ueberhaupt etwas zu sehen gewesen waere. Ohne
-- Gegenprobe waere jede 0 wertlos: eine leere Tabelle bestuende jeden Test.
--
--   A) Voreinstellung der Rechte-Matrix — Rolle fuer Rolle.
--   B) DER KERN: die FAMILIE sieht nichts. Mutter, und die betroffene Person
--      selbst. Beide mit Gegenprobe.
--   C) DER SCHAERFSTE FALL: Petra ist MODERATORIN (vereinsweit 'manage') UND
--      Finns Mutter. Sie liest die Notizen des ganzen Vereins — die ueber ihren
--      EIGENEN Sohn NICHT. Der Familien-Ausschluss schlaegt die Leitungsrolle.
--   D) Trainer:in des Mitglieds liest und schreibt; FREMDE Trainerin nicht.
--   E) guest_coach nicht (strukturell UND per Voreinstellung).
--   F) treasurer nicht — VOREINSTELLUNG, nicht Naturgesetz: derselbe Block
--      zeigt, dass der Verein es umstellen KANN.
--   G) fremder Verein nicht (Mandantentrennung).
--   H) Das Etikett 'enforced' ist verdient: Stufe 'none' nimmt das Lesen WEG.
--   I) Autor:in ist unveraenderlich; Fremd-Autorschaft wird abgewiesen.
--   J) Loeschen ist SOFT — hartes DELETE ist fuer alle zu.
--   K) ABGRENZUNG: 0055 (Beurteilung) und 0008 (persoenliche Notiz) sind
--      UNVERAENDERT. Die Familie liest die Beurteilung weiterhin — haette diese
--      Migration daran gedreht, faellt dieser Block.
--
-- Personas (seed), Verein A = c1ab..01:
--   Sandra    90..01 / a-01  coach       (Teams t-02 + t-03) — Autorin der Seed-Notizen
--   Juergen   90..02 / a-02  owner
--   Beate     90..03 / a-03  treasurer
--   Thomas    90..04 / a-04  admin
--   Anna-Lena 90..05 / a-05  coach       (Teams t-01 + t-02)
--   Milena    90..06 / a-06  guest_coach (Team t-03)
--   Katrin    90..09 / a-09  member      — Mutter von Lina (a-07) und Emma (a-08)
--   Stefanie  90..12 / a-12  member      — Mutter von Sofia/Ben, fremd zu Lina
--   Petra     90..14 / a-14  moderator   — UND Mutter von Finn (a-13)
-- Kinder: Lina a-07 (t-02) · Finn a-13 (t-02) · Maja a-16 (NUR t-03)
-- Seed-Notizen (0069): ueber Lina (a-07) und ueber Finn (a-13), beide von Sandra.
-- Verein B = deadbeef-00..01, Owner Bert deadbeef-90..01 (01_fixture_club_b.sql).
--
-- Diese Datei ist NEU. Bestands-Tests bleiben unberuehrt.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) Die Voreinstellung in der konfigurierbaren Rechte-Matrix.
--    Das ist die Vorgabe des Chefs, Rolle fuer Rolle, als Messung.
-- ---------------------------------------------------------------------------
begin;
do $$
begin
  perform testkit.is_eq('notiz-rbac: die Faehigkeit coach_notes steht im Katalog',
    (select count(*) from app.capabilities where key = 'coach_notes'), 1);

  -- Nur vier Stufen, jede mit eigener Wirkung. 'read_own'/'read_all' fehlen
  -- absichtlich (siehe Kopf von 0069) — eine angebotene Stufe ohne eigene
  -- Wirkung waere ein Versprechen, das der Server nicht einloest.
  perform testkit.is_eq('notiz-rbac: genau vier waehlbare Stufen (none/read_team/edit/manage)',
    (select count(*) from app.capabilities
      where key = 'coach_notes'
        and allowed_levels = '{none,read_team,edit,manage}'::app.role_level[]), 1);

  -- Die Voreinstellung, Rolle fuer Rolle.
  perform testkit.is_eq('notiz-rbac: VOREINSTELLUNG owner/admin/moderator = manage (vereinsweit)',
    (select count(*) from app.role_permissions rp
      join app.roles r on r.id = rp.role_id
     where rp.club_id = 'c1ab0000-0000-4000-8000-000000000001'
       and rp.capability_key = 'coach_notes'
       and r.key in ('owner', 'admin', 'moderator')
       and rp.level = 'manage'), 3);

  perform testkit.is_eq('notiz-rbac: VOREINSTELLUNG coach = edit (lesen+schreiben, teamgebunden)',
    (select count(*) from app.role_permissions rp
      join app.roles r on r.id = rp.role_id
     where rp.club_id = 'c1ab0000-0000-4000-8000-000000000001'
       and rp.capability_key = 'coach_notes' and r.key = 'coach'
       and rp.level = 'edit'), 1);

  -- Die ausdrueckliche Anweisung: der KASSENWART liest voreingestellt NICHT.
  perform testkit.is_eq('notiz-rbac: VOREINSTELLUNG treasurer/member/guest_coach = none',
    (select count(*) from app.role_permissions rp
      join app.roles r on r.id = rp.role_id
     where rp.club_id = 'c1ab0000-0000-4000-8000-000000000001'
       and rp.capability_key = 'coach_notes'
       and r.key in ('treasurer', 'member', 'guest_coach')
       and rp.level = 'none'), 3);

  -- Der Seed hat etwas zu sehen — sonst waeren alle Nullen unten wertlos.
  perform testkit.is_eq('notiz-seed: es gibt 2 interne Notizen im Demo-Verein',
    (select count(*) from app.member_coach_notes where deleted_at is null), 2);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B) DER KERN, TEIL 1: die ELTERN sehen nichts.
--    Katrin ist Linas Mutter; ueber Lina existiert eine Notiz.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('notiz-familie: die MUTTER (Katrin) sieht die Notiz ueber ihre Tochter Lina NICHT',
    (select count(*) from app.member_coach_notes
      where member_id = 'a0000000-0000-4000-8000-000000000007' and deleted_at is null), 0);

  perform testkit.is_eq('notiz-familie: die Mutter sieht ueberhaupt KEINE interne Notiz',
    (select count(*) from app.member_coach_notes where deleted_at is null), 0);

  -- Und sie kann auch keine anlegen (weder ueber ihr Kind noch sonst).
  perform testkit.throws('notiz-familie: die Mutter legt ueber ihr Kind KEINE interne Notiz an',
    $q$insert into app.member_coach_notes (club_id, member_id, author_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000007',
               'a0000000-0000-4000-8000-000000000009', 'Versuch.')$q$,
    '42501');
end;
$$;
reset role;
-- GEGENPROBE: dieselbe Zeile ist fuer die Trainerin sehr wohl da. Ohne diese
-- Zeile koennte die 0 oben auch bedeuten "es gibt gar nichts".
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('notiz-familie GEGENPROBE: die Trainerin sieht die Notiz ueber Lina sehr wohl',
    (select count(*) from app.member_coach_notes
      where member_id = 'a0000000-0000-4000-8000-000000000007' and deleted_at is null), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B) DER KERN, TEIL 2: die BETROFFENE PERSON SELBST sieht nichts.
--    Die Seed-Kinder haben keinen Login (profile_id is null), deshalb wird der
--    Fall an Katrin gemessen — einer Erwachsenen MIT Login, ueber die hier eine
--    Notiz angelegt wird. can_act_for_member deckt beide Zweige ab
--    (profile_id = auth.uid() UND Guardianship); dieser Block prueft den ersten.
-- ---------------------------------------------------------------------------
begin;
insert into app.member_coach_notes (club_id, member_id, author_member_id, body) values
  ('c1ab0000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000009',   -- ueber Katrin selbst
   'a0000000-0000-4000-8000-000000000004',   -- Autor: Thomas (admin)
   'Interne Notiz ueber eine Erwachsene mit Login.');
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('notiz-selbst: die BETROFFENE PERSON sieht die Notiz ueber sich selbst NICHT',
    (select count(*) from app.member_coach_notes
      where member_id = 'a0000000-0000-4000-8000-000000000009' and deleted_at is null), 0);
end;
$$;
reset role;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('notiz-selbst GEGENPROBE: der Vorstand sieht genau diese Notiz',
    (select count(*) from app.member_coach_notes
      where member_id = 'a0000000-0000-4000-8000-000000000009' and deleted_at is null), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- C) DER SCHAERFSTE FALL — Leitungsrolle UND Elternteil in einer Person.
--
--    Petra ist Moderatorin (coach_notes = 'manage', also vereinsweit) und
--    zugleich Finns Mutter. Wenn der Familien-Ausschluss irgendwo bricht, dann
--    hier: die Rolle sagt "alles", die Elternschaft sagt "dieses nicht".
--    Erwartung: sie sieht die Notiz ueber Lina (fremdes Kind), die ueber ihren
--    eigenen Sohn Finn NICHT — also GENAU 1 von 2.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000014","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"moderator"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('notiz-leitung: die Moderatorin sieht die Notiz ueber ein FREMDES Kind (Lina)',
    (select count(*) from app.member_coach_notes
      where member_id = 'a0000000-0000-4000-8000-000000000007' and deleted_at is null), 1);

  -- DAS IST DER SATZ, AUF DEN ES ANKOMMT.
  perform testkit.is_eq('notiz-leitung: dieselbe Moderatorin sieht die Notiz ueber IHREN EIGENEN SOHN Finn NICHT',
    (select count(*) from app.member_coach_notes
      where member_id = 'a0000000-0000-4000-8000-000000000013' and deleted_at is null), 0);

  perform testkit.is_eq('notiz-leitung: vereinsweit also 1 von 2 — die Elternschaft schlaegt die Leitungsrolle',
    (select count(*) from app.member_coach_notes where deleted_at is null), 1);

  -- Und sie darf ueber den eigenen Sohn auch nichts SCHREIBEN.
  perform testkit.throws('notiz-leitung: die Moderatorin schreibt ueber ihren eigenen Sohn NICHT',
    $q$insert into app.member_coach_notes (club_id, member_id, author_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000013',
               'a0000000-0000-4000-8000-000000000014', 'Versuch.')$q$,
    '42501');

  -- Gegenprobe: ueber ein fremdes Kind darf sie sehr wohl schreiben — sonst
  -- laege der Fehler an der Rolle, nicht an der Elternschaft.
  perform testkit.succeeds('notiz-leitung GEGENPROBE: ueber ein fremdes Kind schreibt sie sehr wohl',
    $q$insert into app.member_coach_notes (club_id, member_id, author_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000007',
               'a0000000-0000-4000-8000-000000000014', 'Fremdes Kind, erlaubt.')$q$);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- D) Die Trainer:in DES MITGLIEDS liest und schreibt — die FREMDE nicht.
--    Maja (a-16) turnt NUR in t-03. Sandra betreut t-03, Anna-Lena nicht.
-- ---------------------------------------------------------------------------
begin;
insert into app.member_coach_notes (club_id, member_id, author_member_id, body) values
  ('c1ab0000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000016', 'a0000000-0000-4000-8000-000000000001',
   'Maja: Landung Rittberger intern beobachten.');

select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000005","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('notiz-trainer: die FREMDE Trainerin (Anna-Lena, t-01/t-02) liest die Notiz ueber Maja (t-03) NICHT',
    (select count(*) from app.member_coach_notes
      where member_id = 'a0000000-0000-4000-8000-000000000016' and deleted_at is null), 0);

  perform testkit.throws('notiz-trainer: die FREMDE Trainerin schreibt ueber Maja (t-03) NICHT',
    $q$insert into app.member_coach_notes (club_id, member_id, author_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000016',
               'a0000000-0000-4000-8000-000000000005', 'Versuch.')$q$,
    '42501');
end;
$$;
reset role;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('notiz-trainer GEGENPROBE: Sandra (betreut t-03) liest die Notiz ueber Maja sehr wohl',
    (select count(*) from app.member_coach_notes
      where member_id = 'a0000000-0000-4000-8000-000000000016' and deleted_at is null), 1);

  perform testkit.succeeds('notiz-trainer: die Trainerin DES MITGLIEDS schreibt ueber Lina (t-02)',
    $q$insert into app.member_coach_notes (club_id, member_id, author_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000007',
               'a0000000-0000-4000-8000-000000000001', 'Neue interne Notiz.')$q$);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- E) guest_coach: NICHT. Milena betreut t-03 (Maja) und faellt trotzdem durch.
--    Zwei UNABHAENGIGE Gruende, beide gemessen:
--      (1) Voreinstellung guest_coach = 'none'
--      (2) app.coaches_member_bound verlangt die club-Rolle 'coach'
--    (2) wird nachgewiesen, indem (1) AUFGEHOBEN wird: selbst mit Stufe 'edit'
--    kommt sie ueber den Team-Zweig nicht heran. Ohne diesen Kniff wuerde der
--    Test nur (1) belegen und (2) bliebe eine Behauptung.
-- ---------------------------------------------------------------------------
begin;
insert into app.member_coach_notes (club_id, member_id, author_member_id, body) values
  ('c1ab0000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000016', 'a0000000-0000-4000-8000-000000000001',
   'Maja: interne Notiz.');
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000006","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"guest_coach"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('notiz-gast: die GASTTRAINERIN liest die Notiz ueber ihr eigenes Teammitglied NICHT',
    (select count(*) from app.member_coach_notes
      where member_id = 'a0000000-0000-4000-8000-000000000016' and deleted_at is null), 0);

  perform testkit.throws('notiz-gast: die Gasttrainerin schreibt keine interne Notiz',
    $q$insert into app.member_coach_notes (club_id, member_id, author_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000016',
               'a0000000-0000-4000-8000-000000000006', 'Versuch.')$q$,
    '42501');
end;
$$;
reset role;
-- Jetzt (1) aufheben: guest_coach bekommt ausdruecklich 'edit'.
update app.role_permissions rp set level = 'edit'
  from app.roles r
 where r.id = rp.role_id and r.key = 'guest_coach'
   and rp.capability_key = 'coach_notes'
   and rp.club_id = 'c1ab0000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000006","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"guest_coach"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('notiz-gast: SELBST MIT Stufe edit kommt die Gasttrainerin ueber den Team-Zweig nicht heran (coaches_member_bound)',
    (select count(*) from app.member_coach_notes
      where member_id = 'a0000000-0000-4000-8000-000000000016' and deleted_at is null), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- F) Der KASSENWART: voreingestellt NICHT — aber umstellbar.
--    Beides gehoert in denselben Block, weil beides zusammen die Vorgabe ist:
--    "Voreinstellung treasurer liest nicht" UND "der Verein kann es selbst
--    umstellen". Ein Test nur fuer die erste Haelfte wuerde die zweite zur
--    unbelegten Behauptung machen.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('notiz-kasse: der KASSENWART liest voreingestellt KEINE interne Notiz',
    (select count(*) from app.member_coach_notes where deleted_at is null), 0);

  perform testkit.throws('notiz-kasse: der Kassenwart schreibt keine interne Notiz',
    $q$insert into app.member_coach_notes (club_id, member_id, author_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000007',
               'a0000000-0000-4000-8000-000000000003', 'Versuch.')$q$,
    '42501');
end;
$$;
reset role;
-- Der Verein stellt es im Admin-UI um (role_permissions ist genau diese Matrix).
update app.role_permissions rp set level = 'manage'
  from app.roles r
 where r.id = rp.role_id and r.key = 'treasurer'
   and rp.capability_key = 'coach_notes'
   and rp.club_id = 'c1ab0000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('notiz-kasse: nach Umstellung auf manage liest er die 2 Notizen — die Voreinstellung ist eine ENTSCHEIDUNG, kein Naturgesetz',
    (select count(*) from app.member_coach_notes where deleted_at is null), 2);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- G) Mandantentrennung: der fremde Verein sieht nichts.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"deadbeef-9000-4000-8000-000000000001","role":"authenticated","club_roles":{"deadbeef-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('notiz-mandant: der Owner des FREMDEN Vereins sieht keine Notiz aus Verein A',
    (select count(*) from app.member_coach_notes where deleted_at is null), 0);

  perform testkit.throws('notiz-mandant: er kann auch keine in Verein A anlegen',
    $q$insert into app.member_coach_notes (club_id, member_id, author_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000007',
               'a0000000-0000-4000-8000-000000000001', 'Versuch.')$q$,
    '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- H) Das Etikett 'enforced' ist VERDIENT: die Stufe wirkt auf das LESEN.
--    0033 verlangt, dass eine lese-durchsetzende Faehigkeit eine SELECT-Policy
--    vorweist (Test 93j Block C). Hier wird zusaetzlich die WIRKUNG gemessen:
--    Stufe 'none' -> die Trainerin sieht wirklich 0 Zeilen.
-- ---------------------------------------------------------------------------
begin;
do $$
begin
  perform testkit.is_eq('notiz-etikett: coach_notes ist als "enforced" eingestuft',
    (select count(*) from app.capabilities
      where key = 'coach_notes' and enforcement = 'enforced'), 1);

  perform testkit.is_eq('notiz-etikett: die Nachrechnung findet coach_notes in einer SELECT-Policy',
    (select count(*) from app.capability_policy_usage()
      where capability_key = 'coach_notes' and cmd = 'SELECT'), 1);
end;
$$;
update app.role_permissions rp set level = 'none'
  from app.roles r
 where r.id = rp.role_id and r.key = 'coach'
   and rp.capability_key = 'coach_notes'
   and rp.club_id = 'c1ab0000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('notiz-etikett: Stufe "keine" nimmt der Trainerin das Lesen WIRKLICH weg (nicht nur die Kachel)',
    (select count(*) from app.member_coach_notes where deleted_at is null), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- I) Zurechenbarkeit: Autorenfeld faelschen geht nicht, und nachtraeglich
--    umschreiben auch nicht. Bei einer Notiz, die die Betroffene NICHT sieht,
--    wiegt eine Falschzuordnung doppelt — sie kann ihr nicht widersprechen.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.throws('notiz-autor: Sandra kann keine Notiz IM NAMEN von Anna-Lena anlegen',
    $q$insert into app.member_coach_notes (club_id, member_id, author_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000007',
               'a0000000-0000-4000-8000-000000000005', 'Fremde Autorschaft.')$q$,
    '42501');

  -- Die betroffene Person nachtraeglich austauschen: der Trigger haelt dagegen.
  perform testkit.throws('notiz-autor: member_id/author_member_id sind nach dem Anlegen unveraenderlich',
    $q$update app.member_coach_notes
          set member_id = 'a0000000-0000-4000-8000-000000000016'
        where member_id = 'a0000000-0000-4000-8000-000000000007'$q$,
    'P0001');

  -- Aendern des Rumpfes durch die Autorin ist erlaubt (Gegenprobe: der Trigger
  -- sperrt nicht pauschal alles).
  perform testkit.succeeds('notiz-autor GEGENPROBE: die Autorin darf den Text ihrer Notiz aendern',
    $q$update app.member_coach_notes set body = 'Ueberarbeitet.'
        where member_id = 'a0000000-0000-4000-8000-000000000007'$q$);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- J) Loeschen ist SOFT. Hartes DELETE ist fuer alle zu (deny-by-default:
--    es gibt bewusst keine DELETE-Policy).
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
do $$
declare
  v_deleted bigint;
begin
  -- Hartes DELETE: keine DELETE-Policy => RLS filtert alle Zeilen weg, das
  -- Statement laeuft durch und loescht NICHTS. Der Beleg ist die betroffene
  -- Zeilenzahl, nicht eine Ausnahme.
  delete from app.member_coach_notes
   where member_id = 'a0000000-0000-4000-8000-000000000007';
  get diagnostics v_deleted = row_count;
  perform testkit.is_eq('notiz-loeschen: hartes DELETE loescht auch fuer die Autorin KEINE Zeile',
    v_deleted, 0);

  perform testkit.succeeds('notiz-loeschen: SOFT-Delete durch die Autorin geht',
    $q$update app.member_coach_notes set deleted_at = now()
        where member_id = 'a0000000-0000-4000-8000-000000000007'$q$);

  perform testkit.is_eq('notiz-loeschen: die soft-geloeschte Notiz ist aus der Liste verschwunden',
    (select count(*) from app.member_coach_notes
      where member_id = 'a0000000-0000-4000-8000-000000000007' and deleted_at is null), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- K) ABGRENZUNG — die beiden BESTEHENDEN Dinge sind unveraendert.
--    Der Auftrag war ausdruecklich: nicht verwechseln, nicht ersetzen. Wenn
--    diese Migration an 0055 oder 0008 gedreht haette, faellt dieser Block.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
begin
  -- 0055: die Mutter liest die BEURTEILUNG ihrer Toechter weiterhin. Das ist
  -- die bewusste Entscheidung des Chefs (Auskunftsrecht) und darf nicht als
  -- Nebenwirkung dieser Migration verschwinden.
  perform testkit.is_eq('abgrenzung: die Mutter liest die BEURTEILUNGEN ihrer Toechter weiterhin (0055 unveraendert)',
    (select count(*) from app.member_assessments
      where member_id in ('a0000000-0000-4000-8000-000000000007',
                          'a0000000-0000-4000-8000-000000000008')
        and deleted_at is null), 2);
end;
$$;
reset role;
do $$
begin
  -- 0008: app.notes bleibt der persoenliche Zettel — eigene Tabelle, eigene
  -- Policy. Nachgewiesen ueber die Policy-DEFINITION, nicht ueber Zeilen:
  -- der Lese-Filter ist WOERTLICH owner_profile_id = auth.uid(), also weder
  -- aufgeweicht noch um einen Trainer-Zweig ergaenzt. Bewusst der exakte
  -- Ausdruck statt eines like-Zaehlers: ein Zaehler bliebe auch dann gruen,
  -- wenn jemand ein "oder ..." danebenhaengt.
  perform testkit.is_eq('abgrenzung: app.notes liest weiterhin NUR die Autorin selbst (0008 unveraendert)',
    (select count(*) from pg_policies
      where schemaname = 'app' and tablename = 'notes'
        and policyname = 'notes_select'
        and qual = '(owner_profile_id = auth.uid())'), 1);

  -- Und die drei sind wirklich drei getrennte Tabellen.
  perform testkit.is_eq('abgrenzung: notes, member_assessments und member_coach_notes sind DREI Tabellen',
    (select count(*) from pg_tables
      where schemaname = 'app'
        and tablename in ('notes', 'member_assessments', 'member_coach_notes')), 3);
end;
$$;
rollback;
