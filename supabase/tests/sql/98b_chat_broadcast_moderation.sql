-- ============================================================================
-- 98b_chat_broadcast_moderation.sql — Broadcast-Kanal + Moderation (0083)
--
--   * broadcast INSERT: nur reale Vereins-Admins (owner/admin/moderator);
--     coach + member -> 42501. Der Kinderschutz/DM (0043) bleibt unberührt (98a).
--   * broadcast shape: team_id oder recipient gesetzt -> 23514 (shape_check).
--   * broadcast SELECT: jedes reale Vereinsmitglied liest die Ansage.
--   * moderation UPDATE: ein Vereins-Admin (Nicht-Absender) soft-löscht eine
--     FREMDE Nachricht; ein Mitglied nicht (0 Zeilen, RLS filtert).
--   * moderation guard: der Admin darf NUR löschen, nicht fremden Inhalt
--     ändern (Trigger -> P0001).
--   * self-delete: der Absender löscht die eigene Nachricht weiterhin.
--
-- Personas (seed.sql): Jürgen a-02/90..02 owner; Thomas a-04/90..04 admin;
-- Sandra a-01/90..01 coach (b-02/b-03); Katrin a-09/90..09 member (kein Team).
-- Fremd-Team-Nachricht: c4a7..02 (Absenderin Maja a-16) im Team b-03; c4a7..01/03
-- sind von Sandra a-01.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- BROADCAST INSERT — wer darf eine vereinsweite Ansage schreiben?
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}', true);
set local role authenticated;
do $$
begin
  perform testkit.succeeds('broadcast: der Inhaber (a-02) DARF eine Ansage senden',
    $q$insert into app.chat_messages (club_id, channel_type, sender_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001','broadcast',
               'a0000000-0000-4000-8000-000000000002','Sommerfest am 12. Juli — bitte anmelden!')$q$);
  -- shape: eine Ansage trägt weder Team noch Empfänger
  perform testkit.throws('broadcast: mit team_id -> Shape-Verletzung (23514)',
    $q$insert into app.chat_messages (club_id, channel_type, team_id, sender_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001','broadcast',
               'b0000000-0000-4000-8000-000000000003',
               'a0000000-0000-4000-8000-000000000002','x')$q$, '23514');
  perform testkit.throws('broadcast: mit recipient -> Shape-Verletzung (23514)',
    $q$insert into app.chat_messages (club_id, channel_type, recipient_member_id, sender_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001','broadcast',
               'a0000000-0000-4000-8000-000000000009',
               'a0000000-0000-4000-8000-000000000002','x')$q$, '23514');
end;
$$;
rollback;

-- admin darf ebenfalls
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"admin"}}', true);
set local role authenticated;
do $$
begin
  perform testkit.succeeds('broadcast: die Verwaltung (a-04, admin) DARF eine Ansage senden',
    $q$insert into app.chat_messages (club_id, channel_type, sender_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001','broadcast',
               'a0000000-0000-4000-8000-000000000004','Hallenschließung wegen Wartung am Freitag')$q$);
end;
$$;
rollback;

-- eine Trainerin darf NICHT (club-weite Ansage ist Admin-Sache)
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}', true);
set local role authenticated;
do $$
begin
  perform testkit.throws('broadcast: eine Trainerin (a-01, coach) darf KEINE Ansage senden (42501)',
    $q$insert into app.chat_messages (club_id, channel_type, sender_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001','broadcast',
               'a0000000-0000-4000-8000-000000000001','x')$q$, '42501');
end;
$$;
rollback;

-- ein Mitglied darf NICHT
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}', true);
set local role authenticated;
do $$
begin
  perform testkit.throws('broadcast: ein Mitglied (a-09) darf KEINE Ansage senden (42501)',
    $q$insert into app.chat_messages (club_id, channel_type, sender_member_id, body)
       values ('c1ab0000-0000-4000-8000-000000000001','broadcast',
               'a0000000-0000-4000-8000-000000000009','x')$q$, '42501');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- BROADCAST SELECT — jedes reale Mitglied liest die Ansage.
-- Ansage als Superuser einspielen (RLS umgangen), dann als Mitglied lesen.
-- ---------------------------------------------------------------------------
begin;
insert into app.chat_messages (id, club_id, channel_type, sender_member_id, body)
  values ('c4a70000-0000-4000-8000-0000000000b1','c1ab0000-0000-4000-8000-000000000001',
          'broadcast','a0000000-0000-4000-8000-000000000002','Vereins-Ansage zum Test');
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}', true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('broadcast: ein einfaches Mitglied (a-09) SIEHT die Ansage',
    (select count(*) from app.chat_messages
       where channel_type='broadcast' and id='c4a70000-0000-4000-8000-0000000000b1'), 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- MODERATION — Admin löscht FREMDE Nachricht (soft), Mitglied nicht.
-- Zielnachricht: c4a7..02 (Team b-03, Absenderin Maja a-16).
-- ---------------------------------------------------------------------------
-- ein Mitglied (a-09) kann sie nicht einmal sehen -> 0 Zeilen
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}', true);
set local role authenticated;
do $$
begin
  perform testkit.affects('moderation: ein Mitglied (a-09) kann eine fremde Nachricht NICHT löschen (0 Zeilen)',
    $q$update app.chat_messages set deleted_at = now()
       where id='c4a70000-0000-4000-8000-000000000002' and deleted_at is null$q$, 0);
end;
$$;
rollback;

-- der Inhaber (a-02, Admin) DARF die fremde Team-Nachricht soft-löschen
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}', true);
set local role authenticated;
do $$
begin
  perform testkit.affects('moderation: der Inhaber (a-02) löscht die fremde Team-Nachricht (1 Zeile)',
    $q$update app.chat_messages set deleted_at = now(),
           deleted_by_member_id='a0000000-0000-4000-8000-000000000002'
       where id='c4a70000-0000-4000-8000-000000000002' and deleted_at is null$q$, 1);
  -- aber er darf den FREMDEN Inhalt NICHT umschreiben (Guard -> P0001)
  perform testkit.throws('moderation: der Inhaber darf fremden Text NICHT ändern (Guard P0001)',
    $q$update app.chat_messages set body='(zensiert)'
       where id='c4a70000-0000-4000-8000-000000000003'$q$, 'P0001');
end;
$$;
rollback;

-- self-delete: der Absender löscht die eigene Nachricht weiterhin
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}', true);
set local role authenticated;
do $$
begin
  perform testkit.affects('moderation/self: die Absenderin (a-01) löscht die EIGENE Nachricht (1 Zeile)',
    $q$update app.chat_messages set deleted_at = now()
       where id='c4a70000-0000-4000-8000-000000000001' and deleted_at is null$q$, 1);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- UNVERÄNDERLICHKEIT (adversarialer Fund): der Absender darf seine eigene,
-- erlaubte Nachricht NICHT per UPDATE „ummorphen" und so die INSERT-Schranken
-- (Kinderschutz 0043, Tenancy, Broadcast-Admin-Gate) umgehen.
-- ---------------------------------------------------------------------------
-- Erwachsene Beate (a-03): erlaubte adult->adult-DM anlegen, dann umbiegen.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}', true);
set local role authenticated;
do $$
begin
  perform testkit.succeeds('immutable/setup: Beate (a-03) darf eine adult->adult-DM anlegen',
    $q$insert into app.chat_messages (id, club_id, channel_type, sender_member_id, recipient_member_id, body)
       values ('d3000000-0000-4000-8000-000000000099','c1ab0000-0000-4000-8000-000000000001','direct',
               'a0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','hallo Sandra')$q$);
  -- DER KERNANGRIFF: Empfänger auf ein KIND (a-16) umbiegen -> Kinderschutz-Guard
  perform testkit.throws('immutable: Absender kann recipient NICHT auf ein Kind (a-16) umbiegen (P0001)',
    $q$update app.chat_messages set recipient_member_id='a0000000-0000-4000-8000-000000000016'
       where id='d3000000-0000-4000-8000-000000000099'$q$, 'P0001');
  perform testkit.throws('immutable: Absender kann channel_type NICHT auf broadcast heben (P0001)',
    $q$update app.chat_messages set channel_type='broadcast', recipient_member_id=null
       where id='d3000000-0000-4000-8000-000000000099'$q$, 'P0001');
  perform testkit.throws('immutable: Absender kann den eigenen Text NICHT nachträglich ändern (P0001)',
    $q$update app.chat_messages set body='(geaendert)'
       where id='d3000000-0000-4000-8000-000000000099'$q$, 'P0001');
end;
$$;
rollback;

-- Mitglied a-09: eigene DM nicht in einen fremden Verein umhängen (Tenancy).
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}', true);
set local role authenticated;
do $$
begin
  perform testkit.succeeds('immutable/setup: Katrin (a-09) legt eine adult->adult-DM an',
    $q$insert into app.chat_messages (id, club_id, channel_type, sender_member_id, recipient_member_id, body)
       values ('d3000000-0000-4000-8000-000000000098','c1ab0000-0000-4000-8000-000000000001','direct',
               'a0000000-0000-4000-8000-000000000009','a0000000-0000-4000-8000-000000000001','kurze Frage')$q$);
  perform testkit.throws('immutable: Absender kann club_id NICHT auf einen fremden Verein setzen (P0001)',
    $q$update app.chat_messages set club_id='c2ab0000-0000-4000-8000-000000000002'
       where id='d3000000-0000-4000-8000-000000000098'$q$, 'P0001');
end;
$$;
rollback;

-- Owner a-02: kein Wiederbeleben, kein Fälschen des deleted_by-Audits.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}', true);
set local role authenticated;
do $$
begin
  perform testkit.affects('immutable/setup: Owner soft-löscht eine fremde Team-Nachricht',
    $q$update app.chat_messages set deleted_at = now(),
           deleted_by_member_id='a0000000-0000-4000-8000-000000000002'
       where id='c4a70000-0000-4000-8000-000000000002' and deleted_at is null$q$, 1);
  perform testkit.throws('immutable: eine gelöschte Nachricht kann NICHT wiederbelebt werden (P0001)',
    $q$update app.chat_messages set deleted_at = null
       where id='c4a70000-0000-4000-8000-000000000002'$q$, 'P0001');
  perform testkit.throws('immutable: deleted_by kann NICHT auf eine fremde (kindliche) ID gefälscht werden (P0001)',
    $q$update app.chat_messages set deleted_by_member_id='a0000000-0000-4000-8000-000000000016'
       where id='c4a70000-0000-4000-8000-000000000002'$q$, 'P0001');
end;
$$;
rollback;
