"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Trainings-Player-Wiedergabe.
 *
 * MIT echter Audiodatei (`audioSrc` gesetzt): steuert ein echtes
 * HTMLAudioElement — Position/Dauer kommen aus der Datei, Tempo ist
 * `playbackRate` (Tonhöhe bleibt erhalten, `preservesPitch`), der A–B-Loop
 * springt auf der echten Zeit zurück. So spielt der Player oben dieselbe Musik
 * wie die Vorschau unten, nur mit Tempo/Loop/Markern.
 *
 * OHNE Audiodatei (Fallback, z. B. Demo-Seed mit Metadaten aber ohne Bytes):
 * ein requestAnimationFrame-Timer simuliert die Position über `durationMs`.
 *
 * prefers-reduced-motion drosselt die Playhead-Updates (DESIGN-SYSTEM §2.8).
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

/** `preservesPitch` ist noch nicht in allen lib.dom-Versionen typisiert. */
type PitchAudio = HTMLAudioElement & {
  preservesPitch?: boolean;
  mozPreservesPitch?: boolean;
  webkitPreservesPitch?: boolean;
};

export function usePlayback(durationMs: number, audioSrc?: string | null): Playback {
  const [posMs, setPosMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [countdownLeft, setCountdownLeft] = useState<number | null>(null);
  const [countdownSetting, setCountdownSetting] = useState(0);
  const [tempo, setTempo] = useState(100);
  const [loopOn, setLoopOn] = useState(false);
  const [loopA, setLoopA] = useState(0);
  const [loopB, setLoopB] = useState(0);
  /** Echte Dauer aus der Audiodatei (ms); 0, solange nicht geladen. */
  const [realDurationMs, setRealDurationMs] = useState(0);

  // Effektive Dauer: die echte Audiodauer gewinnt, sobald bekannt; sonst der
  // (evtl. 0-)Metadaten-Wert. So steht der Player nicht auf 0:00, wenn beim
  // Anlegen keine Dauer gesetzt wurde — sie kommt aus der Datei.
  const effectiveDuration = realDurationMs > 0 ? realDurationMs : durationMs;
  const durationRef = useRef(effectiveDuration);
  useEffect(() => {
    durationRef.current = effectiveDuration;
  }, [effectiveDuration]);

  const posRef = useRef(0);
  const tempoRef = useRef(100);
  const loopRef = useRef({ on: false, a: loopA, b: loopB });
  const countdownRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const cdTimerRef = useRef<number | null>(null);
  const reducedRef = useRef(false);
  const lastPaintRef = useRef(0);
  const audioRef = useRef<PitchAudio | null>(null);

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    tempoRef.current = tempo;
    if (audioRef.current) audioRef.current.playbackRate = tempo / 100;
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
    if (audioRef.current) audioRef.current.pause();
    lastTsRef.current = null;
    setCountdownLeft(null);
    setPlaying(false);
    setPosMs(posRef.current);
  }, []);

  const start = useCallback(() => {
    if (rafRef.current !== null) return;
    const duration = durationRef.current;
    const audio = audioRef.current;
    if (posRef.current >= duration && duration > 0) posRef.current = 0; // vom Ende neu starten
    setPlaying(true);
    lastTsRef.current = null;

    if (audio) {
      // ECHTE Wiedergabe: das Audio-Element ist die Wahrheit.
      audio.playbackRate = tempoRef.current / 100;
      audio.currentTime = posRef.current / 1000;
      void audio.play().catch(() => {
        // Autoplay/Interaktions-Sperre o. Ä. — sauber pausieren statt zu hängen.
        stop();
      });
      const step = (ts: number) => {
        const el = audioRef.current;
        if (!el) {
          rafRef.current = null;
          return;
        }
        let next = el.currentTime * 1000;
        const loop = loopRef.current;
        if (loop.on && loop.b > loop.a && next >= loop.b) {
          next = loop.a;
          el.currentTime = loop.a / 1000;
        }
        posRef.current = next;
        if (el.ended || (durationRef.current > 0 && next >= durationRef.current)) {
          posRef.current = durationRef.current;
          rafRef.current = null;
          lastTsRef.current = null;
          el.pause();
          setPlaying(false);
          setPosMs(durationRef.current);
          return;
        }
        if (!reducedRef.current || ts - lastPaintRef.current > REDUCED_PAINT_INTERVAL_MS) {
          lastPaintRef.current = ts;
          setPosMs(next);
        }
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
      return;
    }

    // FALLBACK ohne Audiodatei: simulierte Position über die Zeit.
    const step = (ts: number) => {
      if (lastTsRef.current !== null) {
        const dt = ts - lastTsRef.current;
        let next = posRef.current + dt * (tempoRef.current / 100);
        const loop = loopRef.current;
        if (loop.on && loop.b > loop.a && next >= loop.b) next = loop.a;
        if (durationRef.current > 0 && next >= durationRef.current) {
          posRef.current = durationRef.current;
          rafRef.current = null;
          lastTsRef.current = null;
          setPlaying(false);
          setPosMs(durationRef.current);
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
  }, [stop]);

  // Audio-Element an-/abhängen, wenn sich die Quelle ändert. loadedmetadata
  // liefert die echte Dauer; 'ended' beendet die Wiedergabe sauber.
  useEffect(() => {
    if (!audioSrc) {
      audioRef.current = null;
      setRealDurationMs(0);
      return;
    }
    const el = new Audio(audioSrc) as PitchAudio;
    el.preload = "metadata";
    el.preservesPitch = true;
    el.mozPreservesPitch = true;
    el.webkitPreservesPitch = true;
    el.playbackRate = tempoRef.current / 100;
    const onMeta = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) {
        setRealDurationMs(Math.round(el.duration * 1000));
      }
    };
    el.addEventListener("loadedmetadata", onMeta);
    audioRef.current = el;
    if (Number.isFinite(el.duration) && el.duration > 0) onMeta();
    return () => {
      el.pause();
      el.removeEventListener("loadedmetadata", onMeta);
      el.src = "";
      if (audioRef.current === el) audioRef.current = null;
    };
    // start/stop bewusst NICHT als Dep: ein Quellwechsel setzt nur das Element neu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioSrc]);

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

  const seek = useCallback((ms: number) => {
    const clamped = Math.min(durationRef.current, Math.max(0, ms));
    posRef.current = clamped;
    if (audioRef.current) audioRef.current.currentTime = clamped / 1000;
    lastPaintRef.current = typeof performance === "undefined" ? 0 : performance.now();
    setPosMs(clamped);
  }, []);

  const skip = useCallback((deltaMs: number) => seek(posRef.current + deltaMs), [seek]);

  const playFrom = useCallback(
    (ms: number) => {
      seek(ms);
      if (rafRef.current === null && cdTimerRef.current === null) start();
    },
    [seek, start],
  );

  const setTempoValue = useCallback((percent: number) => {
    const clamped = Math.min(200, Math.max(50, Math.round(percent)));
    setTempo(clamped);
    if (audioRef.current) audioRef.current.playbackRate = clamped / 100;
  }, []);

  const toggleLoop = useCallback(() => setLoopOn((on) => !on), []);

  /** A auf aktuelle Position; B rückt nach, wenn die Reihenfolge kippen würde. */
  const setLoopPointA = useCallback(() => {
    const duration = durationRef.current;
    const a = Math.max(0, Math.min(Math.round(posRef.current), duration - MIN_LOOP_GAP_MS));
    setLoopA(a);
    setLoopB((b) => (b < a + MIN_LOOP_GAP_MS ? Math.min(duration, a + DEFAULT_LOOP_JUMP_MS) : b));
  }, []);

  const setLoopPointB = useCallback(() => {
    const duration = durationRef.current;
    const b = Math.min(duration, Math.max(Math.round(posRef.current), MIN_LOOP_GAP_MS));
    setLoopB(b);
    setLoopA((a) => (a > b - MIN_LOOP_GAP_MS ? Math.max(0, b - DEFAULT_LOOP_JUMP_MS) : a));
  }, []);

  /* Aufräumen beim Verlassen der Seite */
  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (cdTimerRef.current !== null) window.clearInterval(cdTimerRef.current);
      if (audioRef.current) audioRef.current.pause();
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
    durationMs: effectiveDuration,
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
