// ============================================================================
// modules/export/routes.ts - GoBD / DATEV CSV export (v1 finance-export.html).
//
//   GET /export/ledger.csv?club_id&from&to   GoBD cash-book export
//   GET /export/datev?club_id&year           DATEV-near booking export
//
// Both stream text/csv with a Content-Disposition attachment header, so - like
// modules/media and the webhooks - they move a non-JSON payload and are a PLAIN
// Hono router, deliberately OUTSIDE the typed OpenAPI contract (the contracts
// check only inspects the spec, so CSV routes never trip its JSON-schema gate).
// They are NOT in PUBLIC_PATHS (app.ts), so requireAuth still runs and
// c.get('claims') is present.
//
// Rights: can_manage_finance (FINANCE_ROLES) - enforced by the API guard AND,
// because the data is read impersonated (withUser), by the ledger RLS policy as
// the second line of defense. A non-finance caller gets 403.
// ============================================================================

import { Hono } from 'hono';
import type { AuthEnv } from '../../middleware/auth.js';
import { problem } from '../../middleware/error.js';
import { withUser } from '../../db.js';
import { FINANCE_ROLES, requireClubRole } from '../../lib/guards.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Escape one CSV field for a semicolon-delimited file (German/DATEV convention). */
function csvField(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Join rows into a CSV body with a UTF-8 BOM (so Excel reads the umlauts). */
function csvBody(rows: string[][]): string {
  return '﻿' + rows.map((r) => r.map(csvField).join(';')).join('\r\n') + '\r\n';
}

/** integer cents -> German decimal string (e.g. -68000 -> "-680,00"). */
function centsToDecimal(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

function requireUuid(c: { req: { query: (k: string) => string | undefined } }, key: string): string {
  const v = c.req.query(key);
  if (typeof v !== 'string' || !UUID_RE.test(v)) {
    throw problem(400, 'Bad Request', `${key} (uuid) is required`);
  }
  return v;
}

export function createExportRouter(): Hono<AuthEnv> {
  const router = new Hono<AuthEnv>();

  // --- GoBD ledger export ----------------------------------------------------
  router.get('/export/ledger.csv', async (c) => {
    const claims = c.get('claims');
    const clubId = requireUuid(c, 'club_id');
    requireClubRole(claims, clubId, FINANCE_ROLES);

    const from = c.req.query('from');
    const to = c.req.query('to');
    if (from !== undefined && !DATE_RE.test(from)) throw problem(400, 'Bad Request', 'from must be YYYY-MM-DD');
    if (to !== undefined && !DATE_RE.test(to)) throw problem(400, 'Bad Request', 'to must be YYYY-MM-DD');

    const rows = await withUser(claims, (tx) =>
      tx`select le.entry_on, le.description, le.counterparty_kind, le.counterparty_name,
                m.first_name, m.last_name, le.amount_cents, le.category,
                cat.name as category_name, inv.number as invoice_number, le.reverses_entry_id
         from app.ledger_entries le
         left join app.club_members m on m.id = le.counterparty_member_id
         left join app.ledger_categories cat on cat.id = le.category_id
         left join app.invoices inv on inv.id = le.invoice_id
         where le.club_id = ${clubId}
           and (${from ?? null}::date is null or le.entry_on >= ${from ?? null}::date)
           and (${to ?? null}::date is null or le.entry_on <= ${to ?? null}::date)
         order by le.entry_on asc, le.created_at asc`,
    );

    const header = [
      'Datum', 'Beschreibung', 'Gegenpartei', 'Kategorie',
      'Betrag_EUR', 'Betrag_Cent', 'Beleg', 'Storno',
    ];
    const body: string[][] = [header];
    for (const r of rows) {
      const row = r as Record<string, unknown>;
      const counterparty =
        row['counterparty_kind'] === 'person'
          ? `${row['first_name'] ?? ''} ${row['last_name'] ?? ''}`.trim()
          : (row['counterparty_name'] as string | null) ?? '';
      const cents = Number(row['amount_cents']);
      body.push([
        String(row['entry_on']),
        String(row['description']),
        counterparty,
        (row['category_name'] as string | null) ?? (row['category'] as string | null) ?? '',
        centsToDecimal(cents),
        String(cents),
        (row['invoice_number'] as string | null) ?? '',
        row['reverses_entry_id'] ? 'Storno' : '',
      ]);
    }

    const fname = `kassenbuch_${clubId}${from ? `_${from}` : ''}${to ? `_${to}` : ''}.csv`;
    return new Response(csvBody(body), {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${fname}"`,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  });

  // --- DATEV-near export -----------------------------------------------------
  router.get('/export/datev', async (c) => {
    const claims = c.get('claims');
    const clubId = requireUuid(c, 'club_id');
    requireClubRole(claims, clubId, FINANCE_ROLES);

    const yearRaw = c.req.query('year');
    const year = Number(yearRaw);
    if (!yearRaw || !Number.isInteger(year) || year < 2000 || year > 2100) {
      throw problem(400, 'Bad Request', 'year (2000..2100) is required');
    }

    const rows = await withUser(claims, (tx) =>
      tx`select le.entry_on, le.description, le.amount_cents, cat.name as category_name,
                inv.number as invoice_number
         from app.ledger_entries le
         left join app.ledger_categories cat on cat.id = le.category_id
         left join app.invoices inv on inv.id = le.invoice_id
         where le.club_id = ${clubId} and extract(year from le.entry_on) = ${year}
         order by le.entry_on asc, le.created_at asc`,
    );

    // DATEV-near booking columns (semicolon-delimited): amount is always the
    // absolute value, the debit/credit indicator (S/H) carries the sign.
    const header = [
      'Umsatz', 'Soll/Haben-Kennzeichen', 'WKZ', 'Belegdatum',
      'Belegfeld 1', 'Buchungstext', 'Kategorie',
    ];
    const body: string[][] = [header];
    for (const r of rows) {
      const row = r as Record<string, unknown>;
      const cents = Number(row['amount_cents']);
      const d = String(row['entry_on']); // YYYY-MM-DD
      const belegdatum = `${d.slice(8, 10)}${d.slice(5, 7)}`; // DDMM (DATEV short)
      body.push([
        centsToDecimal(Math.abs(cents)),
        cents < 0 ? 'H' : 'S',
        'EUR',
        belegdatum,
        (row['invoice_number'] as string | null) ?? '',
        String(row['description']),
        (row['category_name'] as string | null) ?? '',
      ]);
    }

    const fname = `datev_${clubId}_${year}.csv`;
    return new Response(csvBody(body), {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${fname}"`,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  });

  return router;
}
