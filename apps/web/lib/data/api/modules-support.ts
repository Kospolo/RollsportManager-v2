import { ApiError } from "@/lib/api/generated";
import type { Problem } from "@/lib/api/generated/types";
import { readSession } from "@/lib/auth/storage";
import type {
  Id,
  SupportActor,
  SupportMessage,
  SupportTicket,
  SupportTicketDetail,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/lib/types";
import { API_BASE_URL } from "../config";
import type { DataRepository } from "../types";
import { activeClubId } from "./client";

/**
 * API-Implementierung der Support-Tickets (Migration 0052, routes/support.ts).
 *
 * ############################################################################
 * ### WARUM HIER fetch STEHT UND NICHT apiClient.getSupportTickets()       ###
 * ############################################################################
 * lib/api/generated ist GENERIERT ("NICHT VON HAND AENDERN") und kennt die
 * Support-Routen noch nicht — der Codegen läuft EINMAL beim Zusammenführen,
 * nicht in diesem Bautrupp (ausdrückliche Auftragsregel: keine Contracts
 * regenerieren). Die Alternative wäre gewesen, gegen erfundene Client-Methoden
 * zu schreiben, die es heute nicht gibt: das compiliert nicht und wäre eine
 * Attrappe.
 *
 * Deshalb dieser eng begrenzte Helfer. Er ist KEIN zweiter API-Client: er
 * spiegelt exakt das Verhalten von ApiClient.request (client.ts:51-97) —
 * Bearer-Token aus der Dev-Session, RFC-7807-Fehler als ApiError, dieselbe
 * Meldung. Die Screens merken keinen Unterschied und fangen ApiError wie
 * überall sonst.
 *
 * ERSETZUNGSPUNKT (eine Stelle, mechanisch): sobald der Zusammenführer
 * `npm run generate` gelaufen hat, existieren
 *   apiClient.getSupportTickets({ club_id }) · postSupportTickets(body)
 *   getSupportTicketsByTicketId(id)          · postSupportTicketsByTicketIdMessages(id, body)
 *   patchSupportTicketsByTicketId(id, body)  · getPlatformSupportTickets({ club_id })
 * (Namen nach der Konvention des Generators, siehe client.ts). Dann `request`
 * unten durch die Client-Methoden ersetzen und diesen Block löschen — die
 * Mapper und die Facade-Methoden bleiben unverändert.
 */

interface Query {
  [key: string]: string | undefined;
}

async function request<T>(method: string, path: string, init?: { query?: Query; body?: unknown }): Promise<T> {
  const url = new URL(API_BASE_URL.replace(/\/+$/, "") + path);
  for (const [key, value] of Object.entries(init?.query ?? {})) {
    if (value === undefined) continue;
    url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = { accept: "application/json" };
  if (init?.body !== undefined) headers["content-type"] = "application/json";
  const token = readSession()?.token ?? null;
  if (token) headers["authorization"] = `Bearer ${token}`;

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  if (!res.ok) {
    let problem: Problem | null = null;
    try {
      problem = (await res.json()) as Problem;
    } catch {
      // Kein JSON-Fehlerkörper — problem bleibt null (wie im Generat).
    }
    const detail = problem?.detail ?? problem?.title ?? res.statusText;
    throw new ApiError(res.status, problem, `${method} ${path} -> ${res.status}: ${detail}`);
  }

  return (await res.json()) as T;
}

/* ---------------------------------------------------------------------------
 * Mapper: snake_case (Vertrag) -> camelCase (View-Modell). null -> undefined,
 * wie in mappers.ts.
 * ------------------------------------------------------------------------- */

interface WireMessage {
  id: string;
  ticket_id: string;
  club_id: string;
  author_profile_id: string;
  author_name: string | null;
  author_kind: SupportActor;
  body: string;
  created_at: string;
}

interface WireTicket {
  id: string;
  club_id: string;
  club_name: string | null;
  created_by_member_id: string;
  created_by_name: string | null;
  subject: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  last_reply_at: string | null;
  last_reply_by: SupportActor | null;
  message_count: number;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

type WireDetail = WireTicket & { messages: WireMessage[] };

export function mapSupportMessage(m: WireMessage): SupportMessage {
  return {
    id: m.id,
    ticketId: m.ticket_id,
    clubId: m.club_id,
    authorProfileId: m.author_profile_id,
    authorName: m.author_name ?? undefined,
    authorKind: m.author_kind,
    body: m.body,
    createdAt: m.created_at,
  };
}

export function mapSupportTicket(t: WireTicket): SupportTicket {
  return {
    id: t.id,
    clubId: t.club_id,
    clubName: t.club_name ?? undefined,
    createdByMemberId: t.created_by_member_id,
    createdByName: t.created_by_name ?? undefined,
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    lastReplyAt: t.last_reply_at ?? undefined,
    lastReplyBy: t.last_reply_by ?? undefined,
    messageCount: t.message_count,
    closedAt: t.closed_at ?? undefined,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

export function mapSupportTicketDetail(t: WireDetail): SupportTicketDetail {
  return { ...mapSupportTicket(t), messages: t.messages.map(mapSupportMessage) };
}

type SupportMethods = Pick<
  DataRepository,
  | "listSupportTickets"
  | "getSupportTicket"
  | "createSupportTicket"
  | "replySupportTicket"
  | "listAllSupportTickets"
  | "updateSupportTicket"
>;

export const moduleApiRepositorySupport: SupportMethods = {
  async listSupportTickets(): Promise<SupportTicket[]> {
    const rows = await request<WireTicket[]>("GET", "/support/tickets", {
      query: { club_id: activeClubId() },
    });
    return rows.map(mapSupportTicket);
  },

  async getSupportTicket(ticketId: Id): Promise<SupportTicketDetail> {
    const row = await request<WireDetail>("GET", `/support/tickets/${ticketId}`);
    return mapSupportTicketDetail(row);
  },

  async createSupportTicket(input): Promise<SupportTicketDetail> {
    // created_by_member_id schickt der Client NICHT — der Server leitet ihn aus
    // dem Token ab (routes/support.ts).
    const row = await request<WireDetail>("POST", "/support/tickets", {
      body: {
        club_id: input.clubId ?? activeClubId(),
        subject: input.subject,
        body: input.body,
      },
    });
    return mapSupportTicketDetail(row);
  },

  async replySupportTicket(ticketId: Id, input): Promise<SupportTicketDetail> {
    // author_kind schickt der Client NICHT: der Server leitet die Seite aus dem
    // Token ab und die DB prüft sie nach (app.support_guard_message, 0052).
    const row = await request<WireDetail>("POST", `/support/tickets/${ticketId}/messages`, {
      body: { body: input.body },
    });
    return mapSupportTicketDetail(row);
  },

  async listAllSupportTickets(clubId?: Id): Promise<SupportTicket[]> {
    const rows = await request<WireTicket[]>("GET", "/platform/support/tickets", {
      query: { club_id: clubId },
    });
    return rows.map(mapSupportTicket);
  },

  async updateSupportTicket(ticketId: Id, patch): Promise<SupportTicketDetail> {
    const row = await request<WireDetail>("PATCH", `/support/tickets/${ticketId}`, {
      body: patch,
    });
    return mapSupportTicketDetail(row);
  },
};
