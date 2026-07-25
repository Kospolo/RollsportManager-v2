-- ============================================================================
-- 0082_chat_meldungen.sql — Verstoss im Chat melden (Meldesystem).
--
-- ### DER ANLASS ###
-- Der Chat (0011: app.chat_messages, Team-Kanäle + 1:1-Direktnachrichten) hat
-- bisher NUR das Löschen der EIGENEN Nachricht gekannt. Was fehlte: der Weg,
-- eine FREMDE Nachricht als Verstoss zu MELDEN — an den, der im Verein dafür
-- zuständig ist. In einem Verein voller Kinder (siehe 0043) ist das keine Kür.
--
-- ### WAS HIER ENTSTEHT ###
-- app.chat_reports — eine Meldung je gemeldeter Nachricht. Sie geht an den
-- VEREINSVORSTAND (owner/admin/moderator = app.is_club_admin, wie 0052) UND an
-- den BETREIBER (app.is_platform_admin). Ein einfaches Mitglied — auch die
-- gemeldete Person — sieht KEINE Meldung. Der MELDER darf seine EIGENE Meldung
-- sehen (sonst könnte POST /chat/reports ihre 201-Antwort gar nicht liefern:
-- INSERT ... RETURNING ist unter RLS an die SELECT-Policy gebunden, empirisch
-- geprüft — ohne Selbst-Sicht schlägt schon das Anlegen fehl). Die gemeldete
-- Person und unbeteiligte Mitglieder bleiben aussen vor — genau das meint
-- „niemand sonst".
--
-- ### GoBD-ARTIG: DIE MELDUNG SELBST IST ANHÄNGEND ###
-- Der KERN einer Meldung (reason, snapshot, message_id, wer wen, IP, Zeitpunkt)
-- ist nach dem Anlegen UNVERÄNDERLICH — ein Beleg, den eine Seite nachträglich
-- umschreiben kann, ist als Nachweis wertlos. Bearbeitet werden darf NUR der
-- Bearbeitungsstand: status + handled_by/handled_at. Erzwungen vom Trigger
-- app.chat_report_guard_update(). Kein DELETE für irgendwen (deny-by-default);
-- Löschen (DSGVO Art. 17) liefe wie im Rest des Hauses über den Service-Mode.
--
-- ### DER SNAPSHOT — WARUM ÜBERHAUPT ###
-- snapshot hält den Nachrichtentext + ein paar Kontextnachrichten + den
-- Zeitpunkt der Aufnahme fest. Damit bleibt die Meldung LESBAR, auch wenn die
-- gemeldete Nachricht später (soft-)gelöscht wird. Gebaut wird er SERVERSEITIG
-- unter den Claims des Melders (routes/chat.ts) — er kann also nur aufnehmen,
-- was er ohnehin sehen darf. Ebenso setzt der SERVER reporter_ip aus der
-- Anfrage (lib/rate-limit.ts clientIp) — NIE der Client.
--
-- ### message_id ON DELETE SET NULL ###
-- Wird die gemeldete Nachricht je HART gelöscht, bleibt die Meldung erhalten
-- (der Inhalt steckt im snapshot). Deshalb nullable + set null, statt cascade.
-- Dieselbe Überlegung für reported_member_id (Person könnte DSGVO-gelöscht
-- werden). reporter_member_id bleibt PFLICHT: eine Meldung ohne Melder wäre
-- keine Meldung — deshalb on delete restrict (Mitglieder werden ohnehin
-- soft-gelöscht, ein echtes Hart-Löschen ist der Ausnahmefall).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Enum: der Bearbeitungsstand einer Meldung.
--   open       : neu, unbearbeitet
--   in_review  : in Bearbeitung
--   resolved   : erledigt (Verstoss bearbeitet)
--   dismissed  : verworfen (kein Verstoss)
-- ----------------------------------------------------------------------------
create type app.chat_report_status as enum ('open', 'in_review', 'resolved', 'dismissed');

comment on type app.chat_report_status is
  'Bearbeitungsstand einer Chat-Meldung: offen / in Bearbeitung / erledigt / verworfen.';

-- ----------------------------------------------------------------------------
-- chat_reports — eine Meldung je gemeldeter Nachricht.
-- ----------------------------------------------------------------------------
create table app.chat_reports (
  id                    uuid primary key default app.uuid_v7(),
  club_id               uuid not null references app.clubs (id) on delete restrict,
  -- Die gemeldete Nachricht. nullable + set null: die Meldung überlebt ein
  -- Hart-Löschen der Nachricht (Inhalt bleibt im snapshot).
  message_id            uuid references app.chat_messages (id) on delete set null,
  -- Wer gemeldet WURDE (der Absender der gemeldeten Nachricht). Vom Server
  -- gesetzt, nicht vom Client. set null: überlebt DSGVO-Löschung der Person.
  reported_member_id    uuid references app.club_members (id) on delete set null,
  -- Wer gemeldet HAT. Pflicht — eine Meldung ohne Melder ist keine Meldung.
  reporter_member_id    uuid not null references app.club_members (id) on delete restrict,
  reason                text not null,
  -- Vom SERVER aus der Anfrage gesetzt (clientIp), nie vom Client. Fälschbar
  -- wie jede x-forwarded-for-Angabe (siehe lib/rate-limit.ts) — die IP ist ein
  -- Hinweis, kein Beweis. nullable: direkte Aufrufe tragen keine.
  reporter_ip           text,
  -- Nachrichtentext + Kontext + Aufnahmezeit; serverseitig gebaut. Damit bleibt
  -- die Meldung lesbar, auch wenn die Nachricht später gelöscht wird.
  snapshot              jsonb not null default '{}'::jsonb,
  status                app.chat_report_status not null default 'open',
  -- Wer die Meldung bearbeitet hat. Betreiber haben keine club_members-Zeile
  -- (seed.sql) -> dann null. set null: überlebt Löschung der Person.
  handled_by_member_id  uuid references app.club_members (id) on delete set null,
  handled_at            timestamptz,
  created_at            timestamptz not null default now(),
  constraint chat_reports_reason_not_blank check (btrim(reason) <> '')
);

create index chat_reports_club_status_idx on app.chat_reports (club_id, status);
create index chat_reports_message_idx     on app.chat_reports (message_id);
create index chat_reports_reporter_idx    on app.chat_reports (reporter_member_id);
-- Die Warteschlange des Vorstands: neueste Meldung zuerst.
create index chat_reports_queue_idx       on app.chat_reports (club_id, created_at desc);

comment on table app.chat_reports is
  'Meldung eines Chat-Verstosses (0082). Sichtbar für den Vereinsvorstand (app.is_club_admin) und den Betreiber (app.is_platform_admin) sowie den Melder (eigene Meldung). Der Kern ist anhängend (Trigger chat_report_guard_update); änderbar ist nur status + handled_by/handled_at. reporter_ip und snapshot setzt der Server.';
comment on column app.chat_reports.snapshot is
  'Serverseitig aufgenommener Nachrichtentext + Kontextnachrichten + Aufnahmezeit — damit die Meldung lesbar bleibt, auch wenn die Nachricht später gelöscht wird.';
comment on column app.chat_reports.reporter_ip is
  'IP des Melders, vom Server aus der Anfrage gesetzt (nie vom Client). Fälschbar wie jedes x-forwarded-for — ein Hinweis, kein Beweis.';

-- ----------------------------------------------------------------------------
-- app.chat_report_guard_update — der Kern ist anhängend (siehe Kopf).
-- Änderbar sind AUSSCHLIESSLICH status, handled_by_member_id, handled_at.
-- Jede Änderung an reason/snapshot/message_id/reporter/reported/ip/club/created
-- wird abgewiesen. auth.uid() is null (Migration/Seed/Service) läuft ungeprüft
-- durch — wie in app.support_guard_message (0052).
-- ----------------------------------------------------------------------------
create or replace function app.chat_report_guard_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.club_id is distinct from old.club_id
     or new.message_id is distinct from old.message_id
     or new.reported_member_id is distinct from old.reported_member_id
     or new.reporter_member_id is distinct from old.reporter_member_id
     or new.reason is distinct from old.reason
     or new.reporter_ip is distinct from old.reporter_ip
     or new.snapshot is distinct from old.snapshot
     or new.created_at is distinct from old.created_at then
    raise exception 'chat_reports: only status/handled_by/handled_at may change'
      using hint = 'Der Kern einer Meldung ist anhängend. / A report''s core is append-only.';
  end if;

  return new;
end;
$$;

comment on function app.chat_report_guard_update() is
  'Erzwingt die GoBD-artige Anhängigkeit von app.chat_reports: nur status/handled_by/handled_at dürfen sich ändern, der Rest ist unveränderlich.';

create trigger chat_reports_guard_update
  before update on app.chat_reports
  for each row execute function app.chat_report_guard_update();

-- ----------------------------------------------------------------------------
-- RLS. Grants kommen aus 0001 (alter default privileges -> authenticated).
-- ----------------------------------------------------------------------------
alter table app.chat_reports enable row level security;

-- SELECT: Vorstand des EIGENEN Vereins ODER Betreiber (alle) ODER der MELDER
-- (nur seine eigene Meldung — nötig für die 201-Antwort von POST, s. Kopf).
create policy chat_reports_select on app.chat_reports
  for select to authenticated
  using (
    app.is_platform_admin()
    or app.is_club_admin(club_id)
    or app.is_own_member(reporter_member_id)
  );

-- INSERT: der MELDER meldet in eigenem Namen. reporter_member_id muss die
-- eigene, aktive Mitgliedszeile im Verein der Meldung sein; die gemeldete
-- Nachricht bzw. Person (falls gesetzt) muss zum selben Verein gehören.
-- Ob der Melder die Nachricht überhaupt SEHEN darf, prüft die API, indem sie
-- sie vor dem Anlegen unter RLS lädt (routes/chat.ts) — hier steht die
-- Mandanten- und Identitäts-Grenze.
create policy chat_reports_insert on app.chat_reports
  for insert to authenticated
  with check (
    app.is_own_member(reporter_member_id)
    and exists (
      select 1 from app.club_members s
      where s.id = reporter_member_id
        and s.club_id = chat_reports.club_id
        and s.deleted_at is null
    )
    and (
      message_id is null
      or exists (
        select 1 from app.chat_messages m
        where m.id = message_id and m.club_id = chat_reports.club_id
      )
    )
    and (
      reported_member_id is null
      or exists (
        select 1 from app.club_members r
        where r.id = reported_member_id and r.club_id = chat_reports.club_id
      )
    )
  );

-- UPDATE: NUR Vorstand des eigenen Vereins ODER Betreiber (Status/Bearbeitung).
-- Der Melder kann seine Meldung NICHT bearbeiten. Was sich ändern darf, sichert
-- zusätzlich der Trigger (anhängender Kern).
create policy chat_reports_update on app.chat_reports
  for update to authenticated
  using (app.is_platform_admin() or app.is_club_admin(club_id))
  with check (app.is_platform_admin() or app.is_club_admin(club_id));

-- Kein DELETE: deny-by-default (GoBD-artige Aufbewahrung, s. Kopf).

commit;
