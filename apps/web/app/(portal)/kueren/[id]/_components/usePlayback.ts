"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Simulierte Wiedergabe für den Trainings-Player — es gibt KEINE echte
 * Audiodatei. Ein requestAnimationFrame-Timer bewegt die Position,
 * Tempo skaliert die Laufgeschwindigkeit, der A–B-Loop springt zurück.
 * prefers-reduced-motion drosselt die Playhead-Updates (Killswitch
 * für das Smoothing, DESIGN-SYSTEM §2.8).
 */

const MIN_LOOP_GAP_MS = 1_000;
const DEFAULT_LOOP_JUMP_MS = 10_000;
const REDUCED_PAINT_INTERVAL_MS = 400;

export type Playback = {
  posMs: number;
  playing: boolean;
  /** Sekunden bis zum Start (3-2-1) oder null, wenn kein Countdown läuft */
  countdownLeft: number | null;
  countdownSetting: number;
  tempo: number;
  loopOn: boolean;
  loopA: number;
  loopB: number;
  durationMs: number;
  togglePlay: () => void;
  /** Springen UND (falls pausiert) sofort abspielen — für Marker-Zeilen */
  playFrom: (ms: number) => void;
  seek: (ms: number) => void;
  skip: (deltaMs: number) => void;
  setTempoValue: (percent: number) => void;
  toggleLoop: () => void;
  setLoopPointA: () => void;
  setLoopPointB: () => void;
  setCountdownSetting: (seconds: number) => void;
};

export function usePlayback(durationMs: number): Playback {
  const [posMs, setPosMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [countdownLeft, setCountdownLeft] = useState<number | null>(null);
  const [countdownSetting, setCountdownSetting] = useState(0);
  const [tempo, setTempo] = useState(100);
  const [loopOn, setLoopOn] = useState(false);
  const [loopA, setLoopA] = useState(() => Math.round(durationMs * 0.25));
  const [loopB, setLoopB] = useState(() => Math.round(durationMs * 0.48));

  const posRef = useRef(0);
  const tempoRef = useRef(100);
  const loopRef = useRef({ on: false, a: loopA, b: loopB });
  const countdownRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const cdTimerRef = useRef<number | null>(null);
  const reducedRef = useRef(false);
  const lastPaintRef = useRef(0);

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    tempoRef.current = tempo;
  }, [tempo]);
  useEffect(() => {
    loopRef.current = { on: loopOn, a: loopA, b: loopB };
  }, [loopOn, loopA, loopB]);
  useEffect(() => {
    countdownRef.current = countdownSetting;
  }, [countdownSetting]);

  /** Pausiert Wiedergabe UND bricht einen laufenden Countdown ab. */
  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (cdTimerRef.current !== null) {
      window.clearInterval(cdTimerRef.current);
      cdTimerRef.current = null;
    }
    lastTsRef.current = null;
    setCountdownLeft(null);
    setPlaying(false);
    setPosMs(posRef.current);
  }, []);

  const start = useCallback(() => {
    if (rafRef.current !== null) return;
    if (posRef.current >= durationMs) posRef.current = 0; // vom Ende neu starten
    setPlaying(true);
    lastTsRef.current = null;

    const step = (ts: number) => {
      if (lastTsRef.current !== null) {
        const dt = ts - lastTsRef.current;
        let next = posRef.current + dt * (tempoRef.current / 100);
        const loop = loopRef.current;
        if (loop.on && loop.b > loop.a && next >= loop.b) next = loop.a;
        if (next >= durationMs) {
          posRef.current = durationMs;
          rafRef.current = null;
          lastTsRef.current = null;
          setPlaying(false);
          setPosMs(durationMs);
          return;
        }
        posRef.current = next;
        if (!reducedRef.current || ts - lastPaintRef.current > REDUCED_PAINT_INTERVAL_MS) {
          lastPaintRef.current = ts;
          setPosMs(next);
        }
      }
      lastTsRef.current = ts;
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [durationMs]);

  const togglePlay = useCallback(() => {
    if (rafRef.current !== null || cdTimerRef.current !== null) {
      stop();
      return;
    }
    if (countdownRef.current > 0) {
      let left = countdownRef.current;
      setCountdownLeft(left);
      cdTimerRef.current = window.setInterval(() => {
        left -= 1;
        if (left <= 0) {
          if (cdTimerRef.current !== null) {
            window.clearInterval(cdTimerRef.current);
            cdTimerRef.current = null;
          }
          setCountdownLeft(null);
          start();
        } else {
          setCountdownLeft(left);
        }
      }, 1_000);
    } else {
      start();
    }
  }, [start, stop]);

  const seek = useCallback(
    (ms: number) => {
      const clamped = Math.min(durationMs, Math.max(0, ms));
      posRef.current = clamped;
      lastPaintRef.current = typeof performance === "undefined" ? 0 : performance.now();
      setPosMs(clamped);
    },
    [durationMs],
  );

  const skip = useCallback((deltaMs: number) => seek(posRef.current + deltaMs), [seek]);

  const playFrom = useCallback(
    (ms: number) => {
      seek(ms);
      if (rafRef.current === null && cdTimerRef.current === null) start();
    },
    [seek, start],
  );

  const setTempoValue = useCallback((percent: number) => {
    setTempo(Math.min(200, Math.max(50, Math.round(percent))));
  }, []);

  const toggleLoop = useCallback(() => setLoopOn((on) => !on), []);

  /** A auf aktuelle Position; B rückt nach, wenn die Reihenfolge kippen würde. */
  const setLoopPointA = useCallback(() => {
    const a = Math.max(0, Math.min(Math.round(posRef.current), durationMs - MIN_LOOP_GAP_MS));
    setLoopA(a);
    setLoopB((b) => (b < a + MIN_LOOP_GAP_MS ? Math.min(durationMs, a + DEFAULT_LOOP_JUMP_MS) : b));
  }, [durationMs]);

  const setLoopPointB = useCallback(() => {
    const b = Math.min(durationMs, Math.max(Math.round(posRef.current), MIN_LOOP_GAP_MS));
    setLoopB(b);
    setLoopA((a) => (a > b - MIN_LOOP_GAP_MS ? Math.max(0, b - DEFAULT_LOOP_JUMP_MS) : a));
  }, [durationMs]);

  /* Aufräumen beim Verlassen der Seite */
  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (cdTimerRef.current !== null) window.clearInterval(cdTimerRef.current);
    },
    [],
  );

  return {
    posMs,
    playing,
    countdownLeft,
    countdownSetting,
    tempo,
    loopOn,
    loopA,
    loopB,
    durationMs,
    togglePlay,
    playFrom,
    seek,
    skip,
    setTempoValue,
    toggleLoop,
    setLoopPointA,
    setLoopPointB,
    setCountdownSetting,
  };
}
