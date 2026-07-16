-- ============================================================================
-- 0045_selbstprofil_sichtbarkeit.sql — drei Befunde des Nutzers, nachgemessen
-- und beantwortet:
--   (1) "wenn das mitglied was ueber sich eintraegt, dann das auch — jetzt
--       aktuell geht garnicht"  -> es GIBT kein Selbst-Profil-Feld. Nachgezaehlt
--       in app.club_members (0002:69-86): id, club_id, profile_id, first_name,
--       last_name, email, birth_date, role, status, joined_on, valid_until,
--       created_at, updated_at, deleted_at, avatar_key. Kein bio/ueber_mich.
--       "Geht garnicht" ist keine kaputte Anzeige — die Spalte existiert nicht.
--   (2) "trainingsbeteiligung an anderen mitgliedern als mitglied ... geht auch
--       nicht — das kann trainer und hoeher sehen, aber rest nicht."
--       -> attendance/member steht auf 'read_all' (0023:207, v_trainer-Zweig).
--   (3) joined_on fuer den coach — der API-Teil, siehe members.ts. Hier steht
--       nichts dazu: es ist eine SPALTEN-Projektion der API, keine Zeilen-Regel.
--
-- ############################################################################
-- TEIL 1 — DAS SELBST-PROFIL
-- ############################################################################
--
-- ### WARUM STRUKTURIERTE FELDER UND KEIN FREITEXT ###
-- Der Auftrag laesst beides zu, verlangt aber eine Begruendung. Sie lautet:
-- Das Publikum dieses Feldes ist der GANZE VEREIN, und der Verein besteht in
-- weiten Teilen aus KINDERN (Seed: 17 der 24 Mitglieder sind Minderjaehrige,
-- das juengste ist 9). Ein leeres Feld "Ueber mich", das jedes Mitglied liest,
-- ist kein Textfeld, sondern eine Einladung zur Erzaehlung — und die Erzaehlung
-- eines Kindes ueber sich enthaelt Schule, Wohnort, Handynummer, weil das Kind
-- das Publikum nicht kennt. Nicht aus Boshaftigkeit, sondern weil ein leeres
-- Feld genau danach fragt.
--
-- Die BESCHRIFTUNG ist die wirksamste Schranke, die wir haben. "Motto" fragt
-- nach einem Spruch. "Lieblingsdisziplin" fragt nach einer Disziplin. "Seit
-- wann laeufst du?" fragt nach einer Jahreszahl. Keines dieser Felder fragt
-- nach dem Leben eines Kindes — und was nicht gefragt wird, wird ueberwiegend
-- auch nicht geschrieben. Das ist kein Beweis, aber es ist der Unterschied
-- zwischen einem Entwurf, der das Naheliegende erschwert, und einem, der es
-- nahelegt.
--
-- Dazu die Richtung der Umkehrbarkeit, die den Ausschlag gibt:
--   Ein Freitextfeld NACHRUESTEN ist eine Migration.
--   Ein Freitextfeld ENTFERNEN, nachdem 17 Kinder hineingeschrieben haben, ist
--   ein Datenschutz-Vorfall mit Loeschpflicht und Benachrichtigung.
-- Bei Ungewissheit gewinnt die Richtung, die reparierbar bleibt. Der Nutzer
-- bekommt, was er bestellt hat ("das mitglied traegt was ueber sich ein"), und
-- wenn er danach ausdruecklich ein offenes Feld will, kostet das eine Migration
-- und keinen Vorfall.
--
-- ### WAS DIE PRUEFUNG LEISTET — UND WAS NICHT (ehrlich benannt) ###
-- app.contains_contact_details() faengt die GEDANKENLOSE Preisgabe: die
-- hineinkopierte E-Mail, den Link, die am Stueck getippte Telefonnummer. Sie
-- faengt NICHT die entschlossene: "null eins sieben sechs ..." ausgeschrieben,
-- "0176 123 4567" mit Leerzeichen, den Instagram-Namen ohne URL. Das ist keine
-- Luecke, die man mit einem schaerferen Regex schliesst — man schliesst sie mit
-- einer Zensur-KI, und die ist ausdruecklich nicht bestellt und waere hier auch
-- falsch (sie liest dann jeden Kindersatz mit).
-- Die Pruefung ist also eine LEITPLANKE, keine Grenze. Die Grenze sind:
-- kurze Laenge, benannte Felder, Publikum nur der eigene Verein (nie oeffentlich),
-- Erziehungsberechtigte mit Vollzugriff und Moderation, die loeschen kann.
-- Wer das anders in den Bericht schreibt, verspricht etwas, das hier nicht steht.
--
-- ### WER SCHREIBT ###
-- NUR die Person selbst — und bei Kindern ohne Konto (profile_id is null,
-- 0002:72) die Erziehungsberechtigten. Beides ist genau app.can_act_for_member
-- (0002:192-215), das exakt diese zwei Zweige hat.
--
-- ### DER VORSTAND DARF LOESCHEN, ABER NICHT SCHREIBEN ###
-- Der Trigger unterscheidet BEIDES, und das ist Absicht:
--   * auf einen WERT setzen  -> nur can_act_for_member. Sonst schriebe ein
--     Administrator einem Kind ein "Motto" in den Mund, das der ganze Verein
--     als Aussage DES KINDES liest. Das ist keine Verwaltung, das ist
--     Identitaetsuebernahme — und niemand hat sie bestellt.
--   * auf NULL setzen        -> jeder, der die Zeile ohnehin per RLS aendern
--     darf (owner/admin/moderator/treasurer, club_members_update 0007).
--     Moderation MUSS moeglich sein: schreibt jemand etwas Unangebrachtes,
--     muss es weg — sofort und ohne Migration.
-- Loeschen ist Moderation, Schreiben ist Urheberschaft. Nur das Zweite ist
-- gefaehrlich.
--
-- ### DER PENDING-FREMDE — NICHT VERSCHLIMMERT, SONDERN AUSGESCHLOSSEN ###
-- club_members_update_self (0016:76-79) hat KEINEN status-Filter: eine Person
-- mit Beitritts-ANTRAG (status='pending') darf ihre eigene Zeile schreiben.
-- Ein anderer Trupp repariert das gerade; ich verlasse mich nicht darauf.
-- Aber ich darf es auch nicht verschlimmern, und genau das taete ein
-- Selbst-Profil ohne eigenen Filter: club_members_select ist app.is_club_member
-- (0002:317-319) und filtert den LESER, nicht die ZEILE — jedes aktive Mitglied
-- liest ALLE Zeilen des Vereins, auch die der Antragsteller. Ein Fremder mit
-- gueltigem Vereinscode haette also ein Feld, das er beschreiben kann und das
-- der ganze Verein liest, BEVOR ihn jemand aufgenommen hat. Das waere ein
-- Werbe-/Anmach-Kanal mit Vereinscode als Eintrittskarte.
-- Deshalb verlangt der Trigger ZUSAETZLICH status = 'active'. Das ist eine
-- eigene Schranke fuer meine eigenen Spalten und kollidiert nicht mit der
-- Policy-Reparatur des anderen Trupps — beide duerfen nebeneinander stehen.
--
-- ### EINWILLIGUNG (app.consents, 0039) — GEPRUEFT, ERGEBNIS: NEIN ###
-- Die Zwecke sind terms/privacy/photos_internal/photos_public/chat/newsletter,
-- und consents_purpose_is_real_consent_chk (0039:236) wirft terms/privacy
-- ausdruecklich raus: Vertragszwecke sind KEINE Einwilligung.
-- Die freiwillige Selbstdarstellung braucht keinen NEUEN Zweck, und zwar aus
-- einem Grund, der nicht Bequemlichkeit ist: DAS AUSFUELLEN IST DIE
-- EINWILLIGUNG. Art. 7 DSGVO verlangt eine unmissverstaendliche bestaetigende
-- Handlung — jemand tippt freiwillig ein Motto in ein Feld, das als
-- vereinsoeffentlich beschriftet ist. Eine zweite Checkbox davor wuerde daraus
-- keine freiere Entscheidung machen, sondern nur einen Klick.
-- Der Unterschied zu photos_internal ist der Urheber: ein FOTO macht jemand
-- ANDERES von dir, da brauchst du ein Veto. Ein Motto schreibst DU. Und du
-- widerrufst es, indem du das Feld leerst — nicht indem du eine Einwilligung
-- zurueckziehst. Der Widerruf ist hier dieselbe Handlung wie die Erteilung,
-- nur rueckwaerts; das ist die sauberste Form von Art. 7(3).
-- -> KEINE Aenderung an app.consents. Der Consent-Trupp baut hier nichts ein.
--    ABER: der Design-Trupp MUSS das Publikum AN DER EINGABE benennen (siehe
--    Bericht) — ohne das ist die "unmissverstaendliche" Handlung nicht
--    informiert, und dann traegt die Begruendung oben nicht mehr.
--
-- ############################################################################
-- TEIL 2 — TRAININGSBETEILIGUNG: DIE STUFE MUSS DAS LESEN WIRKLICH SPERREN
-- ############################################################################
--
-- ### DIE FALLE, VOR DER DER AUFTRAG WARNT — SIE IST ECHT ###
-- Nachgesehen statt geraten:
--   attendance_select (0003:260-263) = app.is_club_member(club_id).
--   app.capabilities.enforcement fuer 'attendance' = 'write_only' (0033:205).
--   0023:17-18 sagt es selbst: "attendance/member: §3 sagt read_own, IST =
--   read_all (attendance_select ist is_club_member und bleibt es — Lesen ist
--   hier nicht cap-gated)."
-- Wuerde man NUR die Seed-Stufe auf read_own setzen, aendert sich NICHTS am
-- Lesen: has_cap steht in INSERT/UPDATE, nicht in SELECT. Das Admin-UI zeigte
-- "nur eigene", die Datenbank liefert weiter alle. Genau die Luege, die der
-- Auftrag benennt. Deshalb wird hier die SELECT-Policy mit umgestellt.
--
-- ### DIE UNVERMEIDLICHE FOLGE: DAS ETIKETT MUSS WANDERN (93j) ###
-- 'write_only' heisst laut 0033: gelesen wird weiter. Sobald attendance_select
-- die Faehigkeit fragt, ist das falsch — und 93j_capability_enforcement.sql
-- rechnet genau das nach:
--   Block C  verlangt: 'write_only' darf KEINE SELECT-Policy haben.
--   Block C  verlangt: 'enforced' MUSS eine SELECT-Policy haben.
--   Block A  zaehlt:   enforced = 3, write_only = 9.
-- Das Etikett wandert also zwangslaeufig write_only -> enforced, und Block A
-- wird 4 / 8. Das ist KEIN Kollateralschaden, den man wegdrueckt — es ist die
-- Tripwire, die 0033:238-247 ausdruecklich dafuer gebaut hat ("genau der
-- Moment, in dem jemand nachdenken soll"). Der Nachdenkende ist dieser Kopf.
-- Die Zahlen in 93j Block A sind entsprechend angepasst; die ZUSICHERUNGEN
-- (Bloecke B/C/D) sind wortgleich geblieben und pruefen weiter Etikett gegen
-- Wirklichkeit. Steht ausdruecklich im Bericht — es ist die eine Stelle, an
-- der ich einen Bestands-Test angefasst habe.
-- NICHT gangbar waere der bequeme Weg gewesen: die Faehigkeit so zu kapseln,
-- dass app.capability_policy_usage() sie nicht findet (z. B. Key dynamisch
-- zusammenbauen). Das haette 93j gruen gelassen — durch Tarnung vor dem
-- Detektor. Ein Sicherheitstest, den man umgeht statt ihn zu beantworten, ist
-- schlimmer als keiner.
--
-- ### WARUM KEINE NEUE FAEHIGKEIT (Muster 0040:44-58) ###
-- Eine 33. Faehigkeit ist von Bestands-Tests verboten:
--   93j:37  is_eq('der Katalog hat 32 Faehigkeiten', 32)
--   93_rbac.sql:104-108  role_permissions(is_system) == count(capabilities) * 7
-- 'attendance' ist ohnehin die richtige Faehigkeit — sie heisst "Anwesenheit"
-- und ihre allowed_levels (none/read_own/read_team/read_all/edit, 0023:53-54)
-- sind exakt die Stufenform, die hier gebraucht wird. Es fehlte nie der
-- Katalog, es fehlte die Policy.
--
-- ### TREASURER: GEPRUEFT, DANN GEKAPPT — MIT BEGRUENDUNG ###
-- Der Auftrag verlangt, VOR dem Kappen nachzusehen, ob ein Finanz-/
-- Pflichtstunden-Pfad an der Anwesenheit haengt. Nachgesehen:
--   * grep -i attendance ueber 0005/0013/0014/0015 (finance a-c): KEIN Treffer.
--   * "from app.attendance" / "join app.attendance" ueber ALLE Migrationen:
--     KEIN Treffer ausser den Policies selbst. Keine View, kein Report, keine
--     Beitragsrechnung liest die Tabelle.
--   * app.duty_hours (Pflichtstunden) ist eine EIGENE Tabelle mit eigener
--     Fassung — sie leitet nichts aus attendance ab.
--   * services/api: attendance kommt nur in events.ts vor (Check-in, 'edit').
-- Es gibt also heute keinen Zweck, fuer den die Kasse die Trainingsbeteiligung
-- der Kinder braucht. Der Nutzer sagt "trainer und hoeher"; der Kassenwart ist
-- kein Trainer, sondern ein Nachbar in der Rangordnung. Ohne Zweck kein
-- Zugriff — das ist Art. 5(1)(c) DSGVO und nicht meine Meinung.
-- Was das Kappen billig macht: role_permissions ist JE VEREIN im Admin-UI
-- einstellbar. Baut jemand spaeter "Beitragsermaessigung ab X Trainings", holt
-- der Verein dem Kassenwart read_all mit zwei Klicks zurueck — ohne Migration.
-- Der teure Weg waere andersherum: Zugriff auf Kinderdaten stehen lassen, "weil
-- man ihn vielleicht mal braucht".
--
-- ### ELTERN — DIE EIGENTLICHE PROBE ###
-- read_own darf NICHT "nur die eigene Zeile" heissen. Eine Mutter, die die
-- Trainingsbeteiligung ihres Kindes nicht sieht, ist ein kaputtes Feature.
-- app.can_act_for_member traegt beide Zweige (selbst + Vormundschaft) und ist
-- genau deshalb hier der Eigen-Zweig — nicht app.is_own_member (0009:36), das
-- NUR profile_id = auth.uid() kennt und die Kinder ohne Konto verloere.
-- Belegt in 99e_selbstprofil_sichtbarkeit.sql Block B.
--
-- ### NEBENWIRKUNG, BEWUSST: DER PENDING-FREMDE VERLIERT AUCH HIER ###
-- is_club_member -> cap_rank ist zusaetzlich eine Verschaerfung: cap_rank haengt
-- an app.member_role_keys (0025:47), und das filtert status='active' und die
-- guest_coach-Befristung. Was vorher am Claim hing, haengt jetzt am Bestand.
-- ============================================================================

begin;

-- ############################################################################
-- TEIL 1 — SELBST-PROFIL
-- ############################################################################

-- ----------------------------------------------------------------------------
-- 1.1 Die Leitplanke gegen die gedankenlose Preisgabe.
--     IMMUTABLE, weil sie in einem CHECK-Constraint steht (Postgres laesst dort
--     nichts anderes zu). Bewusst KEINE Zensur-KI, bewusst kein Versuch,
--     Vollstaendigkeit vorzutaeuschen — siehe Kopf.
-- ----------------------------------------------------------------------------
create or replace function app.contains_contact_details(p_text text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_text is not null and (
    -- E-Mail: hohe Trefferschaerfe, praktisch keine Fehlalarme in einem Motto.
       p_text ~* '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}'
    -- Link (auch ohne Schema): der Weg nach draussen aus einem Vereinsprofil.
    or p_text ~* '(https?://|www\.[[:alnum:]-]+\.[[:alpha:]]{2,})'
    -- Ziffernkette am Stueck ab 7: eine Telefonnummer, hineinkopiert. Eine
    -- Jahreszahl hat 4, ein Ergebnis ("5.2") hat 2 — 7 am Stueck hat in einem
    -- Motto nichts zu suchen. Mit Leerzeichen getippt rutscht sie durch; das
    -- ist im Kopf benannt und wird hier nicht weggeschummelt.
    or p_text ~ '[0-9]{7,}'
  )
$$;

comment on function app.contains_contact_details(text) is
  'Leitplanke, KEINE Grenze: erkennt hineinkopierte E-Mail/Link/Telefonnummer am Stueck in freiwilligen Profiltexten. Faengt die gedankenlose Preisgabe, nicht die entschlossene (getrennt getippte Nummern, ausgeschriebene Ziffern, Social-Handles rutschen durch — bewusst, siehe 0045-Kopf).';

-- ----------------------------------------------------------------------------
-- 1.2 Die Spalten. Drei benannte Fragen statt eines leeren Kastens.
--     Laengen: ein Motto ist ein Spruch (140 — die Laenge, bei der eine
--     Erzaehlung nicht anfaengt), eine Disziplin ist ein Wort (60).
-- ----------------------------------------------------------------------------
alter table app.club_members
  add column if not exists profile_motto               text,
  add column if not exists profile_favorite_discipline text,
  add column if not exists profile_skating_since       int;

alter table app.club_members
  drop constraint if exists club_members_profile_motto_len_chk,
  drop constraint if exists club_members_profile_discipline_len_chk,
  drop constraint if exists club_members_profile_since_range_chk,
  drop constraint if exists club_members_profile_motto_contact_chk,
  drop constraint if exists club_members_profile_discipline_contact_chk;

alter table app.club_members
  -- Laenge: die wirksamste Schranke, die serverseitig ueberhaupt zu haben ist.
  add constraint club_members_profile_motto_len_chk
    check (profile_motto is null or char_length(profile_motto) <= 140),
  add constraint club_members_profile_discipline_len_chk
    check (profile_favorite_discipline is null
           or char_length(profile_favorite_discipline) <= 60),
  -- Jahreszahl statt Datum: "seit 2019" ist eine Auskunft, "seit 03.09.2019"
  -- ist ein Datum, aus dem sich mit joined_on gegenrechnen laesst. Und ein
  -- strukturiertes int kann per Bauart keine Handynummer enthalten.
  add constraint club_members_profile_since_range_chk
    check (profile_skating_since is null
           or (profile_skating_since between 1900
                                         and (extract(year from now())::int + 1))),
  add constraint club_members_profile_motto_contact_chk
    check (not app.contains_contact_details(profile_motto)),
  add constraint club_members_profile_discipline_contact_chk
    check (not app.contains_contact_details(profile_favorite_discipline));

comment on column app.club_members.profile_motto is
  'Selbst gepflegt: kurzes Motto (max. 140). Publikum = alle AKTIVEN Mitglieder des Vereins (club_members_select = is_club_member). Schreibrecht: NUR app.can_act_for_member (Person selbst oder Erziehungsberechtigte) UND status=active — durchgesetzt von app.protect_self_profile (0045). Leeren darf zusaetzlich jede:r, der die Zeile ohnehin verwalten darf (Moderation).';
comment on column app.club_members.profile_favorite_discipline is
  'Selbst gepflegt: Lieblingsdisziplin (max. 60). Sichtbarkeit/Schreibrecht wie profile_motto.';
comment on column app.club_members.profile_skating_since is
  'Selbst gepflegt: Jahreszahl "laeuft seit" (1900..naechstes Jahr). BEWUSST nur das Jahr und BEWUSST nicht joined_on: joined_on ist eine redigierte Spalte (members.ts), diese hier ist eine freiwillige Angabe ueber den SPORT, nicht ueber die Mitgliedschaft.';

-- ----------------------------------------------------------------------------
-- 1.3 Der Waechter. Urheberschaft vs. Moderation — siehe Kopf.
--
--     Muster woertlich von app.protect_club_membership (0002:227-271): der
--     Gate haengt an `auth.uid() is not null`, weil die API teils mit
--     service_role-Token ohne sub-Claim arbeitet. Die Schreibpfade dieses
--     Features laufen aber alle impersoniert (withUser) -> auth.uid() gesetzt
--     -> der Trigger greift. Ein eigener Trigger und kein Anbau an
--     protect_club_membership: dessen Regeln sind Rollen-/Status-Eskalation,
--     meine sind Urheberschaft. Zwei Themen, zwei Trigger, getrennt lesbar.
--
--     KEIN Bypass fuer is_platform_admin(): der Plattformbetreiber verwaltet
--     Vereine, er spricht nicht fuer ein Kind. Loeschen (auf NULL) kann er, wenn
--     ihn eine Policy an die Zeile laesst — schreiben nie.
-- ----------------------------------------------------------------------------
create or replace function app.protect_self_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_touched boolean;
  v_set     boolean;
begin
  if auth.uid() is null then
    return new;  -- service_role: wie 0002, ausdruecklich ausgenommen
  end if;

  if tg_op = 'INSERT' then
    -- Beim INSERT gibt es die Zeile noch nicht, can_act_for_member kann sie
    -- also nicht pruefen. Das Selbst-Profil wird ohnehin NACH dem Beitritt
    -- gepflegt (PATCH), nie beim Anlegen durch die Verwaltung. Fail-closed.
    if new.profile_motto is not null
       or new.profile_favorite_discipline is not null
       or new.profile_skating_since is not null then
      raise exception 'self profile fields cannot be set on insert'
        using hint = 'Das Selbst-Profil pflegt die Person selbst per PATCH /clubs/{clubId}/members/{memberId}/profile.';
    end if;
    return new;
  end if;

  v_touched := new.profile_motto               is distinct from old.profile_motto
            or new.profile_favorite_discipline is distinct from old.profile_favorite_discipline
            or new.profile_skating_since       is distinct from old.profile_skating_since;

  if not v_touched then
    return new;
  end if;

  -- Wird IRGENDEIN Feld auf einen WERT gesetzt (statt geleert)? Dann ist es
  -- Urheberschaft und nur die Person selbst/ihre Vormunde duerfen das.
  -- Reines Leeren (alle beruehrten Felder -> NULL) ist Moderation und bleibt
  -- jedem erlaubt, den die RLS ohnehin an die Zeile laesst.
  v_set := (new.profile_motto is not null
              and new.profile_motto is distinct from old.profile_motto)
        or (new.profile_favorite_discipline is not null
              and new.profile_favorite_discipline is distinct from old.profile_favorite_discipline)
        or (new.profile_skating_since is not null
              and new.profile_skating_since is distinct from old.profile_skating_since);

  if v_set then
    if not app.can_act_for_member(new.id) then
      raise exception 'only the member (or their guardians) may write the self profile'
        using hint = 'app.can_act_for_member: Person selbst oder Erziehungsberechtigte:r laut app.guardianships.';
    end if;
    -- Der pending-Fremde: Antrag ist kein Zutritt (0034). Ohne diesen Filter
    -- haette er ein Feld, das der ganze Verein liest, bevor er aufgenommen ist.
    if new.status <> 'active' then
      raise exception 'only active members may write the self profile'
        using hint = 'Beitrittsantrag laeuft noch (status <> active).';
    end if;
  end if;

  return new;
end;
$$;

comment on function app.protect_self_profile() is
  'Urheberschaft des Selbst-Profils (0045): profile_motto/_favorite_discipline/_skating_since auf einen WERT setzen darf nur app.can_act_for_member (Person selbst oder Vormund) und nur bei status=active. LEEREN (auf NULL) darf jede:r, den die RLS an die Zeile laesst — Moderation muss moeglich bleiben, Identitaetsuebernahme nicht. service_role (auth.uid() is null) ausgenommen wie in 0002.';

drop trigger if exists club_members_protect_self_profile        on app.club_members;
drop trigger if exists club_members_protect_self_profile_insert on app.club_members;

create trigger club_members_protect_self_profile
  before update on app.club_members
  for each row execute function app.protect_self_profile();

create trigger club_members_protect_self_profile_insert
  before insert on app.club_members
  for each row execute function app.protect_self_profile();

-- ----------------------------------------------------------------------------
-- 1.4 Der SCHREIBWEG. Ohne ihn gaebe es das Feature fuer Kinder nicht.
--
-- ### DER BEFUND, DER DIESE FUNKTION ERZWINGT ###
-- Eine Erziehungsberechtigte hat unter RLS GAR KEINEN Weg an die Zeile ihres
-- Kindes. Nachgesehen, nicht vermutet — es gibt genau zwei UPDATE-Policies auf
-- app.club_members:
--   club_members_update      (0007) = can_manage_members
--   club_members_update_self (0016) = profile_id = auth.uid()
-- Katrin (Mitglied, Mutter) ist weder das eine noch das andere, und Lina
-- (profile_id is null, Kind ohne Konto) ist nicht "sie selbst". Ein UPDATE
-- traefe 0 Zeilen. Der Trigger oben wuerde die Mutter durchlassen — die Policy
-- laesst sie nie bis dorthin kommen.
--
-- ### WARUM DANN KEINE VORMUND-UPDATE-POLICY? WEIL SIE EIN LOCH WAERE ###
-- Der naheliegende Griff — "create policy club_members_update_guardian ...
-- using (app.can_act_for_member(id))" — ist eine Rechte-Eskalation, und zwar
-- eine, die man erst beim zweiten Hinsehen sieht:
-- RLS ist ein ZEILEN-Filter. Eine Vormund-Policy gibt die GANZE ZEILE frei,
-- nicht drei Spalten. Und protect_club_membership (0002:246-252) fängt das
-- NICHT auf: sein Selbst-Schutz haengt an `old.profile_id = auth.uid()` — bei
-- einem Kind ohne Konto ist profile_id NULL, die Bedingung ist nie wahr, der
-- Block laeuft leer. Uebrig bliebe nur "nur owner duerfen owner-Rollen".
-- Ergebnis: eine Mutter setzt `role='admin'` auf der Zeile ihres Kindes und hat
-- ueber das Kind Vereins-Adminrechte. Aus "Mama darf das Motto pflegen" wuerde
-- der kuerzeste Eskalationspfad im ganzen Schema.
--
-- ### DESHALB: EIN SCHMALER SETZER STATT EINER BREITEN POLICY ###
-- security definer, damit er an der fehlenden Policy vorbeikommt — aber er
-- kann per Bauart NUR die drei Profilspalten schreiben. Es gibt keinen
-- Parameter fuer role/status/email; die Eskalation ist nicht verboten, sie ist
-- nicht formulierbar. Das ist der Unterschied zwischen einer Regel, die man
-- befolgen muss, und einer Tuer, die es nicht gibt.
-- Die Rechtepruefung macht er selbst (can_act_for_member), und der Trigger aus
-- 1.3 feuert zusaetzlich — security definer wechselt die ROLLE, nicht die
-- Claims, also sieht auth.uid() weiter die echte Person. Doppelt geprueft,
-- absichtlich: diese Funktion umgeht RLS, da ist eine zweite Meinung billig.
--
-- p_patch als jsonb, weil PATCH drei Zustaende kennt und SQL nur zwei:
--   Schluessel fehlt  -> unveraendert
--   Schluessel = null -> Angabe loeschen
--   Schluessel = Wert -> setzen
-- Mit Einzelparametern waere "nicht mitgeschickt" und "loeschen" beides NULL.
-- ----------------------------------------------------------------------------
create or replace function app.set_self_profile(p_club_id uuid, p_member_id uuid, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hit int;
begin
  -- FAIL LOUD STATT STILL. Dieser Check ist aus einem echten Befund entstanden:
  -- die API uebergab das Patch-Objekt zuerst als JSON.stringify(...)::jsonb.
  -- postgres.js kodiert einen JS-String fuer ein jsonb-Ziel aber ein ZWEITES
  -- Mal — angekommen ist ein jsonb-SKALAR vom Typ "string" statt eines Objekts.
  -- Folge: `p_patch ? 'motto'` war fuer JEDEN Schluessel false, jedes Feld fiel
  -- in den else-Zweig ("unveraendert"), die Funktion schrieb NICHTS und meldete
  -- trotzdem Erfolg. Die Route antwortete 200 mit einem leeren Profil.
  -- Ein stiller No-Op ist die schlechteste aller Antworten: der Nutzer sieht
  -- "gespeichert" und das Feld bleibt leer — also genau das "geht garnicht",
  -- das diese Migration beheben soll. Deshalb hier eine harte Grenze statt
  -- eines Kommentars im Aufrufer.
  if jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'set_self_profile: p_patch must be a jsonb OBJECT, got %',
      coalesce(jsonb_typeof(p_patch), 'null')
      using hint = 'Aufrufer: in postgres.js sql.json(obj) verwenden, nicht JSON.stringify(obj) — letzteres kodiert doppelt.';
  end if;

  if not app.can_act_for_member(p_member_id) then
    -- P0001 -> 403 (middleware/error.ts:73). Bewusst dieselbe Antwort wie bei
    -- "Zeile gibt es nicht": wer fremde Profile schreiben will, soll aus der
    -- Fehlermeldung nicht lernen, welche member_id existiert.
    raise exception 'only the member (or their guardians) may write the self profile';
  end if;

  update app.club_members m
     set profile_motto =
           case when p_patch ? 'motto'
                then nullif(p_patch ->> 'motto', '')
                else m.profile_motto end,
         profile_favorite_discipline =
           case when p_patch ? 'favorite_discipline'
                then nullif(p_patch ->> 'favorite_discipline', '')
                else m.profile_favorite_discipline end,
         profile_skating_since =
           case when p_patch ? 'skating_since'
                then (p_patch ->> 'skating_since')::int
                else m.profile_skating_since end
   where m.id = p_member_id
     and m.club_id = p_club_id
     and m.deleted_at is null;

  get diagnostics v_hit = row_count;
  if v_hit = 0 then
    raise exception 'membership not found';
  end if;
end;
$$;

comment on function app.set_self_profile(uuid, uuid, jsonb) is
  'Schreibt AUSSCHLIESSLICH das Selbst-Profil (motto/favorite_discipline/skating_since) der eigenen Person oder des eigenen Kindes. security definer, weil es fuer Erziehungsberechtigte KEINE UPDATE-Policy auf die Kind-Zeile gibt (0007 = can_manage_members, 0016 = profile_id = auth.uid()) — eine Vormund-Policy waere ein ZEILEN-Recht und damit ein Eskalationspfad (role=admin auf der Kind-Zeile; protect_club_membership greift dort nicht, weil profile_id NULL ist). Diese Funktion kann per Bauart nur drei Spalten. Rechtepruefung: can_act_for_member + Trigger app.protect_self_profile (status=active, Urheberschaft). p_patch: fehlender Schluessel = unveraendert, null/'''' = loeschen.';

-- ############################################################################
-- TEIL 2 — TRAININGSBETEILIGUNG
-- ############################################################################

-- ----------------------------------------------------------------------------
-- 2.1 Das Stufenmodell fuer das LESEN. Bauform woertlich nach
--     app.can_read_routine (0026:118-150) — dieselbe Frage, dieselbe Antwort-
--     form, damit hier kein zweites Regelwerk entsteht.
--
--     >= read_all (3) : alles im Verein            (Default: trainer und hoeher)
--     =  read_team (2): die betreuten Teams        (kein Default — im Admin waehlbar)
--     >= read_own  (1): eigene + eigene Kinder     (Default: member, treasurer)
--     none        (0) : nichts
--
--     'edit' (4) und 'manage' (5) liegen ueber read_all und sind damit
--     eingeschlossen — genau so, wie RBAC-DESIGN §2 die Skala meint. Deshalb
--     sieht der coach (Default 'edit') weiter alles: er trainiert sie.
--
--     is_platform_admin behaelt den Cross-Club-READ-Bypass wie ueberall sonst
--     (0025:92) — sonst braeche der Betreiber-Support.
-- ----------------------------------------------------------------------------
create or replace function app.can_read_attendance(p_club_id uuid, p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_platform_admin()
      or app.cap_rank(p_club_id, 'attendance') >= app.level_rank('read_all')
      or (
        app.cap_rank(p_club_id, 'attendance') = app.level_rank('read_team')
        and exists (
          select 1
          from app.team_members tm
          where tm.member_id = p_member_id
            and tm.deleted_at is null
            and tm.team_id = any (app.coached_team_ids(p_club_id))
        )
      )
      or (
        app.cap_rank(p_club_id, 'attendance') >= app.level_rank('read_own')
        -- can_act_for_member und NICHT is_own_member: die Kinder ohne Konto
        -- (profile_id is null) haengen ausschliesslich an der Vormundschaft.
        and app.can_act_for_member(p_member_id)
      )
$$;

comment on function app.can_read_attendance(uuid, uuid) is
  'Lesesichtbarkeit der Anwesenheit als Stufenmodell ueber cap_rank(club,''attendance''): >=read_all alles; =read_team die betreuten Teams; >=read_own die eigene Zeile UND die der eigenen Kinder (can_act_for_member). Gegenstueck zu app.can_read_routine (0026).';

-- ----------------------------------------------------------------------------
-- 2.2 Die Policy. HIER liegt der eigentliche Auftrag — ohne diese Zeile waere
--     die Stufenaenderung unten reine Kosmetik (siehe Kopf).
--     INSERT/UPDATE bleiben unangetastet (has_cap 'edit', 0026:162-167).
-- ----------------------------------------------------------------------------
alter policy attendance_select on app.attendance
  using (app.can_read_attendance(club_id, member_id));

-- ----------------------------------------------------------------------------
-- 2.3 Die Startkonfiguration. Nur der attendance-Zweig wird aus der
--     Sammel-Zeile der Trainer-Module herausgeloest; alles andere ist
--     wortgleich 0031:73-164.
-- ----------------------------------------------------------------------------
create or replace function app.rbac_default_level(p_role_key text, p_capability text)
returns app.role_level
language plpgsql
stable
parallel safe
set search_path = ''
as $$
declare
  v_admin     boolean := p_role_key in ('owner', 'admin', 'moderator');
  v_manager   boolean := p_role_key in ('owner', 'admin', 'moderator', 'treasurer');
  v_trainer   boolean := p_role_key in ('owner', 'admin', 'moderator', 'coach', 'guest_coach');
  v_structure boolean := p_role_key in ('owner', 'admin', 'moderator', 'coach');
  v_locker    boolean := p_role_key in ('owner', 'admin', 'treasurer');
  v_top       app.role_level;
begin
  if p_role_key = 'owner' then
    select l into v_top
    from app.capabilities c
    cross join unnest(c.allowed_levels) as l
    where c.key = p_capability
    order by app.level_rank(l) desc
    limit 1;
    return coalesce(v_top, 'none');
  end if;

  case p_capability

    when 'members' then
      return case when v_manager then 'manage' else 'read_all' end;

    when 'member_contact' then
      return case when v_manager then 'read_all' else 'none' end;

    when 'roles', 'club_settings' then
      return case when v_admin then 'manage' else 'none' end;

    when 'departments' then
      return case when v_admin then 'manage'
                  when v_trainer then 'edit'
                  else 'none' end;

    when 'teams', 'events', 'competitions', 'tasks' then
      return case when v_structure then 'manage' else 'read_all' end;

    when 'team_coaches' then
      return case when v_admin then 'manage' else 'none' end;

    when 'routines' then
      return case when v_admin then 'manage'
                  when p_role_key in ('coach', 'guest_coach') then 'read_team'
                  else 'read_own' end;

    when 'routines_edit' then
      return case when v_trainer then 'edit' else 'none' end;

    -- NEU (0045) — der Befund des Nutzers: "trainingsbeteiligung an anderen
    -- mitgliedern als mitglied ... das kann trainer und hoeher sehen, aber rest
    -- nicht." Vorher stand 'attendance' in der Sammel-Zeile der Trainer-Module
    -- und damit fuer JEDEN Nicht-Trainer auf 'read_all'.
    --   v_trainer (owner/admin/moderator/coach/guest_coach) -> edit (>= read_all)
    --   alle uebrigen, ausdruecklich INKLUSIVE treasurer     -> read_own
    -- treasurer: kein Finanz-/Pflichtstunden-Pfad haengt daran (nachgemessen,
    -- siehe Kopf); ohne Zweck kein Zugriff auf Kinderdaten. Per Admin-UI je
    -- Verein jederzeit zurueckzuholen.
    when 'attendance' then
      return case when v_trainer then 'edit' else 'read_own' end;

    when 'training_slots', 'exercises', 'achievements', 'news',
         'media', 'documents', 'gallery', 'equipment', 'facilities',
         'regional_events' then
      return case when v_trainer then 'edit' else 'read_all' end;

    when 'facilities_booking', 'duty_hours', 'waitlists', 'checkins' then
      return case when v_trainer then 'edit' else 'read_own' end;

    when 'equipment_reservations' then
      return case when v_trainer then 'manage' else 'read_own' end;

    when 'lockers' then
      return case when v_locker then 'manage' else 'read_own' end;

    when 'finance' then
      return case when v_manager then 'manage' else 'read_own' end;

    when 'chat' then
      return case when v_trainer then 'read_all' else 'read_team' end;

    when 'anniversaries' then
      return case when p_role_key in ('admin', 'moderator', 'treasurer', 'coach')
                  then 'read_all' else 'read_team' end;

    else
      -- Unbekannte Faehigkeit: fail-closed. Kein stiller Vollzugriff.
      return 'none';
  end case;
end;
$$;

comment on function app.rbac_default_level(text, text) is
  'Startkonfiguration je Systemrolle × Fähigkeit. Bildet den HEUTIGEN Rechtestand ab (nicht RBAC-DESIGN §3 — Abweichungen siehe Kopf von 0023). Seit 0028 routines_edit = is_club_trainer. Seit 0031 team_coaches = nur Team-Verwalter, bewusst OHNE coach. Seit 0045 attendance: Nicht-Trainer (inkl. treasurer) = read_own statt read_all — und das Lesen haengt seither wirklich daran (attendance_select).';

-- ----------------------------------------------------------------------------
-- 2.4 BACKFILL des Bestands. rbac_seed_club ist idempotent per
--     `on conflict do nothing` (0024:54) — es ERGAENZT fehlende Zeilen, es
--     AENDERT keine bestehenden. Die attendance-Zeilen existieren aber schon
--     (mit 'read_all'), also braucht es ein ausdrueckliches UPDATE.
--
--     `and rp.level = 'read_all'` ist die Schranke, auf die es ankommt: nur wer
--     noch auf dem ALTEN Default steht, wird umgestellt. Hat ein Verein die
--     Stufe im Admin-UI bereits bewusst gesetzt (z. B. treasurer auf 'edit'),
--     bleibt seine Entscheidung stehen. Ein Backfill, der Konfiguration
--     ueberschreibt, ist ein Datenverlust mit Migrationsnummer.
--
--     Nur is_system-Rollen: eigene Vereinsrollen sind Handarbeit des Vereins,
--     die fasst ein Default-Wechsel nicht an.
-- ----------------------------------------------------------------------------
update app.role_permissions rp
   set level = 'read_own'
  from app.roles r
 where r.id = rp.role_id
   and r.is_system
   and r.key in ('member', 'treasurer')
   and rp.capability_key = 'attendance'
   and rp.level = 'read_all';

-- ----------------------------------------------------------------------------
-- 2.5 Das Etikett zieht der Wirklichkeit nach (0033). Ab jetzt nimmt die Stufe
--     "keine" das LESEN wirklich weg -> 'enforced'.
--     93j Block C prueft beide Richtungen: 'enforced' braucht eine
--     SELECT-Policy (hat es jetzt, ueber can_read_attendance), 'write_only'
--     darf keine haben (deshalb MUSS das Etikett hier wandern).
-- ----------------------------------------------------------------------------
update app.capabilities set enforcement = 'enforced' where key = 'attendance';

-- Kontrolle im Sinne von 0033:238-247: die Verteilung ist jetzt 4/2/8/18 = 32.
-- Faellt das hier, hat jemand parallel am Katalog gedreht, ohne 93j zu pflegen.
do $$
declare
  v_enforced int;
  v_write    int;
begin
  select count(*) into v_enforced from app.capabilities where enforcement = 'enforced';
  select count(*) into v_write    from app.capabilities where enforcement = 'write_only';
  if v_enforced <> 4 or v_write <> 8 then
    raise exception
      'capability enforcement nach 0045: erwartet enforced=4/write_only=8, ist %/%',
      v_enforced, v_write
      using hint = '0045 stellt attendance von write_only auf enforced. Passt die Verteilung nicht, ist 93j Block A ebenfalls faellig.';
  end if;
end $$;

commit;
