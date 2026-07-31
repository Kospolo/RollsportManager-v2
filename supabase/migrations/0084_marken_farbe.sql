-- ============================================================================
-- 0084_marken_farbe.sql — Die einstellbare Marken-/Akzentfarbe des Vereins.
--
-- AUSGANGSLAGE (selbst geprueft): Die Web-App hat die Farbwahl bereits als
-- Oberflaeche (lib/brand/*, 7 Presets + freie Hex-Farbe, WCAG-AA-hart), aber
-- OHNE Server-Persistenz — mappers.ts setzt brandColor/brandPreset bewusst auf
-- null ("echte DB-Persistenz ist nachgelagert"), der api-Dev-Modus spiegelte die
-- Auswahl nur in localStorage. Damit kann die native App (iOS/Android) die Farbe
-- NICHT abrufen. Diese Migration ist die fehlende Server-Seite: zwei Spalten am
-- Verein, die alle Clients lesen und die Admins setzen.
--
-- === MODELL: brand_preset (Schluessel) ODER brand_color (freier Hex) ===
-- Genau wie das Web-Modell (resolveBrandTheme): ein bekannter Preset-Schluessel
-- gewinnt vor einer freien Hex-Farbe; ist beides leer, gilt der Standard
-- ("Beere", = tokens.css). Beide Spalten sind nullable — null ist der schoene
-- Normalfall "unveraendert". Kein eigenes Fuenferpaket in der DB: die
-- Ableitung (Hell/Dunkel, AA-Gate) rechnet der CLIENT, so wie bisher. Die DB
-- traegt nur die ROHE Auswahl.
--
-- === SICHTBARKEIT: die Falle aus 0035 (Positivliste) ===
-- app.clubs ist fuer `authenticated` eine POSITIVLISTE (0035, festgenagelt in
-- 99e). Eine neu hinzugefuegte Spalte erbt KEIN Leserecht und bleibt unsichtbar,
-- bis sie hier ausdruecklich freigegeben wird. Eine Markenfarbe ist KEIN
-- Geheimnis — sie steht in der Shell jedes Mitglieds — und MUSS lesbar sein
-- (GET /clubs traegt sie ueber clubSchema). Also: Leserecht erteilen. Damit
-- bleibt die in 99e (e) festgenagelte Sperrliste EXAKT {join_code,
-- join_code_normalized} — die neuen Spalten sind selectbar und stehen nicht drin.
--
-- === SCHREIBRECHT ===
-- UPDATE bleibt Tabellenrecht unter der bestehenden clubs_update-RLS
-- (owner/admin, 0002/0007) — gesetzt wird ueber PATCH /clubs/{id}
-- (clubUpdateSchema), exakt wie die uebrigen Stammdaten (0081). Kein neuer
-- Endpunkt, keine neue Policy.
--
-- === INTEGRITAET: die DB ist die letzte Schranke ===
-- Die Web-UI blockt schon unlesbare Freifarben (derive.ts), aber ein direkter
-- API-Aufruf koennte Muell schreiben. Zwei CHECKs halten die Spalten sauber:
--   * brand_color: #RRGGBB (dieselbe Hex-Form wie die Sparten-Farbe, 0062).
--   * brand_preset: einer der SIEBEN kuratierten Schluessel (presets.ts).
-- Ein nicht-AA-tauglicher, aber formgueltiger Hex bleibt ungefaehrlich: der
-- Client leitet ihn ab, das AA-Gate lehnt ihn ab und faellt auf den Standard
-- zurueck (fail-safe) — Text wird nie unlesbar.
-- ============================================================================

begin;

alter table app.clubs
  add column brand_color text
    check (brand_color is null or brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column brand_preset text
    check (brand_preset is null or brand_preset in
      ('beere','petrol','indigo','wald','terra','pflaume','ozean'));

comment on column app.clubs.brand_color is
  'Optionale freie Marken-/Akzentfarbe als #RRGGBB. Roh gespeichert; das AA-abgesicherte Fuenferpaket (Hell/Dunkel) leitet der Client ab (lib/brand/derive.ts). Nachrangig zu brand_preset. Gesetzt ueber PATCH /clubs/{id} (owner/admin).';

comment on column app.clubs.brand_preset is
  'Optionaler kuratierter Marken-Preset-Schluessel (beere|petrol|indigo|wald|terra|pflaume|ozean, presets.ts). Vorrang vor brand_color. null = Standard (Beere).';

-- Positivliste (0035/99e): neue Spalten brauchen explizit Leserecht, sonst sind
-- sie unsichtbar (select 42501). Marke ist oeffentlich — Leserecht erteilen.
-- Damit bleibt die gesperrte Menge in 99e (e) unveraendert {join_code, …}.
grant select (brand_color, brand_preset) on app.clubs to authenticated;

commit;
