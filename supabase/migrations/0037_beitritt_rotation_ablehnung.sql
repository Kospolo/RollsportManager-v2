-- ============================================================================
-- 0037_beitritt_rotation_ablehnung.sql — der Beitritt lernt vier Dinge:
--
--   1. app.club_join_codes  — MEHRERE gueltige Codes pro Verein (Rotation mit
--                             Ueberlappungsfenster war im Schema unmoeglich)
--   2. Ablehnungs-Gedaechtnis (rejected_at / rejected_by / rejection_count),
--      passend zum Enum-Wert 'rejected' aus 0036
--   3. club_members_update_self: nur AKTIVE beschreiben ihre Zeile
--   4. app.own_member_id: derselbe Mitgliedschafts-Gate wie member_role_keys
--
-- KEINE PRODUKTIVDATEN: v2 ist nirgends ausgerollt (kein Deployment, keine
-- Migrationshistorie ausserhalb dieses Repos). Deshalb wird hier sauber
-- umgebaut statt Altbestand nachgezogen — die einzige Ruecksicht gilt dem
-- BESTANDSCODE (Seed, Tests, POST /clubs), siehe die Spiegelung unter 1.
-- ============================================================================

begin;

-- ============================================================================
-- 1. app.club_join_codes — EIN Verein, N gueltige Codes
-- ============================================================================
--
-- DER BEFUND (nachgelesen, nicht uebernommen):
-- join_code (0002:38) und join_code_expires_at/_revoked_at (0034:58-61) sind
-- SPALTEN auf app.clubs. Eine Spalte haelt EINEN Wert. Die Rotation in
-- registration.ts war folgerichtig ein UPDATE auf diese Spalte:
--
--     update app.clubs set join_code = app.generate_join_code(), ...
--
-- In dem Moment, in dem der neue Code entsteht, ist der alte UEBERSCHRIEBEN.
-- Der Aushang in der Halle, der Code in der Eltern-WhatsApp-Gruppe, der
-- Screenshot im Anmeldeformular: alle sofort tot. Genau DESHALB rotiert in der
-- Praxis niemand — und ein Code, den man nicht wechseln kann, ohne alle
-- auszusperren, ist ein Code, der ewig gilt. Die Rotation war gebaut, aber
-- unbenutzbar.
--
-- "Der alte Code gilt noch 24 Stunden" braucht ZWEI gleichzeitig gueltige
-- Codes. Das ist keine Politur, sondern die Voraussetzung dafuer, dass die
-- Rotation ueberhaupt jemand benutzt.
--
-- WARUM DIE SPALTEN TROTZDEM BLEIBEN (und was sie ab hier sind):
-- Ein 'alter table app.clubs drop column join_code' waere die ehrlichere
-- Tabelle — aber app.clubs.join_code hat Schreiber, die diese Migration nicht
-- anfassen darf: supabase/seed/seed.sql:111, supabase/tests/sql/
-- 01_fixture_club_b.sql:28 und 99d_registrierung.sql:36/191/203/441 (Bestands-
-- Tests) sowie POST /clubs (routes/clubs.ts:213 'insert into app.clubs (...,
-- join_code) values (..., app.generate_join_code())').
-- Statt diese Schreiber zu brechen, werden sie WEITERGELEITET: ein Trigger
-- spiegelt jede Aenderung an app.clubs.join_code* in die Kindtabelle. Damit
-- gilt ab hier:
--
--     app.club_join_codes  = die WAHRHEIT (der Einloeser liest nur hier)
--     app.clubs.join_code  = Schreib-Alias + Anzeige des JUENGSTEN Codes
--
-- Ein neu angelegter Verein bekommt seinen Code so weiterhin automatisch,
-- ohne dass clubs.ts eine Zeile aendern muss.
-- ----------------------------------------------------------------------------

create table app.club_join_codes (
  id                   uuid        primary key default app.uuid_v7(),
  club_id              uuid        not null references app.clubs (id) on delete cascade,
  code                 text        not null,
  code_normalized      text        not null,
  label                text,
  expires_at           timestamptz,
  revoked_at           timestamptz,
  created_by_member_id uuid        references app.club_members (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table app.club_join_codes is
  'Einladungscodes eines Vereins — MEHRERE gleichzeitig gueltig. Ersetzt die Spalten app.clubs.join_code/_expires_at/_revoked_at (0002:38, 0034:58-61) als Wahrheit: eine Spalte haelt EINEN Code, und Rotieren hiess damit, den alten in derselben Sekunde zu toeten (Aushang/WhatsApp sofort tot). Nur mit N Codes ist ein Ueberlappungsfenster ("der alte gilt noch 24h") darstellbar. Die Spalten bleiben als Schreib-Alias bestehen und werden per Trigger hierher gespiegelt.';
comment on column app.club_join_codes.code is
  'Anzeigeform (XXXX-XXXX). Vergleich NIE gegen diese Spalte — dafuer ist code_normalized da.';
comment on column app.club_join_codes.code_normalized is
  'Vergleichsform (app.normalize_join_code: Trennzeichen weg, upper, Crockford I/L->1, O->0). Trigger-gepflegt, global eindeutig.';
comment on column app.club_join_codes.label is
  'Wofuer dieser Code gedacht war ("Aushang Halle", "Elternabend 03/26"). Beim Widerruf eines geleakten Codes ist das die einzige Information, an der der Vorstand erkennt, WELCHER Code raus ist.';
comment on column app.club_join_codes.expires_at is
  'Ablauf. NULL = laeuft nie ab. Das Ueberlappungsfenster einer Rotation setzt genau dieses Feld auf dem ALTEN Code.';
comment on column app.club_join_codes.revoked_at is
  'Widerruf. Sofortiger Tod des Codes, unabhaengig von expires_at.';
comment on column app.club_join_codes.created_by_member_id is
  'Wer den Code erzeugt hat. NULL bei Codes aus Seed/Migration/Vereinsanlage (da existiert noch kein Mitglied).';

-- Global eindeutig auf der VERGLEICHSFORM — der Index aus 0034:163 wandert
-- mit. Ohne ihn faende der Einloeser zu einem Code zwei Vereine und muesste
-- raten. Bewusst UEBER ALLE ZEILEN, nicht nur ueber die aktiven: ein
-- abgelaufener Code darf nie an einen ANDEREN Verein weiterwandern, sonst
-- fuehrt ein alter Aushang irgendwann in den falschen Verein.
create unique index club_join_codes_normalized_uq
  on app.club_join_codes (code_normalized);

create index club_join_codes_club_idx on app.club_join_codes (club_id, created_at desc);

create trigger club_join_codes_set_updated_at
  before update on app.club_join_codes
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------------------------
-- Vergleichsform trigger-gepflegt (dieselbe Begruendung wie 0034:136-141: kein
-- GENERATED-Column, damit ein spaeterer Fix an der Abbildung keinen Rewrite
-- mit falschem Altbestand erzwingt).
-- ----------------------------------------------------------------------------
create or replace function app.sync_club_join_code_normalized()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.code_normalized := app.normalize_join_code(new.code);
  if new.code_normalized is null then
    raise exception 'app.club_join_codes: leerer Code (normalisiert NULL) ist kein Code'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger club_join_codes_sync_normalized
  before insert or update of code on app.club_join_codes
  for each row execute function app.sync_club_join_code_normalized();

-- ----------------------------------------------------------------------------
-- Code und Verein sind UNVERAENDERLICH.
--
-- Ohne diese Wache waere die UPDATE-Policy unten ein Eigentor: sie erlaubt der
-- Vereinsleitung, expires_at/revoked_at zu setzen (Ueberlappungsfenster,
-- Widerruf) — mit demselben UPDATE koennte sie aber auch
--   update app.club_join_codes set code = 'AAAA-AAAA'
-- schreiben und damit die gesamte 40-Bit-Begruendung aus 0034 aushebeln. Ein
-- Code entsteht ausschliesslich aus app.generate_join_code(); geaendert wird
-- er nie, sondern ersetzt (Rotation).
-- ----------------------------------------------------------------------------
create or replace function app.protect_club_join_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.club_id is distinct from old.club_id then
    raise exception 'app.club_join_codes.club_id ist unveraenderlich';
  end if;
  if new.code is distinct from old.code
     or new.code_normalized is distinct from old.code_normalized then
    raise exception 'app.club_join_codes.code ist unveraenderlich — ein Code wird ERSETZT (Rotation), nie umgeschrieben';
  end if;
  return new;
end;
$$;

comment on function app.protect_club_join_code() is
  'Haelt code/code_normalized/club_id unveraenderlich. Die UPDATE-Policy erlaubt der Vereinsleitung nur Ablauf/Widerruf/Label — ohne diese Wache koennte sie sich per UPDATE einen selbstgewaehlten (= ratbaren) Code setzen und die CSPRNG-Begruendung aus 0034 waere hinfaellig.';

create trigger club_join_codes_protect
  before update on app.club_join_codes
  for each row execute function app.protect_club_join_code();

-- ----------------------------------------------------------------------------
-- DIE SPIEGELUNG: app.clubs.join_code* -> app.club_join_codes.
--
-- SECURITY DEFINER, weil der Schreiber (Seed, Migration, POST /clubs als
-- 'authenticated', Rotation) auf der Kindtabelle KEINE INSERT-Policy hat und
-- auch keine bekommen soll: Codes entstehen nur hier, aus generate_join_code().
-- ----------------------------------------------------------------------------
create or replace function app.mirror_club_join_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_norm text;
begin
  v_norm := app.normalize_join_code(new.join_code);

  -- Der Verein nimmt seinen Code zurueck (join_code = null). Im Zweifel
  -- strenger: dann sind ALLE noch lebenden Codes des Vereins tot, auch ein
  -- gerade noch ueberlappender alter. "Kein Code" heisst kein Beitritt.
  if v_norm is null then
    update app.club_join_codes
       set revoked_at = now()
     where club_id = new.id
       and revoked_at is null;
    return null;
  end if;

  -- Echte Kollision: der Code gehoert schon einem ANDEREN Verein. Muss laut
  -- scheitern (23505) und darf ihn NICHT stillschweigend uebernehmen.
  -- Derselbe SQLSTATE, den der Eindeutigkeits-Index auf app.clubs (0034:163)
  -- ohnehin wirft — der Aufrufer sieht keinen Unterschied.
  if exists (
    select 1 from app.club_join_codes c
    where c.code_normalized = v_norm and c.club_id <> new.id
  ) then
    raise exception 'Einladungscode ist bereits vergeben'
      using errcode = '23505';
  end if;

  -- Idempotent: derselbe Code darf mehrfach geschrieben werden (0034:158 zieht
  -- den Bestand mit 'set join_code = join_code' nach, die Rotation setzt die
  -- Spalte direkt nach dem Anlegen des Kindsatzes). Was sich dabei aendern
  -- darf, ist ausschliesslich Ablauf/Widerruf.
  insert into app.club_join_codes (club_id, code, code_normalized, expires_at, revoked_at)
  values (new.id, new.join_code, v_norm, new.join_code_expires_at, new.join_code_revoked_at)
  on conflict (code_normalized) do update
     set expires_at = excluded.expires_at,
         revoked_at = excluded.revoked_at;

  return null;
end;
$$;

comment on function app.mirror_club_join_code() is
  'Spiegelt app.clubs.join_code/_expires_at/_revoked_at in app.club_join_codes (die Wahrheit). Damit bleiben alle Bestands-Schreiber der Spalte gueltig — Seed, Tests und POST /clubs (clubs.ts:213) legen ihren Code weiterhin auf app.clubs ab und bekommen den Kindsatz geschenkt. join_code = null widerruft ALLE Codes des Vereins.';

create trigger clubs_mirror_join_code
  after insert or update of join_code, join_code_expires_at, join_code_revoked_at
  on app.clubs
  for each row execute function app.mirror_club_join_code();

-- Bestand nachziehen. Im Harness ein No-op (Migrationen laufen VOR dem Seed,
-- app.clubs ist hier leer) — die Zeile steht fuer jede Datenbank, in der schon
-- ein Verein liegt. Es gibt heute keine.
insert into app.club_join_codes (club_id, code, code_normalized, expires_at, revoked_at)
select c.id, c.join_code, app.normalize_join_code(c.join_code),
       c.join_code_expires_at, c.join_code_revoked_at
  from app.clubs c
 where app.normalize_join_code(c.join_code) is not null
on conflict (code_normalized) do nothing;

alter table app.club_join_codes enable row level security;

-- ----------------------------------------------------------------------------
-- RLS. Deckungsgleich mit der Sichtbarkeit des Codes auf app.clubs
-- (clubs.ts:60, JOIN_CODE_VISIBLE = owner/admin/moderator). Waere die
-- Kindtabelle offener als die Spalte, haette die Redigierung in clubs.ts ein
-- Hintertuerchen: 'select code from app.club_join_codes'.
--
-- KEIN INSERT, KEIN DELETE:
--   INSERT — ein Code entsteht ausschliesslich aus app.generate_join_code()
--            ueber die Spiegelung. Mit einer INSERT-Policy koennte sich die
--            Vereinsleitung 'MEIN-VEREIN' als Code setzen.
--   DELETE — ein Code wird widerrufen, nicht geloescht. Sonst verschwaende der
--            Nachweis, welcher Code wann gueltig war (und die Kollisionssperre
--            gaebe den Code zur Wiederverwendung frei).
-- ----------------------------------------------------------------------------
create policy club_join_codes_select on app.club_join_codes
  for select to authenticated
  using (app.has_club_role(club_id, array['owner', 'admin', 'moderator']));

comment on policy club_join_codes_select on app.club_join_codes is
  'Nur Code-Verwalter (owner/admin/moderator) — dieselbe Grenze wie die Redigierung von app.clubs.join_code in clubs.ts:60. Ein Trainer oder ein ausgetretener guest_coach mit altem Screenshot soll den Verein nicht mit Antraegen fluten koennen.';

create policy club_join_codes_update on app.club_join_codes
  for update to authenticated
  using (app.has_club_role(club_id, array['owner', 'admin', 'moderator']))
  with check (app.has_club_role(club_id, array['owner', 'admin', 'moderator']));

comment on policy club_join_codes_update on app.club_join_codes is
  'Ablauf/Widerruf/Label setzen (Ueberlappungsfenster der Rotation, Widerruf eines geleakten Codes). Code und Verein haelt app.protect_club_join_code() unveraenderlich.';

-- ----------------------------------------------------------------------------
-- Ist ein Code JETZT einloesbar? Dieselbe Definition wie 0034:171-182, nur auf
-- der Zeile statt auf zwei losen Zeitstempeln — damit Einloeser, Anzeige und
-- Test nicht auseinanderlaufen koennen.
-- ----------------------------------------------------------------------------
create or replace function app.join_code_row_is_active(p_code app.club_join_codes)
returns boolean
language sql
stable
set search_path = ''
as $$
  select app.join_code_is_active(p_code.expires_at, p_code.revoked_at)
$$;

comment on function app.join_code_row_is_active(app.club_join_codes) is
  'Einloesbarkeit einer Code-Zeile. Delegiert an app.join_code_is_active (0034:171) — EINE Definition fuer Einloeser und Anzeige.';

-- ============================================================================
-- 2. DAS ABLEHNUNGS-GEDAECHTNIS
-- ============================================================================
--
-- 0036 hat 'rejected' angelegt. Der Zustand allein reicht nicht: ohne WANN,
-- DURCH WEN und WIE OFT ist die naechste Bewerbung derselben Person fuer den
-- Vorstand nicht von der ersten zu unterscheiden. Genau das ist die
-- Belaestigungs-Masche — und der Freigabe-Bildschirm ist der Ort, an dem sie
-- auffallen muss.
--
-- WARUM KEINE ZWEITE ZEILE PRO BEWERBUNG (die naheliegende Alternative):
-- Ein Antrag = eine neue club_members-Zeile haette (a) den Eindeutigkeits-Index
-- (0002:82-84) aufweichen muessen und (b) app.own_member_id (0021:38-44,
-- 'order by created_at limit 1') zwischen zwei Zeilen raten lassen — und zwar
-- auf die AELTESTE, also ausgerechnet auf die abgelehnte. Ein Wiederantrag ist
-- deshalb ein Zustandswechsel DERSELBEN Zeile: rejected -> pending. Der Index
-- bleibt scharf, own_member_id bleibt eindeutig, das Gedaechtnis bleibt stehen.
--
-- Derselbe Weg loest nebenbei die zweite Sackgasse: wer 'left' oder 'inactive'
-- ist, konnte per Konstruktion NIE wieder beitreten (der Index blockte jeden
-- INSERT, und den eigenen Status darf niemand aendern — 0007:216-222). Auch
-- diese Zeile wird jetzt wieder auf 'pending' gedreht. Siehe routes/
-- registration.ts (POST /clubs/join).
-- ----------------------------------------------------------------------------

alter table app.club_members
  add column if not exists rejected_at           timestamptz,
  add column if not exists rejected_by_member_id uuid references app.club_members (id) on delete set null,
  add column if not exists rejection_count       integer not null default 0;

comment on column app.club_members.rejected_at is
  'Zeitpunkt der LETZTEN Ablehnung. Bleibt beim Wiederantrag (rejected -> pending) STEHEN: der Vorstand muss sehen, dass hier schon einmal Nein gesagt wurde.';
comment on column app.club_members.rejected_by_member_id is
  'Wer abgelehnt hat. Eine Ablehnung ist eine Entscheidung mit Folgen — sie braucht einen Namen, sonst ist sie im Verein nicht besprechbar.';
comment on column app.club_members.rejection_count is
  'Wie oft diese Person hier schon abgelehnt wurde. > 0 beim naechsten Antrag = das Warnzeichen im Freigabe-Bildschirm.';

comment on type app.member_status is
  'Lebenslauf einer Mitgliedschaft: pending (Antrag liegt vor) -> rejected (abgelehnt, Zeile bleibt als Gedaechtnis stehen) | active -> inactive -> left. Nur ''active'' oeffnet Rechte (app.member_role_keys, 0025:37-53).';

-- Das Gedaechtnis ist Pflicht, nicht Kuer: 'rejected' ohne Zeitpunkt waere eine
-- Ablehnung, die niemand mehr einordnen kann (und der Wiederantrags-Sperrfrist
-- in registration.ts fehlte die Bezugsgroesse). Diese Zusage gilt fuer JEDEN
-- Schreiber, auch fuer service_role und psql.
--
-- ### Genau HIER wird 'rejected' zum ersten Mal BENUTZT ###
-- Ein Enum-Wert ist in der Transaktion, die ihn per ALTER TYPE anlegt, nicht
-- verwendbar (55P04). Deshalb ist 0036 eine eigene Datei mit genau einer
-- Anweisung — und deshalb steht diese Zeile hier und nicht dort.
alter table app.club_members
  add constraint club_members_rejection_recorded check (
    status <> 'rejected' or rejected_at is not null
  );

-- ----------------------------------------------------------------------------
-- Anzeige-Wahrheit: keine Steuerzeichen, keine Bandwuermer in Namen.
--
-- first_name/last_name eines ANTRAGSTELLERS sind Text, den ein Fremder frei
-- waehlt und der ungeprueft im Freigabe-Bildschirm des Vorstands landet. Ein
-- Name mit CR/LF kann dort eine zweite Zeile vortaeuschen ("... — vom Vorstand
-- bereits geprueft"), 2000 Zeichen schieben die Schaltflaechen aus dem Bild.
-- Die Laengengrenze der API (validation.ts, max 80) gilt nur fuer den
-- Beitritts-Pfad; die Datenbank ist der Ort, an dem die Zusage fuer JEDEN
-- Schreiber gilt — auch fuer den Roster-Import und die Admin-Oberflaeche.
-- 120 Zeichen: grosszuegig ueber jedem realen Doppelnamen, weit unter allem,
-- was eine Oberflaeche sprengt.
-- ----------------------------------------------------------------------------
alter table app.club_members
  add constraint club_members_name_sane check (
    first_name !~ '[[:cntrl:]]' and length(first_name) <= 120
    and last_name !~ '[[:cntrl:]]' and length(last_name) <= 120
    and (email is null or (email !~ '[[:cntrl:]]' and length(email) <= 254))
  );

-- ============================================================================
-- 3. club_members_update_self — der nicht freigegebene Fremde schreibt mit
-- ============================================================================
--
-- DER BEFUND: die Policy (0016:76-79) lautete
--     using (profile_id = auth.uid() and deleted_at is null)
-- — ohne jeden Status-Filter. app.protect_club_membership (0007:216-222) haelt
-- role/status/valid_until/profile_id fest, aber first_name/last_name/email/
-- birth_date NICHT. Ergebnis: eine wildfremde Person mit status='pending'
-- durfte laufend den Text umschreiben, den der Vorstand im Freigabe-Bildschirm
-- sieht. Das ist kein Datenleck, sondern eine Anzeige-Taeuschung — und die
-- Freigabe ist genau die Entscheidung, bei der sie wirkt.
--
-- Nach 0036 gilt es doppelt: auch ein ABGELEHNTER haette weiter an seiner Zeile
-- geschrieben.
--
-- Der Gate ist woertlich der aus app.member_role_keys (0025:47-49) — dieselbe
-- Definition von "Mitglied", nicht eine zweite, die spaeter auseinanderlaeuft.
-- Wer wartet, wartet; korrigieren darf er seine Stammdaten nach der Freigabe.
-- ADD-ONLY bleibt ADD-ONLY: club_members_update (0007:259, can_manage_members)
-- ist unberuehrt — die Mitglieder-Verwaltung korrigiert einen Tippfehler im
-- Antrag weiterhin.
-- ----------------------------------------------------------------------------
alter policy club_members_update_self on app.club_members
  using (
    profile_id = auth.uid()
    and deleted_at is null
    and status = 'active'
    and (valid_until is null or valid_until >= now())
  )
  with check (
    profile_id = auth.uid()
    and deleted_at is null
    and status = 'active'
    and (valid_until is null or valid_until >= now())
  );

comment on policy club_members_update_self on app.club_members is
  'Eigene Stammdaten bearbeiten — NUR fuer aktive, nicht abgelaufene Mitgliedschaften (derselbe Gate wie app.member_role_keys, 0025:47-49). Vorher fehlte der Status-Filter: ein pending-Fremder konnte den Text umschreiben, den der Vorstand im Freigabe-Bildschirm liest.';

-- ============================================================================
-- 4. app.own_member_id — derselbe Gate wie ueberall sonst
-- ============================================================================
--
-- DER BEFUND: die Funktion (0021:38-44) prueft NUR deleted_at. Sie liefert
-- damit auch fuer eine pending-, abgelehnte, ausgetretene oder abgelaufene
-- Mitgliedschaft eine id zurueck.
--
-- Ausgenutzt werden konnte das in der RLS nicht — jede Policy paart
-- own_member_id mit einem status-gegateten cap_rank/has_cap. Aber "wird von
-- woanders aufgefangen" ist kein Zustand, in dem ein Helfer bleiben soll, der
-- "bin ICH das?" beantwortet: die Antwort "ja, du bist Mitglied a0..." ist fuer
-- eine pending-Person schlicht FALSCH. Der API-seitige Zwilling
-- (services/api/src/lib/ownership.ts) hatte denselben Fehler und dort war er
-- der einzige Waechter in 17 Aufrufstellen.
--
-- Reine Verschaerfung, im Bestand folgenlos: alle Personas im Seed sind
-- 'active'; die einzige pending-Zeile (Greta Lindner, a0..24) hat
-- profile_id = NULL und kann nie auth.uid() sein.
-- ----------------------------------------------------------------------------
create or replace function app.own_member_id(p_club_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
  from app.club_members m
  where m.club_id = p_club_id
    and m.profile_id = auth.uid()
    and m.deleted_at is null
    and m.status = 'active'
    and (m.valid_until is null or m.valid_until >= now())
  order by m.created_at
  limit 1
$$;

comment on function app.own_member_id(uuid) is
  'club_members.id des eingeloggten Nutzers im Verein (NULL = kein aktives Mitglied). Basis fuer "nur eigenes Fach / eigene Kuer". Traegt seit 0037 denselben Mitgliedschafts-Gate wie app.member_role_keys (0025:47-49): pending/abgelehnt/ausgetreten/abgelaufen -> NULL.';

commit;
