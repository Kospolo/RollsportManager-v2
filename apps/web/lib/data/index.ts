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
  CreateSupportMessageInput,
  CreateSupportTicketInput,
  SupportRepository,
  UpdateSupportTicketInput,
} from "./inputs-support";
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
export type {
  AddGuardianshipInput,
  Cluster6aRepository,
  CreateChildInput,
  GuardianRelation,
  JoinWaitlistInput,
  UpdateWaitlistInput,
  UpsertBudgetInput,
} from "./inputs-cluster6a";
export type {
  ApplyDunningInput,
  CreateInvoiceInput,
  CreateLedgerCategoryInput,
  CreateLedgerEntryInput,
  FinanceRepository,
  ListDunningLogFilter,
  ListInvoicesFilter,
  ReverseLedgerInput,
  SettleInvoiceInput,
} from "./inputs-finance";
export type {
  AssignMemberFeeInput,
  CreateFamilyDiscountInput,
  CreateMembershipCategoryInput,
  CreateSepaMandateInput,
  FinanceBRepository,
  ListMemberFeesFilter,
  ListSepaMandatesFilter,
  UpdateFamilyDiscountInput,
  UpdateMemberFeeInput,
  UpdateMembershipCategoryInput,
  UpdateSepaMandateInput,
} from "./inputs-financeb";
export type {
  BankTransactionImportRowInput,
  CreateBankTransactionInput,
  CreateDonationInput,
  FinanceCRepository,
  IgnoreBankTransactionInput,
  ImportBankTransactionsInput,
  LedgerExportRange,
  MatchBankTransactionInput,
  UpdateDonationInput,
} from "./inputs-financec";
export type {
  MeRepository,
  RemoveMyPhotoResult,
  UpdateMyPreferencesInput,
  UpdateMyProfileInput,
  UpdateMySelfProfileInput,
} from "./inputs-me";
export { ABOUT_ME_MAX, DISCIPLINE_MAX, MOTTO_MAX, SKATING_SINCE_MIN } from "./inputs-me";
export type { CreateAssessmentInput, MemberProfileRepository } from "./inputs-memberprofile";
export type {
  CapabilityEnforcement,
  CapabilityLevel,
  CapabilityResolution,
  ClubRoleDef,
  CreateClubRoleInput,
  MemberRoleAssignment,
  RbacRepository,
  ResolvedCapability,
  RolePermission,
  UpdateClubRoleInput,
} from "./inputs-rbac";
export type {
  AssignLockerInput,
  CreateDepartmentInput,
  CreateLockerInput,
  OrgRepository,
  SetDepartmentMembersInput,
  UpdateDepartmentInput,
  UpdateLockerInput,
} from "./inputs-org";
export type {
  PlatformConsoleRepository,
  PlatformPaymentsQuery,
  PlatformRoutinesQuery,
  SetEntitlementInput,
  UpdatePlatformContentInput,
  UpdatePlatformLegalInput,
  UpdatePlatformSettingsInput,
  UpdatePlatformSmtpInput,
  UpdateProductInput,
} from "./inputs-platform";
export type { SaveRoutineScoreInput, WettkampfRepository } from "./inputs-wettkampf";
export type { DataSourceName } from "./config";
/** Modul-Schalter pro Verein (0044): gekauft -> EINGESCHALTET -> erlaubt. */
export type {
  ClubModuleState,
  ModuleEnforcement,
  ModuleRepository,
} from "./inputs-clubmodules";

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
