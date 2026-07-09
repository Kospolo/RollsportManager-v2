import type { Routine } from "@/lib/types";
import { club } from "./club";
import { dateFromNow } from "./util";
import { waveformPeaks } from "./util";

const c = club.id;

/**
 * 6 Küren mit Musik-Metadaten, statischen Waveform-Peaks (seeded,
 * deterministisch) und Zeitmarken mit RollArt-Kürzeln.
 * Score-Historie: der Trend ist der motivierende Wert.
 */
export const routines: Routine[] = [
  {
    id: "r-01", clubId: c, title: "Feuervogel", status: "competition",
    memberIds: ["m-16"], teamId: "t-03", category: "Jugend Kür A",
    music: { title: "L'Oiseau de feu (Finale)", artist: "Igor Strawinsky", durationMs: 150_000, bpm: 92 },
    waveformPeaks: waveformPeaks(101),
    markers: [
      { id: "r-01-m1", timeMs: 12_400, label: "Eröffnung Feld", elementCode: "StSq" },
      { id: "r-01-m2", timeMs: 38_200, label: "Doppelsalchow", elementCode: "2S" },
      { id: "r-01-m3", timeMs: 64_800, label: "Sitzpirouette", elementCode: "SSp" },
      { id: "r-01-m4", timeMs: 96_500, label: "Kombination Toeloop", elementCode: "2T+1Lo" },
      { id: "r-01-m5", timeMs: 132_000, label: "Schlusspirouette", elementCode: "CoSp" },
    ],
    scores: [
      { id: "r-01-s1", date: dateFromNow(-140), technical: 21.4, components: 19.15, total: 40.55 },
      { id: "r-01-s2", date: dateFromNow(-70), technical: 22.6, components: 20.2, total: 42.8 },
      { id: "r-01-s3", date: dateFromNow(-21), competitionId: "c-02", technical: 23.3, components: 20.8, total: 44.1 },
    ],
  },
  {
    id: "r-02", clubId: c, title: "Mondlicht", status: "competition",
    memberIds: ["m-18"], teamId: "t-03", category: "Junioren Kür",
    music: { title: "Clair de Lune", artist: "Claude Debussy", durationMs: 165_000, bpm: 66 },
    waveformPeaks: waveformPeaks(202),
    markers: [
      { id: "r-02-m1", timeMs: 18_000, label: "Einlauf Diagonale" },
      { id: "r-02-m2", timeMs: 47_500, label: "Doppelrittberger", elementCode: "2Lo" },
      { id: "r-02-m3", timeMs: 88_300, label: "Waagepirouette", elementCode: "CSp" },
      { id: "r-02-m4", timeMs: 141_700, label: "Schrittfolge Finale", elementCode: "StSq" },
    ],
    scores: [
      { id: "r-02-s1", date: dateFromNow(-70), technical: 25.1, components: 23.4, total: 48.5 },
      { id: "r-02-s2", date: dateFromNow(-21), competitionId: "c-02", technical: 24.6, components: 24.15, total: 48.75 },
    ],
  },
  {
    id: "r-03", clubId: c, title: "Sommerregen", status: "ready",
    memberIds: ["m-17"], teamId: "t-03", category: "Jugend Kür B",
    music: { title: "Riders on the Storm (Instrumental)", artist: "The Doors", durationMs: 138_000, bpm: 104 },
    waveformPeaks: waveformPeaks(303),
    markers: [
      { id: "r-03-m1", timeMs: 9_800, label: "Auftakt Regentropfen" },
      { id: "r-03-m2", timeMs: 42_100, label: "Einfacher Axel", elementCode: "1A" },
      { id: "r-03-m3", timeMs: 75_400, label: "Sitzpirouette", elementCode: "SSp" },
      { id: "r-03-m4", timeMs: 118_900, label: "Schlussdrehung" },
    ],
    scores: [
      { id: "r-03-s1", date: dateFromNow(-21), competitionId: "c-02", technical: 18.9, components: 17.65, total: 36.55 },
    ],
  },
  {
    id: "r-04", clubId: c, title: "Tanz der Funken", status: "ready",
    memberIds: ["m-21", "m-22"], teamId: "t-03", category: "Paarlauf Nachwuchs",
    music: { title: "Danse Macabre", artist: "Camille Saint-Saëns", durationMs: 172_000, bpm: 112 },
    waveformPeaks: waveformPeaks(404),
    markers: [
      { id: "r-04-m1", timeMs: 15_600, label: "Synchronstart" },
      { id: "r-04-m2", timeMs: 58_000, label: "Schattenlauf", elementCode: "StSq" },
      { id: "r-04-m3", timeMs: 104_200, label: "Parallelpirouette", elementCode: "PSp" },
      { id: "r-04-m4", timeMs: 155_500, label: "Hebefigur Finale" },
    ],
    scores: [],
  },
  {
    id: "r-05", clubId: c, title: "Kleine Welle", status: "draft",
    memberIds: ["m-07"], teamId: "t-02", category: "Schüler Pflichtkür",
    music: { title: "Die Moldau (Ausschnitt)", artist: "Bedřich Smetana", durationMs: 120_000, bpm: 80 },
    waveformPeaks: waveformPeaks(505),
    markers: [
      { id: "r-05-m1", timeMs: 22_000, label: "Erster Bogenlauf" },
      { id: "r-05-m2", timeMs: 61_500, label: "Einfacher Salchow", elementCode: "1S" },
    ],
    scores: [],
  },
  {
    id: "r-06", clubId: c, title: "Nordwind", status: "archived",
    memberIds: ["m-23"], teamId: "t-03", category: "Junioren Kür (Saison 2025)",
    music: { title: "Storm", artist: "Antonio Vivaldi / Neuarrangement", durationMs: 158_000, bpm: 120 },
    waveformPeaks: waveformPeaks(606),
    markers: [
      { id: "r-06-m1", timeMs: 11_000, label: "Sturmauftakt" },
      { id: "r-06-m2", timeMs: 49_300, label: "Doppelflip", elementCode: "2F" },
      { id: "r-06-m3", timeMs: 127_800, label: "Schlusspose" },
    ],
    scores: [
      { id: "r-06-s1", date: dateFromNow(-320), technical: 26.2, components: 24.9, total: 51.1 },
      { id: "r-06-s2", date: dateFromNow(-250), technical: 27.0, components: 25.3, total: 52.3 },
    ],
  },
];

export function routineById(id: string): Routine | undefined {
  return routines.find((r) => r.id === id);
}
