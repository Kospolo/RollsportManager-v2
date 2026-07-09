# services/api

Später: die dünne Hono-API-Schicht (Node/TS) gemäß ADR-E2.

Verantwortlich für ALLE Writes und Geld-Operationen, Entitlements (nur hier schreibbar), Webhooks (Stripe/RevenueCat) und OpenAPI-Export für den Codegen. RLS in der Datenbank ist zweite Verteidigungslinie, nie einzige.

In der aktuellen Portal-Phase existiert noch keine API — das Web-Portal läuft vollständig auf Mock-Daten.
