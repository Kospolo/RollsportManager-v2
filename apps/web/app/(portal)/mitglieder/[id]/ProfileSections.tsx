"use client";

import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n";
import { formatDateShort, formatDurationMs, formatEUR, relativeDays } from "@/lib/format";
import type {
  Achievement,
  Attendance,
  Checkin,
  EffectiveConsent,
  EquipmentReservation,
  EventRsvp,
  MemberAssessment,
  MemberCoachNote,
  MemberDepartmentRef,
  MemberProfile,
  MemberProfileCompetition,
  MemberProfileDuty,
  MemberProfileFinance,
  MemberRoleRef,
  Routine,
} from "@/lib/api/generated";
import { Card, CardHeader, CardFooter } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { ProgressBar, type ProgressTone } from "@/components/ui/ProgressBar";
import { Sparkline } from "@/components/ui/Sparkline";
import { ScoreTrend, type ScorePoint } from "@/components/ui/ScoreTrend";
import { KpiTile } from "@/components/ui/KpiTile";
import { Icon, type IconName } from "@/components/shell/icons";
import { Button } from "@/components/ui/Button";
import { profileDict, type ProfileKey } from "./profile-i18n";

/* Kleiner Typ-Helfer: der useT-Hook auf unser Profil-Dictionary. */
type PT = (key: ProfileKey, params?: Record<string, string | number>) => string;

/* Medaillen-Icon (kein Emoji): schlichte Scheibe im Metallton + Band. */
function MedalIcon({ medal, className = "" }: { medal: "gold" | "silver" | "bronze"; className?: string }) {
  const fill = medal === "gold" ? "#E0A93B" : medal === "silver" ? "#AFB6BD" : "#C08457";
  const ring = medal === "gold" ? "#B9852A" : medal === "silver" ? "#8B9298" : "#9B6640";
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M8.5 2.5 6 8m9.5-5.5L18 8" stroke={ring} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <circle cx="12" cy="15" r="6.2" fill={fill} stroke={ring} strokeWidth="1.4" />
      <circle cx="12" cy="15" r="3" fill="none" stroke={ring} strokeWidth="1.1" opacity="0.7" />
    </svg>
  );
}

/* --------------------------------- Leistung --------------------------------- */

const ROUTINE_STATUS: Record<Routine["status"], ProfileKey> = {
  draft: "routineStatusDraft",
  ready: "routineStatusReady",
  competition: "routineStatusCompetition",
  archived: "routineStatusArchived",
};

/** Mini-Wellenform aus den Peaks — Honig ist Musik (DESIGN-SYSTEM erlaubt es HIER). */
function MiniWaveform({ peaks, label }: { peaks: number[]; label: string }) {
  const shown = peaks.slice(0, 56);
  return (
    <div role="img" aria-label={label} className="flex h-9 items-center gap-[2px]">
      {shown.map((p, i) => (
        <span
          key={i}
          className="w-[3px] flex-1 rounded-full bg-honey"
          style={{ height: `${Math.max(10, Math.round(p * 100))}%` }}
        />
      ))}
    </div>
  );
}

export function RoutinesCard({ routines }: { routines: Routine[] }) {
  const tp = useT(profileDict) as PT;
  if (routines.length === 0) return null;
  return (
    <Card>
      <CardHeader eyebrow={tp("routineEyebrow")} title={tp("routineTitle")} />
      <ul className="grid list-none gap-4">
        {routines.map((r) => (
          <li key={r.id}>
            <Link
              href={`/kueren/${r.id}`}
              aria-label={`${r.title} — ${tp("routineOpen")}`}
              className="group grid gap-2.5 rounded-lg border border-line bg-canvas p-4 transition-colors hover:border-line-strong hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h4 className="font-display text-[16px] font-extrabold tracking-[-0.01em] text-ink">
                  {r.title}
                </h4>
                <span className="flex items-center gap-2">
                  <Badge tone="neutral">{tp(ROUTINE_STATUS[r.status])}</Badge>
                  <Icon
                    name="chevronRight"
                    className="ic h-4 w-4 text-ink-faint transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </div>
            {r.music_title && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="honey" icon="play">
                  {r.music_artist
                    ? tp("musicBy", { title: r.music_title, artist: r.music_artist })
                    : r.music_title}
                </Badge>
                {r.music_duration_ms != null && (
                  <span className="font-mono text-[12.5px] text-ink-faint tabular-nums">
                    {tp("routineDuration", { time: formatDurationMs(r.music_duration_ms) })}
                  </span>
                )}
              </div>
            )}
              {r.waveform_peaks && r.waveform_peaks.length > 0 && (
                <MiniWaveform peaks={r.waveform_peaks} label={tp("waveformLabel")} />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ScoreCard({ competition }: { competition: MemberProfileCompetition }) {
  const tp = useT(profileDict) as PT;
  const { locale } = useLocale();
  const scores = [...competition.scores]
    .filter((s) => s.total_score != null)
    .sort((a, b) => a.scored_on.localeCompare(b.scored_on));
  const entries = competition.entries;
  if (scores.length === 0 && entries.length === 0) return null;

  const points: ScorePoint[] = scores.map((s) => ({
    id: s.id,
    dateLabel: formatDateShort(s.scored_on, locale),
    total: s.total_score as number,
    placement: s.placement,
  }));
  const latest = scores.length > 0 ? (scores[scores.length - 1].total_score as number) : null;
  const best = scores.length > 0 ? Math.max(...scores.map((s) => s.total_score as number)) : null;
  const num = (n: number) => n.toFixed(2).replace(".", ",");

  const ENTRY_TONE: Record<string, BadgeTone> = {
    registered: "info",
    confirmed: "success",
    withdrawn: "neutral",
  };
  const ENTRY_KEY: Record<string, ProfileKey> = {
    registered: "entryRegistered",
    confirmed: "entryConfirmed",
    withdrawn: "entryWithdrawn",
  };

  return (
    <Card>
      <CardHeader eyebrow={tp("scoreEyebrow")} title={tp("scoreTitle")} />
      {points.length > 0 ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <KpiTile
              label={tp("scoreLatest")}
              value={latest != null ? num(latest) : "—"}
              sub={tp("scorePoints", { n: "" }).trim()}
              tone="brand"
            />
            <KpiTile
              label={tp("scoreBest")}
              value={best != null ? num(best) : "—"}
              sub={tp("scorePoints", { n: "" }).trim()}
              tone="success"
            />
          </div>
          <div className="overflow-x-auto">
            <ScoreTrend
              points={points}
              label={tp("scoreTrendLabel", {
                values: points.map((p) => num(p.total)).join(" → "),
              })}
              placeLabel={(n) => tp("placeShort", { n })}
              className="min-w-[320px]"
            />
          </div>
          {/* Zeilentabelle als lesbare, screenreader-freundliche Ergänzung. */}
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[380px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="py-1.5 pr-3 text-[11px] font-extrabold uppercase tracking-[0.09em] text-ink-faint">
                    {tp("colScoreDate")}
                  </th>
                  <th className="py-1.5 px-3 text-right text-[11px] font-extrabold uppercase tracking-[0.09em] text-ink-faint">
                    {tp("colTech")}
                  </th>
                  <th className="py-1.5 px-3 text-right text-[11px] font-extrabold uppercase tracking-[0.09em] text-ink-faint">
                    {tp("colComp")}
                  </th>
                  <th className="py-1.5 px-3 text-right text-[11px] font-extrabold uppercase tracking-[0.09em] text-ink-faint">
                    {tp("colTotal")}
                  </th>
                  <th className="py-1.5 pl-3 text-right text-[11px] font-extrabold uppercase tracking-[0.09em] text-ink-faint">
                    {tp("colPlace")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...scores].reverse().map((s) => (
                  <tr key={s.id} className="border-b border-line last:border-0">
                    <td className="py-2 pr-3 text-ink-soft tabular-nums">
                      {formatDateShort(s.scored_on, locale)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-ink">
                      {s.technical_score != null ? num(s.technical_score) : "—"}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-ink">
                      {s.components_score != null ? num(s.components_score) : "—"}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold tabular-nums text-ink">
                      {num(s.total_score as number)}
                    </td>
                    <td className="py-2 pl-3 text-right tabular-nums text-ink-soft">
                      {s.placement != null ? tp("placeShort", { n: s.placement }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-body text-ink-soft">{tp("scoreNone")}</p>
      )}
      {entries.length > 0 && (
        <CardFooter>
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-ink-faint">{tp("entriesLabel")}:</span>
            {entries.map((e) => (
              <Badge key={e.id} tone={ENTRY_TONE[e.status] ?? "neutral"}>
                {tp(ENTRY_KEY[e.status] ?? "entryRegistered")}
              </Badge>
            ))}
          </span>
        </CardFooter>
      )}
    </Card>
  );
}

const MEDAL_KEY: Record<"gold" | "silver" | "bronze", ProfileKey> = {
  gold: "medalGold",
  silver: "medalSilver",
  bronze: "medalBronze",
};

export function MedalCard({ achievements }: { achievements: Achievement[] }) {
  const tp = useT(profileDict) as PT;
  const { locale } = useLocale();
  if (achievements.length === 0) return null;
  const tally = { gold: 0, silver: 0, bronze: 0 };
  for (const a of achievements) tally[a.medal] += 1;

  return (
    <Card>
      <CardHeader eyebrow={tp("medalEyebrow")} title={tp("medalTitle")} />
      <div className="mb-4 flex flex-wrap gap-2.5">
        {(["gold", "silver", "bronze"] as const).map((m) => (
          <span
            key={m}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2"
          >
            <MedalIcon medal={m} className="h-5 w-5" />
            <span className="font-display text-[18px] font-extrabold tabular-nums text-ink">
              {tally[m]}
            </span>
            <span className="text-caption text-ink-faint">{tp(MEDAL_KEY[m])}</span>
          </span>
        ))}
      </div>
      <ul className="grid list-none gap-2.5">
        {achievements.map((a) => (
          <li key={a.id} className="flex items-start gap-3">
            <MedalIcon medal={a.medal} className="mt-0.5 h-6 w-6 flex-none" />
            <div className="grid min-w-0 gap-0.5">
              <span className="text-[14px] font-bold text-ink">{a.title}</span>
              <span className="text-caption text-ink-faint">
                {[
                  a.competition_name,
                  a.placement != null ? tp("placement", { n: a.placement }) : null,
                  formatDateShort(a.achieved_on, locale),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {a.note && <span className="text-caption text-ink-soft">{a.note}</span>}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* -------------------------------- Entwicklung -------------------------------- */

function Stars({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-caption text-ink-faint">{label}</span>
      <span aria-hidden="true" className="inline-flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={`h-1.5 w-1.5 rounded-full ${n <= value ? "bg-brand" : "bg-line-strong"}`}
          />
        ))}
      </span>
    </span>
  );
}

export function AssessmentCard({
  assessments,
  authorName,
  canWrite,
  onWrite,
}: {
  assessments: MemberAssessment[];
  authorName: (memberId: string) => string;
  canWrite: boolean;
  onWrite: () => void;
}) {
  const tp = useT(profileDict) as PT;
  const { locale } = useLocale();
  return (
    <Card>
      <CardHeader
        eyebrow={tp("assessEyebrow")}
        title={tp("assessTitle")}
        action={
          canWrite ? (
            <Button size="sm" icon="edit" onClick={onWrite}>
              {tp("assessWrite")}
            </Button>
          ) : undefined
        }
      />
      {/* Steht auch dann da, wenn noch nichts geschrieben wurde — gerade dann:
          die Erwartung „wer liest das?" bildet sich vor dem ersten Satz. Die
          Beurteilung ist die Textsorte, die die Familie SEHEN DARF; das ist
          der Unterschied zur internen Notiz weiter unten, und beide Karten
          sagen ihn ausdrücklich, statt ihn den Titeln zu überlassen. */}
      <p className="mb-3 text-caption leading-[18px] text-ink-faint">
        {tp("assessVisibleToFamily")}
      </p>
      {assessments.length === 0 ? (
        <p className="text-body text-ink-soft">{tp("assessNone")}</p>
      ) : (
        <ul className="grid list-none gap-3">
          {assessments.map((a) => (
            <li key={a.id} className="rounded-xl bg-sunken p-4">
              <p className="text-[14px] leading-[21px] text-ink">{a.body}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <span className="text-caption font-semibold text-ink-soft">
                  {tp("assessBy", { name: authorName(a.author_member_id) })} ·{" "}
                  {formatDateShort(a.assessed_on, locale)}
                </span>
                {a.rating_technik != null && <Stars label={tp("ratingTech")} value={a.rating_technik} />}
                {a.rating_ausdruck != null && <Stars label={tp("ratingExpr")} value={a.rating_ausdruck} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * INTERNE Trainer-Notizen (0069) — die dritte Sorte Text ueber eine Person,
 * NICHT die Beurteilung darueber (AssessmentCard).
 *
 * Diese Karte wird nur gerendert, wenn die Betrachterin sie sehen darf; die
 * Liste kommt aus einem EIGENEN Aufruf (GET /coach-notes), nicht aus dem
 * Profil-Aggregat — siehe lib/data/inputs-memberprofile.ts.
 *
 * Der "Nur fuer Trainer:innen"-Eyebrow ist kein Schmuck: er sagt der
 * Schreiberin beim Lesen ihrer eigenen alten Notizen, in welchem Vertraulich-
 * keitsrahmen sie stehen. Der vollstaendige Hinweis (inkl. Art. 15 DSGVO)
 * steht an der EINGABE, wo die Entscheidung faellt (CoachNoteSheet).
 */
export function CoachNotesCard({
  notes,
  authorName,
  canWrite,
  canModify,
  onWrite,
  onEdit,
  onDelete,
}: {
  notes: MemberCoachNote[];
  authorName: (memberId: string) => string;
  canWrite: boolean;
  /**
   * Darf DIESE Notiz geaendert/geloescht werden? Bewusst je Notiz und nicht
   * pauschal: der Server laesst „author or board" zu, also darf eine Trainerin
   * die Notizen einer Kollegin LESEN, aber nicht umschreiben. Ein Knopf, den
   * der Server ablehnt, ist eine Luege — deshalb wird hier dieselbe Frage
   * gestellt wie dort.
   */
  canModify: (note: MemberCoachNote) => boolean;
  onWrite: () => void;
  onEdit: (note: MemberCoachNote) => void;
  onDelete: (note: MemberCoachNote) => void;
}) {
  const tp = useT(profileDict) as PT;
  const { locale } = useLocale();
  return (
    <Card>
      <CardHeader
        eyebrow={tp("cnEyebrow")}
        title={tp("cnTitle")}
        action={
          canWrite ? (
            <Button size="sm" icon="edit" onClick={onWrite}>
              {tp("cnAdd")}
            </Button>
          ) : undefined
        }
      />
      {/* Das Gegenstueck zum Hinweis auf der Beurteilungs-Karte. Zwei Karten,
          zwei Leserkreise, beide benannt — sonst entscheidet die Trainerin
          nach Gefuehl, in welchen Kasten ein Satz gehoert. */}
      <p className="mb-3 text-caption leading-[18px] text-ink-faint">{tp("cnVsAssessment")}</p>
      {notes.length === 0 ? (
        <p className="text-body text-ink-soft">{tp("cnNone")}</p>
      ) : (
        <ul className="grid list-none gap-3">
          {notes.map((n) => {
            const mine = canModify(n);
            // updated_at weicht ab -> die Notiz wurde geaendert. Das gehoert
            // sichtbar hin: bei einer Auskunft nach Art. 15 DSGVO ist der
            // Unterschied zwischen „so geschrieben" und „spaeter gefasst"
            // genau die Frage, die gestellt wird.
            const edited = n.updated_at.slice(0, 19) !== n.created_at.slice(0, 19);
            return (
              <li key={n.id} className="rounded-xl bg-sunken p-4">
                <p className="text-[14px] leading-[21px] text-ink">{n.body}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="text-caption font-semibold text-ink-soft">
                    {tp("assessBy", { name: authorName(n.author_member_id) })} ·{" "}
                    {formatDateShort(n.created_at, locale)}
                  </span>
                  {edited && (
                    <span className="text-caption text-ink-faint">
                      {tp("cnEditedMark", { date: formatDateShort(n.updated_at, locale) })}
                    </span>
                  )}
                  {mine && (
                    <span className="ml-auto flex flex-wrap items-center gap-1">
                      <Button size="sm" variant="ghost" icon="edit" onClick={() => onEdit(n)}>
                        {tp("cnEdit")}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onDelete(n)}>
                        {tp("cnDelete")}
                      </Button>
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

const ATT_VALUE: Record<Attendance["status"], number | null> = {
  present: 100,
  late: 70,
  excused: null,
  absent: 0,
};

function rateTone(pct: number): ProgressTone {
  if (pct >= 80) return "success";
  if (pct >= 60) return "warn";
  return "danger";
}

export function AttendanceCard({ attendance }: { attendance: Attendance[] }) {
  const tp = useT(profileDict) as PT;
  if (attendance.length === 0) return null;
  const counted = attendance.filter((a) => a.status !== "excused");
  const attended = counted.filter((a) => a.status === "present" || a.status === "late").length;
  const total = counted.length;
  const pct = total > 0 ? Math.round((attended / total) * 100) : 0;
  // Verlauf: chronologisch aufsteigend, entschuldigte Einheiten übersprungen.
  const series = [...attendance]
    .reverse()
    .map((a) => ATT_VALUE[a.status])
    .filter((v): v is number => v != null)
    .slice(-12);

  return (
    <Card>
      <CardHeader eyebrow={tp("attendEyebrow")} title={tp("attendTitle")} />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="grid gap-2">
          <span className="font-display text-[28px] font-extrabold leading-8 tracking-tight text-ink tabular-nums">
            {pct} %
          </span>
          <ProgressBar
            value={attended}
            max={total}
            tone={rateTone(pct)}
            label={tp("attendRate", { present: attended, total })}
          />
          <span className="text-[13px] font-semibold text-ink-soft">
            {tp("attendRate", { present: attended, total })}
          </span>
        </div>
        {series.length > 1 && (
          <Sparkline
            values={series}
            width={150}
            height={44}
            label={tp("attendTrendLabel")}
            className="text-brand"
          />
        )}
      </div>
    </Card>
  );
}

const DUTY_KIND: Record<string, ProfileKey> = {
  training: "dutyKindTraining",
  helper: "dutyKindHelper",
  competition: "dutyKindCompetition",
  other: "dutyKindOther",
};

export function DutyCard({ duty }: { duty: MemberProfileDuty }) {
  const tp = useT(profileDict) as PT;
  const { locale } = useLocale();
  const required = duty.requirements.reduce((sum, r) => sum + (r.required_hours ?? 0), 0);
  const done = Math.round(duty.entries.reduce((sum, e) => sum + (e.hours ?? 0), 0) * 10) / 10;
  if (required === 0 && duty.entries.length === 0) return null;
  const met = required > 0 && done >= required;
  const open = Math.max(0, Math.round((required - done) * 10) / 10);

  return (
    <Card>
      <CardHeader eyebrow={tp("dutyEyebrow")} title={tp("dutyTitle")} />
      {required > 0 && (
        <div className="mb-4 grid gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-display text-[22px] font-extrabold text-ink tabular-nums">
              {tp("dutyDone", { n: String(done).replace(".", ",") })}
            </span>
            <span className="text-caption text-ink-faint tabular-nums">
              / {tp("dutyDone", { n: String(required).replace(".", ",") })}
            </span>
          </div>
          <ProgressBar
            value={done}
            max={required}
            tone={met ? "success" : "brand"}
            label={tp("dutyProgress", {
              done: String(done).replace(".", ","),
              required: String(required).replace(".", ","),
            })}
          />
          <span className="text-[13px] font-semibold text-ink-soft">
            {met ? tp("dutyMet") : tp("dutyOpen", { n: String(open).replace(".", ",") })}
          </span>
        </div>
      )}
      {duty.entries.length > 0 && (
        <ul className="grid list-none gap-2">
          {duty.entries.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2 last:border-0"
            >
              <span className="grid min-w-0 gap-0.5">
                <span className="truncate text-[14px] text-ink">{e.note ?? tp(DUTY_KIND[e.kind])}</span>
                <span className="text-caption text-ink-faint tabular-nums">
                  {formatDateShort(e.activity_date, locale)}
                </span>
              </span>
              <span className="flex flex-none items-center gap-1.5">
                <Badge tone="neutral">{tp(DUTY_KIND[e.kind])}</Badge>
                <span className="font-mono text-[13px] font-bold tabular-nums text-ink">
                  {tp("dutyDone", { n: String(e.hours ?? 0).replace(".", ",") })}
                </span>
                <Badge tone={e.approved ? "success" : "warn"}>
                  {e.approved ? tp("dutyApproved") : tp("dutyPending")}
                </Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function CheckinCard({ checkins }: { checkins: Checkin[] }) {
  const tp = useT(profileDict) as PT;
  const { locale } = useLocale();
  if (checkins.length === 0) return null;
  return (
    <Card>
      <CardHeader eyebrow={tp("checkinEyebrow")} title={tp("checkinTitle")} />
      <ul className="grid list-none gap-2">
        {checkins.slice(0, 8).map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-0">
            <span className="inline-flex items-center gap-2 text-[14px] text-ink tabular-nums">
              <Icon name="clock" className="ic h-4 w-4 text-ink-faint" />
              {formatDateShort(c.checked_in_at, locale)}
            </span>
            <Badge tone="neutral">{c.method === "qr" ? tp("checkinQr") : tp("checkinManual")}</Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ---------------------------------- Termine ---------------------------------- */

const RSVP_TONE: Record<EventRsvp["status"], BadgeTone> = {
  going: "success",
  declined: "danger",
  maybe: "info",
  sick: "warn",
};
const RSVP_KEY: Record<EventRsvp["status"], ProfileKey> = {
  going: "rsvpGoing",
  declined: "rsvpDeclined",
  maybe: "rsvpMaybe",
  sick: "rsvpSick",
};

export function RsvpCard({ rsvps }: { rsvps: EventRsvp[] }) {
  const tp = useT(profileDict) as PT;
  const { locale } = useLocale();
  if (rsvps.length === 0) return null;
  return (
    <Card>
      <CardHeader eyebrow={tp("rsvpEyebrow")} title={tp("rsvpTitle")} />
      <ul className="grid list-none gap-2.5">
        {rsvps.map((r) => (
          <li key={r.id} className="grid gap-1 border-b border-line py-2 last:border-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge tone={RSVP_TONE[r.status]}>{tp(RSVP_KEY[r.status])}</Badge>
              <span className="text-caption text-ink-faint tabular-nums">
                {tp("rsvpOn", { date: formatDateShort(r.responded_at, locale) })}
              </span>
            </div>
            {r.comment && (
              <p className="rounded-lg bg-sunken px-3 py-1.5 text-[13px] text-ink-soft">
                „{r.comment}“
              </p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

const RES_TONE: Record<EquipmentReservation["status"], BadgeTone> = {
  active: "success",
  returned: "neutral",
  cancelled: "danger",
};
const RES_KEY: Record<EquipmentReservation["status"], ProfileKey> = {
  active: "equipActive",
  returned: "equipReturned",
  cancelled: "equipCancelled",
};

export function EquipmentCard({ equipment }: { equipment: EquipmentReservation[] }) {
  const tp = useT(profileDict) as PT;
  const { locale } = useLocale();
  if (equipment.length === 0) return null;
  return (
    <Card>
      <CardHeader eyebrow={tp("equipEyebrow")} title={tp("equipTitle")} />
      <ul className="grid list-none gap-2">
        {equipment.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2 last:border-0">
            <span className="inline-flex items-center gap-2 text-[14px] text-ink tabular-nums">
              <Icon name="teams" className="ic h-4 w-4 text-ink-faint" />
              {tp("equipFromTo", {
                from: formatDateShort(r.from_at, locale),
                to: formatDateShort(r.to_at, locale),
              })}
            </span>
            <span className="flex items-center gap-1.5">
              {r.quantity != null && r.quantity > 1 && (
                <span className="font-mono text-[13px] tabular-nums text-ink-soft">
                  {tp("equipQty", { n: r.quantity })}
                </span>
              )}
              <Badge tone={RES_TONE[r.status]}>{tp(RES_KEY[r.status])}</Badge>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ------------------------------- Verein & Orga ------------------------------- */

export function RolesCard({ roles }: { roles: MemberRoleRef[] }) {
  const tp = useT(profileDict) as PT;
  const { locale } = useLocale();
  if (roles.length === 0) return null;
  return (
    <Card>
      <CardHeader eyebrow={tp("rolesEyebrow")} title={tp("rolesTitle")} />
      <div className="flex flex-wrap gap-2">
        {roles.map((r) => (
          <Badge key={r.role_id} tone="brand">
            {locale === "en" ? r.name_en : r.name_de}
          </Badge>
        ))}
      </div>
    </Card>
  );
}

export function DepartmentsCard({ departments }: { departments: MemberDepartmentRef[] }) {
  const tp = useT(profileDict) as PT;
  if (departments.length === 0) return null;
  return (
    <Card>
      <CardHeader eyebrow={tp("deptEyebrow")} title={tp("deptTitle")} />
      <ul className="grid list-none gap-2">
        {departments.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-2 border-b border-line py-2 last:border-0">
            <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-ink">
              <Icon name="teams" className="ic h-4 w-4 text-ink-faint" />
              {d.name}
            </span>
            {d.is_lead && <Badge tone="info">{tp("deptLead")}</Badge>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

const PERIOD_KEY: Record<string, ProfileKey> = {
  monthly: "periodMonthly",
  quarterly: "periodQuarterly",
  yearly: "periodYearly",
  once: "periodOnce",
};
const INV_STATUS_TONE: Record<string, BadgeTone> = {
  paid: "success",
  open: "warn",
  cancelled: "neutral",
  draft: "neutral",
};

export function FinanceCard({ finance }: { finance: MemberProfileFinance }) {
  const tp = useT(profileDict) as PT;
  const { locale } = useLocale();
  const { invoices, member_fees, sepa_mandates } = finance;
  const openCents = invoices
    .filter((i) => i.status === "open")
    .reduce((sum, i) => sum + (i.amount_cents ?? 0), 0);

  return (
    <Card>
      <CardHeader eyebrow={tp("financeEyebrow")} title={tp("financeTitle")} />
      <p className="mb-3 inline-flex items-center gap-1.5 text-caption text-ink-faint">
        <Icon name="lock" className="ic h-3.5 w-3.5" />
        {tp("finStaffNote")}
      </p>

      {member_fees.length > 0 && (
        <ul className="mb-4 grid list-none gap-2">
          {member_fees.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3">
              <span className="text-[14px] text-ink">{f.category_name ?? tp("feeLabel")}</span>
              {f.category_amount_cents != null && f.category_period && (
                <span className="font-mono text-[13px] font-bold tabular-nums text-ink">
                  {tp("feePer", {
                    amount: formatEUR(f.category_amount_cents, locale),
                    period: tp(PERIOD_KEY[f.category_period]),
                  })}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {invoices.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="py-1.5 pr-3 text-[11px] font-extrabold uppercase tracking-[0.09em] text-ink-faint">
                  {tp("colInvoice")}
                </th>
                <th className="py-1.5 px-3 text-[11px] font-extrabold uppercase tracking-[0.09em] text-ink-faint">
                  {tp("colStatus")}
                </th>
                <th className="py-1.5 pl-3 text-right text-[11px] font-extrabold uppercase tracking-[0.09em] text-ink-faint">
                  {tp("colAmount")}
                </th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="border-b border-line last:border-0">
                  <td className="py-2 pr-3">
                    <span className="grid gap-0.5">
                      <span className="text-[14px] font-semibold text-ink">{i.title}</span>
                      <span className="font-mono text-[11.5px] text-ink-faint">{i.number}</span>
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    {i.status === "paid" ? (
                      <Badge tone="success" icon="check">
                        {tp("invPaid")}
                      </Badge>
                    ) : i.status === "cancelled" ? (
                      <Badge tone="neutral">{tp("invCancelled")}</Badge>
                    ) : i.status === "draft" ? (
                      <Badge tone="neutral">{tp("invDraft")}</Badge>
                    ) : (
                      <span className="grid gap-0.5">
                        <Badge tone="warn">{tp("colDue")}</Badge>
                        {i.due_on && (
                          <span className="text-[11.5px] text-ink-faint">
                            {relativeDays(i.due_on, locale)}
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pl-3 text-right font-mono font-bold tabular-nums text-ink">
                    {i.amount_cents != null ? formatEUR(i.amount_cents, locale) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-2 text-caption text-ink-faint" colSpan={2}>
                  {tp("invCount", { n: invoices.length })}
                </td>
                <td className="pt-2 text-right font-mono text-[13px] font-bold tabular-nums text-ink">
                  {tp("invOpenSum", { sum: formatEUR(openCents, locale) })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {sepa_mandates.length > 0 && (
        <div className="mt-4 grid gap-2">
          {sepa_mandates.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-canvas px-3 py-2">
              <span className="inline-flex items-center gap-2 text-[13px] text-ink">
                <Icon name="bank" className="ic h-4 w-4 text-ink-faint" />
                {tp("sepaLabel")}
                {m.iban_last4 && (
                  <span className="font-mono text-ink-faint">{tp("sepaIban", { last4: m.iban_last4 })}</span>
                )}
              </span>
              <Badge tone={m.status === "active" ? "success" : "neutral"}>
                {m.status === "active" ? tp("sepaActive") : tp("sepaRevoked")}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

const CONSENT_PURPOSE: Record<string, ProfileKey> = {
  terms: "cpTerms",
  privacy: "cpPrivacy",
  photos_internal: "cpPhotosInternal",
  photos_public: "cpPhotosPublic",
  chat: "cpChat",
  newsletter: "cpNewsletter",
};

export function ConsentCard({ consents }: { consents: EffectiveConsent[] }) {
  const tp = useT(profileDict) as PT;
  if (consents.length === 0) return null;
  const stateBadge = (c: EffectiveConsent) => {
    if (c.state === "revoked") return { tone: "danger" as BadgeTone, key: "consentRevoked" as ProfileKey };
    if (c.state === "expired_age_16") return { tone: "warn" as BadgeTone, key: "consentExpired" as ProfileKey };
    return { tone: "success" as BadgeTone, key: "consentValid" as ProfileKey };
  };
  return (
    <Card>
      <CardHeader eyebrow={tp("consentEyebrow")} title={tp("consentTitle")} />
      <ul className="grid list-none gap-2">
        {consents.map((c) => {
          const b = stateBadge(c);
          return (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2 last:border-0">
              <span className="inline-flex items-center gap-2 text-[14px] text-ink">
                <Icon name="shield" className="ic h-4 w-4 text-ink-faint" />
                {tp(CONSENT_PURPOSE[c.purpose] ?? "cpTerms")}
              </span>
              <span className="flex items-center gap-1.5">
                {c.granted_by_guardian && <Badge tone="neutral">{tp("consentByGuardian")}</Badge>}
                <Badge tone={b.tone}>{tp(b.key)}</Badge>
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ---------------------------------- Galerie ---------------------------------- */

export function GalleryCard({ photos }: { photos: MemberProfile["photos"] }) {
  const tp = useT(profileDict) as PT;
  if (!photos || photos.length === 0) return null;
  return (
    <Card>
      <CardHeader eyebrow={tp("galleryEyebrow")} title={tp("galleryTitle")} />
      <ul className="grid list-none grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((p) => (
          <li key={p.tag_id} className="grid gap-1.5">
            <div className="aspect-[4/3] overflow-hidden rounded-lg border border-line bg-sunken">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.storage_key}
                alt={p.title}
                className="h-full w-full object-cover"
                decoding="async"
              />
            </div>
            <span className="truncate text-caption text-ink-soft">{p.title}</span>
            {p.album && (
              <span className="truncate text-[11px] text-ink-faint">
                {tp("photoIn", { album: p.album })}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
