# Migration: `lib/mock` → Daten-Facade `lib/data`

Leitfaden für die sechs Screen-Teams (Dashboard, Termine, Mitglieder, Küren,
Wettkampf, Finanzen). Die Facade ist die **einzige** erlaubte Datenquelle in
Screens — kein `lib/mock`-Import, kein eigenes `fetch` mehr.

```ts
import { data, dataSource, useData, fullName, isNotImplemented } from "@/lib/data";
```

Umschalten der Quelle: `NEXT_PUBLIC_DATA_SOURCE=mock|api` (Default **mock**;
`api` nur unter `next dev`, in Prod-Builds wird hart auf mock zurückgefallen —
siehe `lib/data/config.ts`). Der api-Modus braucht den lokalen Stack:
`scripts/dev-stack.sh up` (API auf Port 3022) und einen Dev-Login (Persona-
Karten auf `/login`).

---

## 1. Tabelle: alter Import → neuer Aufruf

Alle Reads sind **async** (Promise). Die reinen Ableitungen (`sumOpenCents` …)
sind jetzt Funktionen über den geladenen Arrays statt vorberechneter Konstanten.

| Alt (`@/lib/mock`) | Neu (`@/lib/data`) |
| --- | --- |
| `club` | `await data.getClub()` |
| `members` | `await data.getMembers()` |
| `memberById(id)` | `await data.getMemberById(id)` — oder synchron `memberById(members, id)` auf bereits geladenen Daten |
| `fullName(m)` | `fullName(m)` (pur, direkt aus `@/lib/data`) |
| `teams` | `await data.getTeams()` ⚠️ api: NotImplemented |
| `guardianships` | `await data.getGuardianships()` ⚠️ api: NotImplemented |
| `currentUser` | `await data.getCurrentUser()` (api: Person aus dem Dev-Login) |
| `events` | `await data.getEvents()` |
| `upcomingEvents(d)` | `await data.getUpcomingEvents(d)` — oder `upcomingEvents(events, d)` auf geladenen Daten |
| `attendance` | `await data.getAttendance()` ⚠️ api: NotImplemented (kein Lese-Endpoint) |
| `routines` | `await data.getRoutines()` (api: inkl. Marker + Scores) |
| `routineById(id)` | `await data.getRoutineById(id)` |
| `invoices` | `await data.getInvoices()` |
| `openInvoices` | `openInvoices(invoices)` (pur) |
| `sumOpenCents` | `sumOpenCents(invoices)` (pur) |
| `sumPaidCents` | `sumPaidCents(invoices)` (pur) |
| `dunningPipeline` | `dunningPipeline(invoices)` (pur) |
| `ledger` | `await data.getLedger()` ⚠️ api: NotImplemented |
| `ledgerBalanceCents` | `ledgerBalanceCents(ledger)` (pur) |
| `competitions` | `await data.getCompetitions()` ⚠️ api: NotImplemented |
| `tasks` | `await data.getTasks()` ⚠️ api: NotImplemented |
| `openTasks` | `openTasks(tasks)` (pur) |
| `daysFromNow` / `dateFromNow` | bleiben Mock-/Demo-Helfer — in Screens nicht mehr nötig; wo doch (reine Anzeige-Logik), lokale Datums-Helfer benutzen |

**Schreibpfade** (mock: No-op → `true`; api: echter Call, Fehler als `ApiError`):

| Aktion | Facade-Aufruf |
| --- | --- |
| RSVP setzen | `await data.setRsvp({ eventId, memberId, status, comment? })` |
| Anwesenheit setzen | `await data.setAttendance({ eventId, memberId, status, checkedInAt? })` |
| Mitglieds-Rolle ändern | `await data.changeMemberRole(memberId, role)` (owner nie zuweisbar) |
| Mahnlauf (dry run) | `await data.runDunning({ dryRun: true })` → `DunningRunOutcome` |
| Aufgabe abhaken | `await data.setTaskDone(taskId, done)` ⚠️ api: NotImplemented |

## 2. Was im api-Modus (Contract v0.1.0) fehlt

Diese Aufrufe werfen `NotImplementedError` — der Screen zeigt dann einen
**leeren Zustand mit Hinweis** (`EmptyState`), er darf **niemals crashen**:

- `getTeams`, `getGuardianships` (kein Teams-/Familien-Endpoint)
- `getAttendance` (nur `PUT`, kein Lese-Endpoint)
- `getLedger` (Kassenbuch), `getCompetitions`, `getTasks`, `setTaskDone`

Teilweise leere Felder (kommen ohne Fehler zurück, einfach leer rendern):

- `Event.rsvps` und `Event.teamIds` → `[]` (kein RSVP-/Team-Read im Contract)
- `Member.teamIds` → `[]`
- `Routine.memberIds` → `[]` (Läufer:innen fehlen im Read-Modell)
- `Routine.waveformPeaks` → deterministischer **Anzeige-Platzhalter** (seeded
  aus der Routine-ID), bis die API Audio-Assets liefert

Fehlt euch davon etwas dringend: **nicht** im Web-Client tricksen, sondern
Contract-Lücke melden → `services/api`-Zod erweitern + Codegen-Pipeline
(`packages/contracts/codegen/`, `npm run openapi && npm run generate && node check.mjs`).

## 3. Loading-/Error-Pattern (Standard für alle Screens)

Client-Komponenten laden über den Hook `useData` (`@/lib/data/useData`,
re-Export nicht nötig — direkt importieren):

```tsx
"use client";

import { useData } from "@/lib/data/useData";
import { isNotImplemented, errorMessage } from "@/lib/data";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

export function MembersScreen() {
  const members = useData((repo) => repo.getMembers());

  if (members.status === "loading") return <SkeletonCard lines={6} />;

  if (members.status === "error") {
    return isNotImplemented(members.error) ? (
      // API kann das noch nicht — ruhiger Hinweis, KEIN Crash
      <EmptyState
        icon="sparkle"
        title="Noch nicht angebunden"           // + EN-Variante über das Screen-Dict!
        body="Dieser Bereich hat im api-Modus noch keinen Endpoint."
      />
    ) : (
      <EmptyState
        icon="zap"
        title="Daten konnten nicht geladen werden"
        body={errorMessage(members.error)}
        action={<Button onClick={members.reload}>Erneut versuchen</Button>}
      />
    );
  }

  return <MemberTable members={members.data} />;
}
```

Details-Screens: ID in die Deps — `useData((r) => r.getRoutineById(id), [id])`.

**Schreibpfade** mit Toast (403 = keine Berechtigung, kommt bei RLS wirklich vor):

```tsx
const { showToast } = useToast();

async function saveRsvp(status: RsvpStatus) {
  try {
    await data.setRsvp({ eventId, memberId, status });
    showToast(t("rsvpSaved"), { tone: "success" });
  } catch (e) {
    showToast(
      isForbidden(e) ? t("noPermission") : errorMessage(e),
      { tone: "danger", actionLabel: t("retry"), onAction: () => saveRsvp(status) },
    );
  }
}
```

Optimistisches UI ist weiterhin erwünscht: lokalen Zustand sofort setzen,
bei Fehler zurückrollen + Toast.

## 4. Do / Don't

**Do**
- Nur `@/lib/data` (+ `@/lib/data/useData`) für Daten benutzen; Typen weiter aus `@/lib/types`.
- Jeden Read mit Loading- (Skeleton) und Fehler-Zustand (EmptyState) ausstatten.
- `isNotImplemented(error)` separat behandeln — das ist kein Fehlerfall, sondern eine bekannte Contract-Lücke.
- Abgeleitete Summen mit den puren Helfern (`sumOpenCents(invoices)` …) berechnen — Konsistenzregel „Zahlen gehen quer über den Screen auf" gilt weiter.
- Alle neuen UI-Strings DE **und** EN, echte Umlaute, Light+Dark testen.
- Komponenten aus `components/ui` verwenden (`Skeleton`, `EmptyState`, `Toast`).

**Don't**
- ❌ Kein `import … from "@/lib/mock"` mehr in Screens (`app/(portal)/**`). (Die Mock-Daten leben weiter — aber nur hinter der Facade in `lib/data/mock`.)
- ❌ Kein `fetch`/`ApiClient` direkt im Screen — alles geht durch die Facade.
- ❌ `lib/api/generated/**` nie von Hand ändern (Codegen!).
- ❌ Keine hart codierten Summen/Zahlen, keine Annahme „Daten sind sofort da" (alles async).
- ❌ `NotImplementedError` nicht wegfangen und leeres Array vortäuschen — der Nutzer soll den Hinweis sehen.

## 5. Auth-Kontext (nur falls der Screen die eingeloggte Person braucht)

```tsx
import { useAuth } from "@/lib/auth";          // Session (api-Modus): Token, Persona, Profil
const me = useData((repo) => repo.getCurrentUser()); // als Member, in beiden Modi
```

Der Portal-Zugang selbst ist bereits zentral gelöst (`AuthGate` im
Portal-Layout, Persona-Login auf `/login`) — Screens müssen dafür nichts tun.
