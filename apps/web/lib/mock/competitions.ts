import type { Competition, Task } from "@/lib/types";
import { club } from "./club";
import { daysFromNow, dateFromNow } from "./util";

const c = club.id;

/** 2 Wettkämpfe: die Bezirksmeisterschaft in 9 Tagen + der Kreispokal vor 3 Wochen. */
export const competitions: Competition[] = [
  {
    id: "c-01", clubId: c,
    name: "Bezirksmeisterschaft Rollkunstlauf",
    location: "Rundsporthalle Ludwigsburg",
    startsAt: daysFromNow(9, 8, 30), endsAt: daysFromNow(9, 18, 0),
    registrationDeadline: dateFromNow(2),
    status: "upcoming",
    participantIds: ["m-07", "m-10", "m-16", "m-17", "m-18", "m-21", "m-22", "m-23"],
    routineIds: ["r-01", "r-02", "r-03", "r-04"],
  },
  {
    id: "c-02", clubId: c,
    name: "Kreispokal Heilbronn",
    location: "Römerhalle Bad Wimpfen",
    startsAt: daysFromNow(-21, 9, 0), endsAt: daysFromNow(-21, 17, 30),
    status: "done",
    participantIds: ["m-16", "m-17", "m-18"],
    routineIds: ["r-01", "r-02", "r-03"],
  },
];

/** Aufgabenliste — teils an die Bezirksmeisterschaft geknüpft. */
export const tasks: Task[] = [
  { id: "task-01", clubId: c, title: "Meldeliste an den Ausrichter senden", done: false, dueAt: dateFromNow(2), assigneeId: "m-01", competitionId: "c-01" },
  { id: "task-02", clubId: c, title: "Fahrgemeinschaften für Ludwigsburg einteilen", done: false, dueAt: dateFromNow(6), assigneeId: "m-04", competitionId: "c-01" },
  { id: "task-03", clubId: c, title: "Musik-Sticks prüfen und beschriften", done: false, dueAt: dateFromNow(7), assigneeId: "m-01", competitionId: "c-01" },
  { id: "task-04", clubId: c, title: "Hallenmiete Q3 überweisen", done: false, dueAt: dateFromNow(12), assigneeId: "m-03" },
  { id: "task-05", clubId: c, title: "Kuchenliste fürs Sommerfest anlegen", done: false, dueAt: dateFromNow(16), assigneeId: "m-09" },
  { id: "task-06", clubId: c, title: "Wettkampfkleidung inventarisieren", done: true, assigneeId: "m-05" },
  { id: "task-07", clubId: c, title: "Urkunden vom Kreispokal einscannen", done: true, assigneeId: "m-04", competitionId: "c-02" },
];

export const openTasks = tasks.filter((t) => !t.done);
