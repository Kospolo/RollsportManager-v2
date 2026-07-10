// EPC QR (GiroCode) payload tests - EPC069-12, SEPA credit transfer.

import { describe, expect, it } from 'vitest';
import {
  EPC_MAX_PAYLOAD_BYTES,
  EpcQrError,
  buildEpcQrPayload,
  formatEurAmount,
  isValidCreditorReference,
  isValidIban,
  normalizeIban,
} from '../src/lib/epc-qr.js';

// well-known valid IBANs (spec/Wikipedia examples)
const IBAN_DE = 'DE33100205000001194700'; // the classic EPC/GiroCode example
const IBAN_AT = 'AT611904300234573201';
const IBAN_BE = 'BE71096123456769';

describe('isValidIban', () => {
  it('accepts valid IBANs from several countries', () => {
    expect(isValidIban(IBAN_DE)).toBe(true);
    expect(isValidIban(IBAN_AT)).toBe(true);
    expect(isValidIban(IBAN_BE)).toBe(true);
  });

  it('normalizes spacing and case before checking', () => {
    expect(isValidIban('de33 1002 0500 0001 1947 00')).toBe(true);
    expect(normalizeIban('de33 1002 0500 0001 1947 00')).toBe(IBAN_DE);
  });

  it('rejects checksum and structure failures', () => {
    expect(isValidIban('DE34100205000001194700')).toBe(false); // wrong check digits
    expect(isValidIban('DE331002050000011947')).toBe(false); // too short
    expect(isValidIban('XX00')).toBe(false);
    expect(isValidIban('')).toBe(false);
  });
});

describe('isValidCreditorReference (ISO 11649)', () => {
  it('accepts a valid RF reference and rejects a corrupted one', () => {
    expect(isValidCreditorReference('RF18539007547034')).toBe(true);
    expect(isValidCreditorReference('RF19539007547034')).toBe(false);
    expect(isValidCreditorReference('ABC123')).toBe(false);
  });
});

describe('formatEurAmount (integer cents, never float)', () => {
  it('formats cents as EPC amount', () => {
    expect(formatEurAmount(1)).toBe('EUR0.01');
    expect(formatEurAmount(100)).toBe('EUR1.00');
    expect(formatEurAmount(12345)).toBe('EUR123.45');
    expect(formatEurAmount(38100)).toBe('EUR381.00');
    expect(formatEurAmount(99_999_999_999)).toBe('EUR999999999.99');
  });

  it('rejects floats, zero and out-of-range amounts', () => {
    expect(() => formatEurAmount(12.34)).toThrow(EpcQrError);
    expect(() => formatEurAmount(0)).toThrow(EpcQrError);
    expect(() => formatEurAmount(-100)).toThrow(EpcQrError);
    expect(() => formatEurAmount(100_000_000_000)).toThrow(EpcQrError);
  });
});

describe('buildEpcQrPayload', () => {
  it('builds the canonical GiroCode example (with BIC and remittance text)', () => {
    const payload = buildEpcQrPayload({
      name: 'Wikimedia Foerdergesellschaft',
      iban: IBAN_DE,
      bic: 'BFSWDE33BER',
      amountCents: 12345,
      remittanceText: 'Spende fuer Wikipedia',
    });
    expect(payload).toBe(
      [
        'BCD',
        '002',
        '1',
        'SCT',
        'BFSWDE33BER',
        'Wikimedia Foerdergesellschaft',
        'DE33100205000001194700',
        'EUR123.45',
        '', // purpose
        '', // structured reference
        'Spende fuer Wikipedia',
      ].join('\n'),
    );
  });

  it('builds a club membership-fee payload with a structured reference', () => {
    const payload = buildEpcQrPayload({
      name: 'RSV Musterstadt e.V.',
      iban: IBAN_AT,
      amountCents: 38100,
      creditorReference: 'RF18539007547034',
    });
    expect(payload).toBe(
      ['BCD', '002', '1', 'SCT', '', 'RSV Musterstadt e.V.', 'AT611904300234573201', 'EUR381.00', '', 'RF18539007547034'].join(
        '\n',
      ),
    );
  });

  it('omits trailing empty elements but never the mandatory head', () => {
    const payload = buildEpcQrPayload({ name: 'Verein', iban: IBAN_BE });
    expect(payload).toBe(['BCD', '002', '1', 'SCT', '', 'Verein', 'BE71096123456769'].join('\n'));
    expect(payload.split('\n')).toHaveLength(7);
  });

  it('keeps umlauts intact (UTF-8, charset indicator 1)', () => {
    const payload = buildEpcQrPayload({
      name: 'Rollsportverein Grünstadt e.V.',
      iban: IBAN_DE,
      amountCents: 4990,
      remittanceText: 'Beitrag Müller, März',
    });
    const lines = payload.split('\n');
    expect(lines[2]).toBe('1');
    expect(lines[5]).toBe('Rollsportverein Grünstadt e.V.');
    expect(lines[10]).toBe('Beitrag Müller, März');
  });

  it('rejects invalid IBAN, BIC, purpose and invalid RF references', () => {
    expect(() => buildEpcQrPayload({ name: 'X', iban: 'DE00123' })).toThrow(/invalid IBAN/);
    expect(() => buildEpcQrPayload({ name: 'X', iban: IBAN_DE, bic: 'TOOSHORT!' })).toThrow(/BIC/);
    expect(() => buildEpcQrPayload({ name: 'X', iban: IBAN_DE, purposeCode: 'TOOLONG' })).toThrow(/purpose/);
    expect(() => buildEpcQrPayload({ name: 'X', iban: IBAN_DE, creditorReference: 'RF99WRONG' })).toThrow(/creditor reference/);
  });

  it('rejects structured reference combined with remittance text', () => {
    expect(() =>
      buildEpcQrPayload({
        name: 'X',
        iban: IBAN_DE,
        creditorReference: 'RF18539007547034',
        remittanceText: 'both is not allowed',
      }),
    ).toThrow(/mutually exclusive/);
  });

  it('rejects oversized fields and oversized payloads', () => {
    expect(() => buildEpcQrPayload({ name: 'A'.repeat(71), iban: IBAN_DE })).toThrow(/70/);
    expect(() => buildEpcQrPayload({ name: '', iban: IBAN_DE })).toThrow(/required/);
    expect(() => buildEpcQrPayload({ name: 'X', iban: IBAN_DE, remittanceText: 'R'.repeat(141) })).toThrow(/140/);
    expect(() => buildEpcQrPayload({ name: 'X', iban: IBAN_DE, information: 'I'.repeat(71) })).toThrow(/70/);
  });

  it('enforces the 331-byte total limit (individual maxima cannot be combined)', () => {
    // every field at its individual maximum exceeds the total budget -> reject
    expect(() =>
      buildEpcQrPayload({
        name: 'N'.repeat(70),
        iban: IBAN_DE,
        bic: 'BFSWDE33BER',
        amountCents: 99_999_999_999,
        purposeCode: 'CBFF',
        remittanceText: 'R'.repeat(140),
        information: 'I'.repeat(70),
      }),
    ).toThrow(/331/);

    // a realistic large payload stays within the limit
    const payload = buildEpcQrPayload({
      name: 'N'.repeat(70),
      iban: IBAN_DE,
      bic: 'BFSWDE33BER',
      amountCents: 99_999_999_999,
      purposeCode: 'CBFF',
      remittanceText: 'R'.repeat(140),
    });
    expect(Buffer.byteLength(payload, 'utf8')).toBeLessThanOrEqual(EPC_MAX_PAYLOAD_BYTES);
  });
});
