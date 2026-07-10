// ============================================================================
// lib/epc-qr.ts - EPC QR code payload ("GiroCode") for SEPA credit transfers.
//
// Blueprint ADR-E6: bank transfer stays a FULL fallback payment path while
// Stripe Connect KYC is pending - invoices render an EPC QR so members can
// scan-and-pay with any EU banking app, and the reference enables matching.
//
// Format: EPC069-12 v2.1, "Quick Response Code - Guidelines to Enable Data
// Capture for the Initiation of a SEPA Credit Transfer".
//   Line  1: 'BCD'          service tag
//   Line  2: '002'          version (002 = BIC optional inside EEA)
//   Line  3: '1'            character set (1 = UTF-8)
//   Line  4: 'SCT'          identification (SEPA Credit Transfer)
//   Line  5: BIC            (optional with version 002)
//   Line  6: beneficiary name             (mandatory, <= 70 chars)
//   Line  7: beneficiary IBAN             (mandatory, MOD-97 checked)
//   Line  8: amount 'EUR#.##'             (optional, 0.01 .. 999999999.99)
//   Line  9: purpose code                 (optional, 4 chars, AT-44)
//   Line 10: structured reference         (optional, ISO 11649 RF creditor ref)
//   Line 11: unstructured remittance text (optional, <= 140 chars)
//   Line 12: beneficiary-to-originator information (optional, <= 70 chars)
// Lines 10 and 11 are MUTUALLY EXCLUSIVE. Trailing empty elements may be
// omitted. Total payload <= 331 bytes.
//
// Amounts are INTEGER CENTS everywhere (Blueprint §4 - money is never float).
// ============================================================================

/** Thrown for any invalid EPC input - message states which rule failed. */
export class EpcQrError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EpcQrError';
  }
}

export interface EpcQrInput {
  /** Beneficiary name (the club's bank account holder), 1..70 chars. */
  name: string;
  /** Beneficiary IBAN. Spaces allowed; validated with MOD-97. */
  iban: string;
  /** BIC - optional (EPC version 002 within the EEA). 8 or 11 chars. */
  bic?: string;
  /** Amount in integer cents (1 .. 99_999_999_999). Omit for open amount. */
  amountCents?: number;
  /** ISO 20022 purpose code (AT-44), exactly 4 alphanumeric chars. */
  purposeCode?: string;
  /** Structured creditor reference (ISO 11649, 'RF...'), <= 35 chars. */
  creditorReference?: string;
  /** Unstructured remittance text, <= 140 chars. Exclusive with reference. */
  remittanceText?: string;
  /** Beneficiary-to-originator information, <= 70 chars. */
  information?: string;
}

/** Maximum total payload size defined by EPC069-12. */
export const EPC_MAX_PAYLOAD_BYTES = 331;

/** Strip spaces, uppercase - the canonical IBAN form used in the payload. */
export function normalizeIban(iban: string): string {
  return iban.replace(/\s+/g, '').toUpperCase();
}

/** ISO 13616 MOD-97 check (also used for ISO 11649 'RF' references). */
function mod97(rearranged: string): number {
  let remainder = 0;
  for (const ch of rearranged) {
    // letters map to 10..35, digits stay digits
    const chunk = ch >= 'A' && ch <= 'Z' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const digit of chunk) {
      remainder = (remainder * 10 + (digit.charCodeAt(0) - 48)) % 97;
    }
  }
  return remainder;
}

/** Structural + MOD-97 IBAN validation (no country length table on purpose). */
export function isValidIban(iban: string): boolean {
  const s = normalizeIban(iban);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  return mod97(s.slice(4) + s.slice(0, 4)) === 1;
}

/** ISO 11649 creditor reference check ('RF' + 2 check digits + reference). */
export function isValidCreditorReference(ref: string): boolean {
  const s = ref.replace(/\s+/g, '').toUpperCase();
  if (!/^RF[0-9]{2}[A-Z0-9]{1,21}$/.test(s)) return false;
  return mod97(s.slice(4) + s.slice(0, 4)) === 1;
}

/**
 * Format integer cents as the EPC amount element, e.g. 1234 -> 'EUR12.34'.
 * Rejects floats and out-of-range values (EPC: 0.01 .. 999999999.99).
 */
export function formatEurAmount(amountCents: number): string {
  if (!Number.isInteger(amountCents)) {
    throw new EpcQrError('amountCents must be integer cents, never a float euro value');
  }
  if (amountCents < 1 || amountCents > 99_999_999_999) {
    throw new EpcQrError('amount out of EPC range (EUR 0.01 .. 999999999.99)');
  }
  const euros = Math.floor(amountCents / 100);
  const cents = amountCents % 100;
  return `EUR${euros}.${String(cents).padStart(2, '0')}`;
}

/**
 * Build the EPC069-12 payload string (the QR content - rendering the actual
 * QR image is a client/portal concern). Throws EpcQrError on invalid input.
 */
export function buildEpcQrPayload(input: EpcQrInput): string {
  const name = input.name.trim();
  if (name.length === 0) throw new EpcQrError('beneficiary name is required');
  if (name.length > 70) throw new EpcQrError('beneficiary name exceeds 70 characters');

  const iban = normalizeIban(input.iban);
  if (!isValidIban(iban)) throw new EpcQrError(`invalid IBAN: ${input.iban}`);

  let bic = '';
  if (input.bic !== undefined && input.bic !== '') {
    bic = input.bic.replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(bic)) {
      throw new EpcQrError('BIC must be 8 or 11 alphanumeric characters');
    }
  }

  const amount = input.amountCents !== undefined ? formatEurAmount(input.amountCents) : '';

  let purpose = '';
  if (input.purposeCode !== undefined && input.purposeCode !== '') {
    purpose = input.purposeCode.toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(purpose)) {
      throw new EpcQrError('purpose code must be exactly 4 alphanumeric characters');
    }
  }

  const reference = input.creditorReference?.replace(/\s+/g, '').toUpperCase() ?? '';
  const remittance = input.remittanceText?.trim() ?? '';
  if (reference !== '' && remittance !== '') {
    throw new EpcQrError('structured reference and unstructured remittance text are mutually exclusive');
  }
  if (reference !== '') {
    if (reference.length > 35) throw new EpcQrError('creditor reference exceeds 35 characters');
    if (!isValidCreditorReference(reference)) {
      throw new EpcQrError(`invalid ISO 11649 creditor reference: ${reference}`);
    }
  }
  if (remittance.length > 140) throw new EpcQrError('remittance text exceeds 140 characters');

  const information = input.information?.trim() ?? '';
  if (information.length > 70) throw new EpcQrError('information exceeds 70 characters');

  const lines = [
    'BCD',
    '002',
    '1',
    'SCT',
    bic,
    name,
    iban,
    amount,
    purpose,
    reference,
    remittance,
    information,
  ];

  // Trailing empty elements may be omitted (EPC069-12 §4) - but never the
  // mandatory head through the IBAN (first 7 elements).
  while (lines.length > 7 && lines[lines.length - 1] === '') lines.pop();

  const payload = lines.join('\n');
  const bytes = Buffer.byteLength(payload, 'utf8');
  if (bytes > EPC_MAX_PAYLOAD_BYTES) {
    throw new EpcQrError(`payload is ${bytes} bytes - EPC069-12 allows at most ${EPC_MAX_PAYLOAD_BYTES}`);
  }
  return payload;
}
