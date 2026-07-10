import { DATA_SOURCE } from "./config";
import { apiRepository } from "./api";
import { mockRepository } from "./mock";
import type { DataRepository } from "./types";

/**
 * Daten-Facade des Portals — der EINZIGE Import, den Screens für Daten
 * brauchen (kein lib/mock, kein fetch, kein direkter API-Client mehr).
 *
 *   import { data, dataSource } from "@/lib/data";
 *   const members = await data.getMembers();
 *
 * Umschalten: NEXT_PUBLIC_DATA_SOURCE=mock|api (Default mock; api nur im
 * Dev-Modus — siehe config.ts). Migration: lib/data/MIGRATION.md.
 */

export const dataSource = DATA_SOURCE;

export const data: DataRepository = DATA_SOURCE === "api" ? apiRepository : mockRepository;

export type {
  AssignableRole,
  DataRepository,
  DunningRunOutcome,
  SetAttendanceInput,
  SetRsvpInput,
} from "./types";
export type { DataSourceName } from "./config";
export {
  ApiError,
  NotImplementedError,
  errorMessage,
  isForbidden,
  isNotImplemented,
} from "./errors";
export {
  dunningPipeline,
  fullName,
  ledgerBalanceCents,
  memberById,
  openInvoices,
  openTasks,
  sumOpenCents,
  sumPaidCents,
  upcomingEvents,
  type DunningStage,
} from "./derive";
