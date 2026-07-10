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
  AddMarkerInput,
  AssignableRole,
  CreateEventInput,
  CreateTeamInput,
  DataRepository,
  DunningRunOutcome,
  InviteMemberInput,
  SetAttendanceInput,
  SetRsvpInput,
  SetTeamMembersInput,
  UpdateClubSettingsInput,
  UpdateMemberInput,
  UpdateTeamInput,
} from "./types";
export type {
  CreateExerciseInput,
  CreateNewsInput,
  CreateNoteInput,
  UpdateExerciseInput,
  UpdateNewsInput,
  UpdateNoteInput,
} from "./inputs-batch1";
export type {
  CreateAchievementInput,
  CreateBookingInput,
  CreateEquipmentInput,
  CreateFacilityInput,
  CreateReservationInput,
  UpdateAchievementInput,
  UpdateBookingInput,
  UpdateEquipmentInput,
  UpdateFacilityInput,
  UpdateReservationInput,
} from "./inputs-batch2";
export type {
  CreateDutyEntryInput,
  CreateDutyRequirementInput,
  CreateTrainingSlotInput,
  UpdateDutyEntryInput,
  UpdateDutyRequirementInput,
  UpdateTrainingSlotInput,
} from "./inputs-batch3";
export type {
  ChatMessageQuery,
  CreateCheckinInput,
  CreateRegionalEventInput,
  SendChatMessageInput,
  UpdateRegionalEventInput,
} from "./inputs-batch4";
export type {
  Batch5Repository,
  DocumentUploadMeta,
  GalleryUploadMeta,
} from "./inputs-batch5";
export type { DataSourceName } from "./config";
export { permissions, type Permissions } from "./permissions";
export {
  ApiError,
  ClubProRequiredError,
  NotImplementedError,
  errorMessage,
  isClubProRequired,
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
