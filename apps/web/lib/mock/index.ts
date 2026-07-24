/**
 * Mock-Daten des Demo-Vereins „RSV Neckarsulm".
 *
 * WICHTIG: In dieser Phase ist das die EINZIGE Datenquelle des Portals —
 * keine Verbindung zu rollsportmanager.de, Supabase oder irgendeiner
 * echten API. Alle Screens lesen ausschließlich von hier.
 */

export {
  club,
  members,
  teams,
  guardianships,
  memberById,
  fullName,
  currentUser,
  setCurrentUser,
  onViewerChange,
} from "./club";
export { events, attendance, upcomingEvents } from "./events";
export { routines, routineById } from "./routines";
export {
  invoices,
  openInvoices,
  ledger,
  sumOpenCents,
  sumPaidCents,
  dunningPipeline,
  ledgerBalanceCents,
} from "./finance";
export { competitions, tasks, openTasks } from "./competitions";
export { daysFromNow, dateFromNow } from "./util";
