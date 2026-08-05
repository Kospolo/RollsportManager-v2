-- ============================================================================
-- 0089 — Testphasen-Länge konfigurierbar (Betreiber-Einstellung)
--
-- Bisher war die Selbst-Registrierungs-Testphase mit 30 Tagen fest im API-Code
-- (routes/clubs.ts). Sie wird zur Betreiber-Einstellung: internal
-- .platform_settings bekommt eine `billing`-Sektion { trial_days:int }, Default
-- 14. Der Betreiber ändert sie über GET/PATCH /platform/settings.
--
-- WARUM eine SECURITY-DEFINER-Funktion: platform_settings ist per RLS NUR für
-- Betreiber lesbar (0019). Die Vereins-Registrierung läuft aber als frisch
-- angelegte Person, NICHT als Betreiber — sie darf die Zeile nicht lesen. Die
-- Funktion `app.default_trial_days()` liest den einen Zahlenwert unter Umgehung
-- der RLS (definer-Rechte), gibt nur die Zahl heraus und fällt auf 14 zurück.
-- ============================================================================

alter table internal.platform_settings
  add column if not exists billing jsonb not null default '{"trial_days": 14}'::jsonb;

comment on column internal.platform_settings.billing is
  'Betreiber-Abrechnungskonfiguration: { trial_days:int } — Default-Länge der Selbst-Registrierungs-Testphase in Tagen.';

-- Bestehende Singleton-Zeile nachziehen (leere/fehlende billing → Default 14).
update internal.platform_settings
   set billing = '{"trial_days": 14}'::jsonb
 where id = 1 and (billing is null or billing = '{}'::jsonb);

-- RLS-sichere Lesefunktion für die Registrierung (und jeden anderen Nicht-
-- Betreiber-Pfad). Nur der Zahlenwert, mit hartem Fallback 14 und Clamp 1..365.
create or replace function app.default_trial_days()
returns integer
language sql
stable
security definer
set search_path = internal, app, pg_temp
as $$
  select greatest(1, least(365,
    coalesce((select (billing->>'trial_days')::int
                from internal.platform_settings where id = 1), 14)))
$$;

comment on function app.default_trial_days() is
  'Default-Testphasenlänge (Tage) aus internal.platform_settings.billing.trial_days; SECURITY DEFINER, weil die Registrierung die Betreiber-Zeile nicht per RLS lesen darf. Fallback 14, Clamp 1..365.';

grant execute on function app.default_trial_days() to authenticated, anon;
