// Zod contract tests - request schemas guard the API surface.

import { describe, expect, it } from 'vitest';
import {
  attendanceUpsertSchema,
  chatMessageCreateSchema,
  checkinCreateSchema,
  dutyEntryCreateSchema,
  dutyRequirementCreateSchema,
  eventCreateSchema,
  invoiceCreateSchema,
  memberCreateSchema,
  regionalEventCreateSchema,
  roleChangeSchema,
  rsvpUpsertSchema,
  trainingSlotCreateSchema,
} from '../src/lib/validation.js';

const CLUB = '11111111-1111-4111-8111-111111111111';
const MEMBER = '44444444-4444-4444-8444-444444444444';
const TEAM = '22222222-2222-4222-8222-222222222222';
const PEER = '33333333-3333-4333-8333-333333333333';

describe('invoiceCreateSchema (money = integer cents)', () => {
  const base = { club_id: CLUB, member_id: MEMBER, title: 'Beitrag Q3', amount_cents: 4500 };

  it('accepts integer cents and defaults issue=false', () => {
    const parsed = invoiceCreateSchema.parse(base);
    expect(parsed.amount_cents).toBe(4500);
    expect(parsed.issue).toBe(false);
  });

  it('rejects float amounts (never float money)', () => {
    expect(invoiceCreateSchema.safeParse({ ...base, amount_cents: 45.5 }).success).toBe(false);
  });

  it('rejects negative amounts', () => {
    expect(invoiceCreateSchema.safeParse({ ...base, amount_cents: -100 }).success).toBe(false);
  });
});

describe('memberCreateSchema', () => {
  const base = { first_name: 'Lina', last_name: 'Grünewald' };

  it('defaults to role=member', () => {
    expect(memberCreateSchema.parse(base).role).toBe('member');
  });

  it('never allows creating an owner', () => {
    expect(memberCreateSchema.safeParse({ ...base, role: 'owner' }).success).toBe(false);
  });

  it('requires valid_until for guest_coach (mirrors the DB check)', () => {
    expect(memberCreateSchema.safeParse({ ...base, role: 'guest_coach' }).success).toBe(false);
    expect(
      memberCreateSchema.safeParse({
        ...base,
        role: 'guest_coach',
        valid_until: '2026-08-01T00:00:00+02:00',
      }).success,
    ).toBe(true);
  });
});

describe('roleChangeSchema', () => {
  it('accepts assignable roles, rejects owner', () => {
    expect(roleChangeSchema.parse({ role: 'treasurer' }).role).toBe('treasurer');
    expect(roleChangeSchema.safeParse({ role: 'owner' }).success).toBe(false);
  });
});

describe('eventCreateSchema', () => {
  const base = {
    club_id: CLUB,
    title: 'Training U15',
    starts_at: '2026-07-15T17:00:00+02:00',
    ends_at: '2026-07-15T19:00:00+02:00',
  };

  it('accepts a valid event and defaults type=training', () => {
    const parsed = eventCreateSchema.parse(base);
    expect(parsed.type).toBe('training');
    expect(parsed.team_ids).toEqual([]);
  });

  it('rejects ends_at before starts_at (mirrors the DB check)', () => {
    expect(
      eventCreateSchema.safeParse({ ...base, ends_at: '2026-07-15T16:00:00+02:00' }).success,
    ).toBe(false);
  });
});

describe('trainingSlotCreateSchema (modules batch 3)', () => {
  const base = { club_id: CLUB, weekday: 0, starts_time: '17:00', ends_time: '18:30' };

  it('accepts a valid weekly slot (0=Monday..6=Sunday)', () => {
    const parsed = trainingSlotCreateSchema.parse(base);
    expect(parsed.weekday).toBe(0);
    expect(parsed.starts_time).toBe('17:00');
  });

  it('rejects a weekday outside 0..6', () => {
    expect(trainingSlotCreateSchema.safeParse({ ...base, weekday: 7 }).success).toBe(false);
    expect(trainingSlotCreateSchema.safeParse({ ...base, weekday: -1 }).success).toBe(false);
  });

  it('rejects a malformed time and ends_time before starts_time', () => {
    expect(trainingSlotCreateSchema.safeParse({ ...base, starts_time: '25:00' }).success).toBe(false);
    expect(trainingSlotCreateSchema.safeParse({ ...base, ends_time: '16:00' }).success).toBe(false);
  });
});

describe('dutyRequirementCreateSchema (modules batch 3)', () => {
  const base = {
    club_id: CLUB,
    season_label: 'Saison 2025/2026',
    required_hours: 20,
    period_start: '2026-01-01',
    period_end: '2026-12-31',
  };

  it('accepts a season target', () => {
    expect(dutyRequirementCreateSchema.parse(base).required_hours).toBe(20);
  });

  it('rejects a period_end before period_start and negative hours', () => {
    expect(dutyRequirementCreateSchema.safeParse({ ...base, period_end: '2025-12-31' }).success).toBe(false);
    expect(dutyRequirementCreateSchema.safeParse({ ...base, required_hours: -1 }).success).toBe(false);
  });
});

describe('dutyEntryCreateSchema (modules batch 3)', () => {
  const base = { club_id: CLUB, member_id: MEMBER, hours: 3, activity_date: '2026-07-01' };

  it('defaults kind=training and approved=false', () => {
    const parsed = dutyEntryCreateSchema.parse(base);
    expect(parsed.kind).toBe('training');
    expect(parsed.approved).toBe(false);
  });

  it('rejects non-positive hours and unknown kind', () => {
    expect(dutyEntryCreateSchema.safeParse({ ...base, hours: 0 }).success).toBe(false);
    expect(dutyEntryCreateSchema.safeParse({ ...base, kind: 'party' }).success).toBe(false);
  });
});

describe('chatMessageCreateSchema (modules batch 4)', () => {
  it('accepts a team message with team_id + body', () => {
    expect(
      chatMessageCreateSchema.safeParse({
        club_id: CLUB, channel_type: 'team', team_id: TEAM, body: 'Hallo Team',
      }).success,
    ).toBe(true);
  });

  it('accepts a direct message with recipient + body', () => {
    expect(
      chatMessageCreateSchema.safeParse({
        club_id: CLUB, channel_type: 'direct', recipient_member_id: PEER, body: 'Hi',
      }).success,
    ).toBe(true);
  });

  it('requires team_id for team and recipient_member_id for direct', () => {
    expect(
      chatMessageCreateSchema.safeParse({ club_id: CLUB, channel_type: 'team', body: 'x' }).success,
    ).toBe(false);
    expect(
      chatMessageCreateSchema.safeParse({ club_id: CLUB, channel_type: 'direct', body: 'x' }).success,
    ).toBe(false);
  });

  it('rejects mixing team_id with a direct message', () => {
    expect(
      chatMessageCreateSchema.safeParse({
        club_id: CLUB, channel_type: 'direct', recipient_member_id: PEER, team_id: TEAM, body: 'x',
      }).success,
    ).toBe(false);
  });

  it('requires body and/or image_url', () => {
    expect(
      chatMessageCreateSchema.safeParse({ club_id: CLUB, channel_type: 'team', team_id: TEAM }).success,
    ).toBe(false);
    expect(
      chatMessageCreateSchema.safeParse({
        club_id: CLUB, channel_type: 'team', team_id: TEAM, image_url: 'https://example.org/a.jpg',
      }).success,
    ).toBe(true);
  });
});

describe('checkinCreateSchema (modules batch 4)', () => {
  it('defaults method=qr', () => {
    expect(checkinCreateSchema.parse({ club_id: CLUB, member_id: MEMBER }).method).toBe('qr');
  });

  it('rejects an unknown method', () => {
    expect(
      checkinCreateSchema.safeParse({ club_id: CLUB, member_id: MEMBER, method: 'nfc' }).success,
    ).toBe(false);
  });
});

describe('regionalEventCreateSchema (modules batch 4)', () => {
  const base = { club_id: CLUB, title: 'Süddeutsche Meisterschaft', starts_on: '2026-09-01' };

  it('accepts a minimal event and an optional end date', () => {
    expect(regionalEventCreateSchema.safeParse(base).success).toBe(true);
    expect(regionalEventCreateSchema.safeParse({ ...base, ends_on: '2026-09-02' }).success).toBe(true);
  });

  it('rejects ends_on before starts_on and a non-url registration link', () => {
    expect(regionalEventCreateSchema.safeParse({ ...base, ends_on: '2026-08-31' }).success).toBe(false);
    expect(regionalEventCreateSchema.safeParse({ ...base, registration_url: 'not-a-url' }).success).toBe(false);
  });
});

describe('rsvp / attendance enums', () => {
  it('accepts the four RSVP states incl. sick', () => {
    for (const status of ['going', 'declined', 'maybe', 'sick'] as const) {
      expect(rsvpUpsertSchema.safeParse({ member_id: MEMBER, status }).success).toBe(true);
    }
  });

  it('rejects unknown states', () => {
    expect(rsvpUpsertSchema.safeParse({ member_id: MEMBER, status: 'yes' }).success).toBe(false);
    expect(attendanceUpsertSchema.safeParse({ member_id: MEMBER, status: 'here' }).success).toBe(false);
  });
});
