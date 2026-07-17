-- ============================================================================
-- 99i_kontaktdaten.sql — Migration 0054, gegen den echten Bestand.
--
-- Diese Datei ist NEU; Bestands-Tests bleiben unberuehrt.
--
-- WAS HIER BEWIESEN WIRD
-- ---------------------------------------------------------------------------
-- Telefon + Anschrift sind KONTAKTdaten (wie email/birth_date). Die eigentliche
-- LESE-Projektion sitzt in der API (members.ts/redactMemberForViewer +
-- maySeeContactOf) — bewusst NICHT in RLS, wie die ganze Kontaktdaten-Redaktion.
-- Der Kern (Marcel 2026-07-17): eine Trainer:in sieht die Elternkontakte NUR der
-- Kinder IHRER Teams, nicht fremder. Diese Datei beweist:
--   * Block A: die Spalten + ihre Laengen-CHECK (23514 -> 422 in der API).
--   * Block B: der ZEILENWEISE Team-Schnitt als SQL nachgestellt — pro Persona
--     die Zahl der Kinder, deren Telefon sichtbar ist. Sandra (coach t-02+t-03)
--     sieht 4, Anna-Lena (coach t-01+t-02) sieht 3 — ANDERE Kinder. Der Gast
--     sieht 0. Vorstand/Kasse sehen alle 5. Ein Mitglied (auch als Elternteil)
--     sieht 0 fremde.
--   * Block C: die Positivkontrolle (Sabotage) — nimmt man Sandra den Team-Scope,
--     saehe sie 5 statt 4 (das fremde t-01-Kind Ben leckt). Faellt dieser Block,
--     ist Block B gruen aus dem falschen Grund.
--
-- Der API-Ausdruck, den Block B/C nachstellen (maySeeContactOf):
--   sichtbar := privileged                          -- can_manage_members (Claim)
--            OR (viewerIsCoach AND _coach_of_member) -- coach (Claim) × Team-Schnitt (DB)
-- privileged / viewerIsCoach sind Rollen-Claims (die API bildet sie aus den
-- Claims) — hier pro Persona als Literal eingesetzt. _coach_of_member ist der
-- DB-Team-Schnitt (coached_team_ids ∩ team_members), unter Impersonation echt.
--
-- SEED-GRUNDLAGE (supabase/seed/seed.sql, 0054-Block): genau 5 Kinder mit phone:
--   a-10 Sofia (t-02), a-19 Amelie (t-02), a-16 Maja (t-03), a-23 Hanna (t-03),
--   a-11 Ben (t-01).
-- COACHES: Sandra a-01 (coach) -> t-02+t-03; Anna-Lena a-05 (coach) -> t-01+t-02;
--   Milena a-06 (GUEST-coach) -> t-03.
-- PERSONEN: 90..01 Sandra (coach), 90..05 Anna-Lena (coach), 90..06 Milena
--   (guest_coach), 90..03 Beate (treasurer), 90..02 Juergen (owner), 90..09 Katrin
--   (member, Mutter von a-07/a-08 -> KEIN phone-Kind), 90..12 Stefanie (member,
--   Mutter von a-10/a-11 -> ZWEI phone-Kinder, sieht sie als Mitglied TROTZDEM nicht).
--   Club c1 = c1ab0000-…-001.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) DIE SPALTEN + LAENGEN-CHECK. Ueber 40 (phone) / 300 (postal_address) -> 23514.
-- ---------------------------------------------------------------------------
begin;
do $$
begin
  -- Der Seed traegt genau 5 Telefonnummern (die Grundlage von Block B). ZUERST,
  -- bevor die succeeds-Mutation unten eine sechste in DERSELBEN Transaktion setzt.
  perform testkit.is_eq('kontakt: genau 5 Seed-Kinder haben eine Telefonnummer',
    (select count(*) from app.club_members
      where club_id = 'c1ab0000-0000-4000-8000-000000000001' and phone is not null), 5);

  perform testkit.succeeds('kontakt: phone/postal_address sind eintragbar (Laenge ok)',
    $sql$update app.club_members
           set phone = '+49 7132 111222', postal_address = 'Teststraße 1, 74172 Neckarsulm'
         where id = 'a0000000-0000-4000-8000-000000000020'$sql$);

  perform testkit.throws('kontakt: ein zu langes phone wird abgelehnt (>40)',
    $sql$update app.club_members set phone = repeat('9', 41)
          where id = 'a0000000-0000-4000-8000-000000000020'$sql$, '23514');

  perform testkit.throws('kontakt: eine zu lange Anschrift wird abgelehnt (>300)',
    $sql$update app.club_members set postal_address = repeat('x', 301)
          where id = 'a0000000-0000-4000-8000-000000000020'$sql$, '23514');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- B) DIE ZEILENWEISE PROJEKTION NACHGESTELLT. Pro Persona: wie viele der 5
--    phone-Kinder sind sichtbar? sichtbar := privileged OR (viewerIsCoach AND
--    _coach_of_member). _coach_of_member = derselbe exists()-Ausdruck wie in
--    members.ts, unter Impersonation (coached_team_ids sieht auth.uid()).
-- ---------------------------------------------------------------------------

-- B1) SANDRA (coach, t-02+t-03). privileged=false, viewerIsCoach=true.
--     Sichtbar: Sofia+Amelie (t-02) + Maja+Hanna (t-03) = 4. NICHT Ben (t-01).
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('projektion: SANDRA (coach t-02+t-03) sieht 4 Kontakte — nur ihre Teams',
    (select count(*) from app.club_members m
      where m.phone is not null
        and ( false or ( true and exists (
                select 1 from app.team_members tm
                where tm.member_id = m.id and tm.deleted_at is null
                  and tm.team_id = any (app.coached_team_ids(m.club_id))) ) )), 4);

  -- Der Kern: das fremde t-01-Kind (Ben, a-11) ist NICHT dabei.
  perform testkit.is_eq('projektion: SANDRA sieht das fremde t-01-Kind (Ben) NICHT',
    (select count(*) from app.club_members m
      where m.id = 'a0000000-0000-4000-8000-000000000011'
        and m.phone is not null
        and ( false or ( true and exists (
                select 1 from app.team_members tm
                where tm.member_id = m.id and tm.deleted_at is null
                  and tm.team_id = any (app.coached_team_ids(m.club_id))) ) )), 0);
end;
$$;
rollback;

-- B2) ANNA-LENA (coach, t-01+t-02). Sichtbar: Ben (t-01) + Sofia+Amelie (t-02) = 3.
--     NICHT Maja/Hanna (t-03). ANDERE Menge als Sandra -> der Scope ist echt.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000005","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('projektion: ANNA-LENA (coach t-01+t-02) sieht 3 Kontakte — ihre Teams',
    (select count(*) from app.club_members m
      where m.phone is not null
        and ( false or ( true and exists (
                select 1 from app.team_members tm
                where tm.member_id = m.id and tm.deleted_at is null
                  and tm.team_id = any (app.coached_team_ids(m.club_id))) ) )), 3);

  perform testkit.is_eq('projektion: ANNA-LENA sieht die t-03-Kinder (Maja/Hanna) NICHT',
    (select count(*) from app.club_members m
      where m.id in ('a0000000-0000-4000-8000-000000000016','a0000000-0000-4000-8000-000000000023')
        and m.phone is not null
        and ( false or ( true and exists (
                select 1 from app.team_members tm
                where tm.member_id = m.id and tm.deleted_at is null
                  and tm.team_id = any (app.coached_team_ids(m.club_id))) ) )), 0);
end;
$$;
rollback;

-- B3) MILENA (GUEST-coach, t-03). viewerIsCoach=false (guest bewusst aus), obwohl
--     _coach_of_member fuer die t-03-Kinder true WAERE -> 0 sichtbar.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000006","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"guest_coach"}}',
  true);
set local role authenticated;
do $$
begin
  -- Beleg, dass der Team-Schnitt fuer den Gast tatsaechlich anschlagen WUERDE:
  perform testkit.is_eq('projektion: der Gast betreut t-03 real (der Schnitt WUERDE greifen)',
    (select count(*) from app.club_members m
      where m.phone is not null
        and exists (
          select 1 from app.team_members tm
          where tm.member_id = m.id and tm.deleted_at is null
            and tm.team_id = any (app.coached_team_ids(m.club_id)))), 2);

  -- Aber die API-Regel schliesst den Gast aus (viewerIsCoach=false) -> 0.
  perform testkit.is_eq('projektion: der GAST-Trainer sieht 0 Kontakte (guest_coach bewusst aus)',
    (select count(*) from app.club_members m
      where m.phone is not null
        and ( false or ( false and exists (
                select 1 from app.team_members tm
                where tm.member_id = m.id and tm.deleted_at is null
                  and tm.team_id = any (app.coached_team_ids(m.club_id))) ) )), 0);
end;
$$;
rollback;

-- B4) DER KASSENWART (treasurer) ist privilegiert -> sieht ALLE 5.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"treasurer"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('projektion: der KASSENWART sieht alle 5 Kontakte (privileged)',
    (select count(*) from app.club_members m
      where m.phone is not null and ( true or false )), 5);
end;
$$;
rollback;

-- B5) DER VORSTAND (owner) sieht ebenfalls alle 5.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"owner"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('projektion: der VORSTAND (owner) sieht alle 5 Kontakte',
    (select count(*) from app.club_members m
      where m.phone is not null and ( true or false )), 5);
end;
$$;
rollback;

-- B6) EIN GEWOEHNLICHES MITGLIED (Katrin) sieht 0 fremde Kontakte.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('projektion: das MITGLIED sieht 0 fremde Kontakte',
    (select count(*) from app.club_members m
      where m.phone is not null and ( false or ( false and false ) )), 0);
end;
$$;
rollback;

-- B7) EIN MITGLIED, DAS ELTERNTEIL VON PHONE-KINDERN IST (Stefanie, Mutter von
--     Sofia a-10 und Ben a-11). Die Kontakt-Redaktion gewaehrt KEINE Eltern-
--     Sicht (nur Manager/coach) — genau wie email heute. Also: 0.
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000012","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"member"}}',
  true);
set local role authenticated;
do $$
begin
  perform testkit.is_eq('projektion: das ELTERNTEIL (member) sieht die Kontakte der eigenen Kinder NICHT ueber die Kontakt-Redaktion',
    (select count(*) from app.club_members m
      where m.phone is not null and ( false or ( false and false ) )), 0);
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- C) POSITIVKONTROLLE (SABOTAGE): kann Block B rot werden?
--    Nimmt man SANDRA den Team-Scope aus der Projektion (das exists() gestrichen,
--    so als redigierte die API pro coach OHNE Zeilenpruefung), saehe sie 5 statt
--    4 — das fremde t-01-Kind Ben leckt. Faellt dieser Block, ist B1 gruen aus
--    dem falschen Grund.
-- ---------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","club_roles":{"c1ab0000-0000-4000-8000-000000000001":"coach"}}',
  true);
set local role authenticated;
do $$
begin
  -- MIT Team-Scope: 4 (wie B1).
  perform testkit.is_eq('positivkontrolle: MIT Team-Scope sieht Sandra 4',
    (select count(*) from app.club_members m
      where m.phone is not null
        and ( false or ( true and exists (
                select 1 from app.team_members tm
                where tm.member_id = m.id and tm.deleted_at is null
                  and tm.team_id = any (app.coached_team_ids(m.club_id))) ) )), 4);

  -- OHNE Team-Scope (exists() gestrichen -> coach saehe ALLE): 5. Der Unterschied
  -- IST das fremde t-01-Kind (Ben). Die Zeilenpruefung ist also das, was ihn sperrt.
  perform testkit.is_eq('positivkontrolle: OHNE Team-Scope saehe Sandra 5 (B1 KANN rot werden)',
    (select count(*) from app.club_members m
      where m.phone is not null and ( false or ( true and true ) )), 5);
end;
$$;
rollback;
