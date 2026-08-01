-- ============================================================================
-- 0088_konto_loeschen_consents_cascade.sql — Korrektur zu 0087.
--
-- 0087 stellte consents.granted_by_profile_id auf ON DELETE SET NULL. Das war
-- falsch: app.consents ist APPEND-ONLY (Trigger app.deny_consent_mutation, 0034)
-- — JEDES UPDATE wirft 42501, auch das vom FK ausgeloeste SET NULL. Beim
-- Konto-Loeschen (DELETE /me) brach die Kaskade deshalb ab (403).
--
-- RICHTIG ist CASCADE: der Trigger ERLAUBT DELETE ausdruecklich fuer
-- privilegierte Pfade (Kommentar 0034: „sonst waere weder ein Loeschersuchen
-- (Art. 17) noch das Loeschen eines Vereins (on delete cascade) moeglich").
-- Wird der Erteiler geloescht, verschwindet die von ihm erteilte Einwilligung
-- mit ihm (die eigene Zustimmung des Kontos ist ohnehin subject=self → CASCADE
-- ueber subject_profile_id). support_messages.author_profile_id bleibt SET NULL
-- (0087) — dort gibt es keine Append-only-Wache, die Nachricht ueberlebt
-- entkoppelt.
-- ============================================================================

begin;

-- NOT NULL wieder herstellen ist unnoetig (CASCADE loescht die Zeile); die
-- Spalte darf nullable bleiben. Nur die FK-Regel von SET NULL auf CASCADE.
alter table app.consents
  drop constraint consents_granted_by_profile_id_fkey,
  add constraint consents_granted_by_profile_id_fkey
    foreign key (granted_by_profile_id) references app.profiles (id) on delete cascade;

comment on column app.consents.granted_by_profile_id is
  'Wer die Einwilligung erteilt hat. ON DELETE CASCADE (0088): wird das Konto des Erteilers geloescht (Art. 17), verschwindet die von ihm erteilte Einwilligung mit ihm. Der Append-only-Trigger erlaubt DELETE fuer privilegierte Pfade.';

commit;
