// ============================================================================
// mail-templates/index.ts - Sammelpunkt aller Vorlagen.
//
// Jede Vorlage ist eine reine Funktion (Daten rein, RenderedMail raus) und ohne
// SMTP/Postgres/Netz testbar - siehe types.ts. lib/mailer.ts nimmt die fertige
// RenderedMail und schickt sie los (oder gibt sie im Trockenlauf zurueck).
// ============================================================================

export { bilingual, oneLine } from './types.js';
export type { RenderedMail } from './types.js';

export { renderVerifyEmail } from './verify-email.js';
export type { VerifyEmailData } from './verify-email.js';

export { renderClubInvitation } from './club-invitation.js';
export type { ClubInvitationData } from './club-invitation.js';

export { renderPasswordReset } from './password-reset.js';
export type { PasswordResetData } from './password-reset.js';

export { renderJoinRequestNotification } from './join-request-notification.js';
export type { JoinRequestNotificationData } from './join-request-notification.js';
