-- ============================================================================
-- 93j_capability_enforcement.sql — das Etikett "wirkt / wirkt nicht" gegen die
-- Wirklichkeit nachrechnen (Migration 0033).
--
-- WARUM DIESE DATEI
-- ---------------------------------------------------------------------------
-- app.capabilities.enforcement sagt dem Admin-UI, ob die Stufe "keine" bei
-- dieser Faehigkeit wirklich etwas abschaltet. Davon haengt eine BESCHRIFTUNG
-- ab, die der Nutzer glaubt. Eine hand-gepflegte Spalte, die "hier wirkt
-- nichts" behauptet, waere dieselbe Falle wie 93c vor 93g: gruen, aber nicht
-- faehig, rot zu werden — und damit wertlos.
--
-- Diese Datei rechnet das Etikett deshalb gegen app.capability_policy_usage()
-- nach (die liest pg_policies) und stellt in Block D den Drift NACH, statt ihn
-- zu behaupten.
--
-- EHRLICH BENANNT: DIE GRENZE DER AUTOMATIK
-- ---------------------------------------------------------------------------
-- capability_policy_usage() sieht nur die DATENBANK. Die API setzt zusaetzlich
-- durch (requireCap in TypeScript) — das kann kein SQL-Test lesen. Diese
-- Stellen stehen unten als ausdrueckliche Liste, mit dem grep, aus dem sie
-- stammt. Wer dort einen requireCap ergaenzt, muss die Liste pflegen: die
-- Automatik faengt das NICHT. Das ist eine bewusst benannte Luecke, keine
-- stille.
--
-- Bezug: Migration 0033. Diese Datei ist NEU (Bestands-Tests bleiben unberührt).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) Der Katalog ist vollstaendig eingestuft. Kein 'unenforced' aus Versehen:
--    0033 setzt alle 32 ausdruecklich, der Default ist nur das Sicherheitsnetz.
-- ---------------------------------------------------------------------------
begin;
do $$
begin
  -- 0069: der Katalog ist um 'coach_notes' gewachsen (32 -> 33, enforced 4 -> 5).
  -- Die interne Trainer-Notiz braucht eine KONFIGURIERBARE Faehigkeit, weil der
  -- Chef zwei Dinge zugleich verlangt hat: der Kassenwart liest voreingestellt
  -- NICHT, und der Verein soll es selbst umstellen koennen. Beides zusammen gibt
  -- es nur in dieser Matrix.
  --   0055 hatte auf eine neue Faehigkeit noch VERZICHTET und genau diese Zeile
  --   als Grund genannt. Der Verzicht war kein Verbot: der Waechter am Ende von
  --   0033 sagt woertlich "Neue Faehigkeit? Dann gehoert sie in 0033 (bzw. eine
  --   Folge-Migration) eingestuft — und in 93j." Praezedenzfall ist 0045
  --   (attendance), das dieselbe Buchhaltung schon einmal fortgeschrieben hat.
  --   Die ZUSICHERUNGEN (B/C/D) sind unveraendert; hier steht nur die Zahl.
  -- 'enforced' ist fuer coach_notes nachgerechnet, nicht behauptet:
  -- member_coach_notes_select ruft app.can_read_coach_note, die has_cap
  -- kapselt -> Block C findet die SELECT-Policy. 99pA misst zusaetzlich die
  -- WIRKUNG an echten Zeilen (Stufe 'none' -> 0 Zeilen).
  perform testkit.is_eq('cap-enforcement: der Katalog hat 33 Faehigkeiten',
    (select count(*) from app.capabilities), 33);

  -- 0045: 'attendance' ist von write_only nach enforced gewandert (9->8, 3->4).
  -- Kein Rueckbau dieser Kontrolle, sondern ihr Zweck: attendance_select fragt
  -- seit 0045 die Faehigkeit (app.can_read_attendance), also nimmt die Stufe
  -- "keine" dort jetzt wirklich das LESEN weg. Haette man die Zahl gelassen,
  -- waere Block C rot geworden ("write_only, aber SELECT-Policy vorhanden") —
  -- die Nachrechnung hat den Wechsel also selbst gefunden. Die ZUSICHERUNGEN
  -- (B/C/D) sind unveraendert; hier steht nur die Buchhaltung.
  perform testkit.is_eq('cap-enforcement: 5 x enforced (routines, lockers, anniversaries, attendance, coach_notes)',
    (select count(*) from app.capabilities where enforcement = 'enforced'), 5);
  perform testkit.is_eq('cap-enforcement: 2 x partial (finance, member_contact)',
    (select count(*) from app.capabilities where enforcement = 'partial'), 2);
  perform testkit.is_eq('cap-enforcement: 8 x write_only',
    (select count(*) from app.capabilities where enforcement = 'write_only'), 8);
  perform testkit.is_eq('cap-enforcement: 18 x unenforced',
    (select count(*) from app.capabilities where enforcement = 'unenforced'), 18);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B) DER KERN, HALBZEIT 1: Was die DB durchsetzt, darf nicht als wirkungslos
--    etikettiert sein.
--
--    Jede Faehigkeit, die in IRGENDEINER Policy vorkommt, muss ein Etikett
--    ungleich 'unenforced' tragen. Wuerde eine kuenftige Migration z. B.
--    news_select auf has_cap(...,'news',...) umstellen, ohne 0033+ zu pflegen,
--    faellt genau diese Zeile.
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  v_bad text;
begin
  select string_agg(distinct u.capability_key, ', ')
    into v_bad
    from app.capability_policy_usage() u
    join app.capabilities c on c.key = u.capability_key
   where c.enforcement = 'unenforced';

  if v_bad is null then
    perform testkit.ok('cap-enforcement: keine Faehigkeit ist als wirkungslos etikettiert, obwohl eine Policy sie abfragt');
  else
    perform testkit.fail('cap-enforcement: keine Faehigkeit ist als wirkungslos etikettiert, obwohl eine Policy sie abfragt',
      format('Etikett "unenforced", aber in einer Policy benutzt: %s — 0033 nachziehen', v_bad));
  end if;
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- C) DER KERN, HALBZEIT 2: Wer "keine sperrt das Lesen" behauptet, muss eine
--    SELECT-Policy vorweisen — oder API-only sein.
--
--    'enforced'/'partial' heisst: die Stufe wirkt (ganz oder teilweise) auf das
--    LESEN. In der DB ist das genau dann wahr, wenn eine SELECT-Policy die
--    Faehigkeit abfragt. Ausnahme mit Namen: 'anniversaries' und
--    'member_contact' werden AUSSCHLIESSLICH von der API durchgesetzt
--    (reports.ts:305 / reports.ts:309) — dafuer gibt es keine Policy, und diese
--    Liste ist die einzige Stelle, an der das steht.
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  -- Quelle: grep -rn "requireCap(" services/api/src  (Stand 2026-07-16)
  --   invoices.ts:135   finance:manage        budgets.ts:199   finance:manage
  --   reports.ts:162    finance:manage        reports.ts:305   anniversaries:read_team
  --   reports.ts:309    member_contact:read_all
  --   donations.ts:120  finance:manage        events.ts:228    attendance:edit
  --   roles.ts:185/247/304/371/489  roles:manage
  --   roles.ts:590      team_coaches:manage
  -- Davon LESE-durchsetzend und ohne jede Policy: diese zwei.
  v_api_only text[] := array['anniversaries', 'member_contact'];
  v_bad text;
begin
  select string_agg(c.key, ', ')
    into v_bad
    from app.capabilities c
   where c.enforcement in ('enforced', 'partial')
     and not (c.key = any (v_api_only))
     and not exists (
       select 1 from app.capability_policy_usage() u
        where u.capability_key = c.key and u.cmd = 'SELECT');

  if v_bad is null then
    perform testkit.ok('cap-enforcement: jede lese-durchsetzende Faehigkeit hat eine SELECT-Policy (oder steht als API-only benannt)');
  else
    perform testkit.fail('cap-enforcement: jede lese-durchsetzende Faehigkeit hat eine SELECT-Policy (oder steht als API-only benannt)',
      format('behauptet Lese-Durchsetzung, hat aber keine SELECT-Policy: %s', v_bad));
  end if;

  -- Und umgekehrt: 'write_only' darf KEINE SELECT-Policy haben — sonst
  -- verspricht das UI zu wenig (harmloser, aber genauso falsch).
  select string_agg(c.key, ', ')
    into v_bad
    from app.capabilities c
   where c.enforcement = 'write_only'
     and exists (
       select 1 from app.capability_policy_usage() u
        where u.capability_key = c.key and u.cmd = 'SELECT');

  if v_bad is null then
    perform testkit.ok('cap-enforcement: keine "write_only"-Faehigkeit haengt heimlich doch an einer SELECT-Policy');
  else
    perform testkit.fail('cap-enforcement: keine "write_only"-Faehigkeit haengt heimlich doch an einer SELECT-Policy',
      format('Etikett "write_only", aber SELECT-Policy vorhanden: %s', v_bad));
  end if;
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- D) KANN DIE KONTROLLE ROT WERDEN? Nachgestellt, nicht behauptet.
--
--    Der Drift, vor dem B schuetzt, wird hier echt herbeigefuehrt: 'news' ist
--    heute 'unenforced' (belegt: der Key kommt in keiner Policy vor). Wir
--    haengen eine Policy an eine Tabelle, die has_cap(...,'news',...) fragt —
--    und verlangen, dass B das FINDET. Faellt dieser Block, ist die ganze
--    Nachrechnung blind.
--
--    Alles in begin/rollback; die Policy ueberlebt den Test nicht.
-- ---------------------------------------------------------------------------
begin;
do $$
begin
  perform testkit.is_eq('cap-enforcement: Ausgangslage — "news" wird von KEINER Policy abgefragt',
    (select count(*) from app.capability_policy_usage() where capability_key = 'news'), 0);
  perform testkit.is_eq('cap-enforcement: Ausgangslage — "news" ist als wirkungslos etikettiert',
    (select count(*) from app.capabilities where key = 'news' and enforcement = 'unenforced'), 1);
end;
$$;

-- Der nachgestellte Drift: jemand stellt news_select auf die Faehigkeit um und
-- vergisst das Etikett.
create policy zukunft_news_select on app.news
  for select to authenticated
  using (app.has_cap(club_id, 'news', 'read_all'));

do $$
declare
  v_bad text;
begin
  -- D1: der Detektor findet die neue Fundstelle.
  perform testkit.is_eq('cap-enforcement: der Detektor FINDET die neue news-Policy',
    (select count(*) from app.capability_policy_usage()
      where capability_key = 'news' and cmd = 'SELECT'), 1);

  -- D2: und die Kontrolle aus Block B schlaegt an. Wortgleich mit B — hier
  --     MUSS sie einen Treffer liefern, dort KEINEN.
  select string_agg(distinct u.capability_key, ', ')
    into v_bad
    from app.capability_policy_usage() u
    join app.capabilities c on c.key = u.capability_key
   where c.enforcement = 'unenforced';

  if v_bad = 'news' then
    perform testkit.ok('cap-enforcement: die Kontrolle aus Block B WIRD ROT, wenn das Etikett driftet');
  else
    perform testkit.fail('cap-enforcement: die Kontrolle aus Block B WIRD ROT, wenn das Etikett driftet',
      format('erwartet "news", bekommen: %s', coalesce(v_bad, '<nichts — die Nachrechnung ist BLIND>')));
  end if;
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- E) Der Helfer loest gekapselte Faehigkeiten auf. 'routines' steht in KEINER
--    Policy woertlich — nur in app.can_read_routine. Ohne diese Aufloesung
--    wuerde C die Faehigkeit faelschlich als "behauptet Lesen, hat aber keine
--    SELECT-Policy" anzeigen und der Test waere von Anfang an rot. Dass er
--    gruen ist, ist also ein Ergebnis — dieser Block sagt, warum.
-- ---------------------------------------------------------------------------
begin;
do $$
begin
  perform testkit.is_eq('cap-enforcement: "routines" wird ueber app.can_read_routine gefunden (4 SELECT-Policies)',
    (select count(*) from app.capability_policy_usage()
      where capability_key = 'routines' and cmd = 'SELECT'), 4);

  perform testkit.is_eq('cap-enforcement: "lockers" wird direkt gefunden (SELECT auf app.lockers)',
    (select count(*) from app.capability_policy_usage()
      where capability_key = 'lockers' and cmd = 'SELECT' and object = 'lockers'), 1);

  -- Gegenprobe zur Messung aus 0033: 'finance' setzt LESEN nur auf zwei
  -- Tabellen durch — deshalb 'partial' und nicht 'enforced'. Faellt diese
  -- Zeile, weil eine dritte Tabelle dazukommt, gehoert das Etikett geprueft
  -- (und die Beschriftung im UI womoeglich entschaerft).
  perform testkit.is_eq('cap-enforcement: "finance" sperrt das Lesen nur auf invoices + ledger_entries (daher partial)',
    (select count(*) from app.capability_policy_usage()
      where capability_key = 'finance' and cmd = 'SELECT'), 2);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- F) Das Etikett ist DESKRIPTIV, nicht autorisierend. Es darf nirgends in
--    einem Praedikat auftauchen — sonst waere aus einer Beschriftung heimlich
--    ein Recht geworden.
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  v_bad text;
begin
  select string_agg(format('%s.%s', schemaname, policyname), ', ')
    into v_bad
    from pg_policies
   where schemaname in ('app', 'api')
     and (coalesce(qual, '') || coalesce(with_check, '')) like '%enforcement%';

  if v_bad is null then
    perform testkit.ok('cap-enforcement: keine Policy autorisiert anhand von enforcement (es ist eine Beschriftung, kein Recht)');
  else
    perform testkit.fail('cap-enforcement: keine Policy autorisiert anhand von enforcement (es ist eine Beschriftung, kein Recht)',
      format('Policies mit enforcement im Praedikat: %s', v_bad));
  end if;
end;
$$;
rollback;
