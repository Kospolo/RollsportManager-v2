"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Kamera-QR-Scanner auf Basis der Browser-eigenen BarcodeDetector-API
 * (keine externe Bibliothek, Policy). Läuft als Dauerscan („Station"): ein
 * erkannter Code wird an `onDecode` gemeldet, derselbe Code aber erst nach einer
 * Sperrzeit erneut, damit ein vorgehaltener QR nicht mehrfach eincheckt.
 *
 * Fehlt BarcodeDetector oder die Kamera (Safari/Firefox u. a.), meldet
 * qrScanSupported() false — der Aufrufer zeigt dann die manuelle Eingabe.
 */

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function detectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ?? null;
}

function cameraCapable(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

/** Kann dieser Browser QR-Codes live über die Kamera scannen? */
export function qrScanSupported(): boolean {
  return detectorCtor() !== null && cameraCapable();
}

/** Nach dieser Sperrzeit (ms) darf derselbe Code erneut ausgelöst werden. */
const REPEAT_LOCK_MS = 2500;

export type ScanState = "idle" | "starting" | "scanning";
export type ScanErrorKind = "permission" | "camera" | null;

export interface QrScannerControls {
  state: ScanState;
  errorKind: ScanErrorKind;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  start: () => void;
  stop: () => void;
}

export function useQrScanner(onDecode: (value: string) => void): QrScannerControls {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const decodeRef = useRef(onDecode);
  const lastHitRef = useRef<{ value: string; at: number }>({ value: "", at: 0 });

  const [state, setState] = useState<ScanState>("idle");
  const [errorKind, setErrorKind] = useState<ScanErrorKind>(null);

  // Aktuellen Callback halten, ohne die Scan-Schleife neu zu starten.
  useEffect(() => {
    decodeRef.current = onDecode;
  }, [onDecode]);

  const stop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) video.srcObject = null;
    setState("idle");
  }, []);

  const start = useCallback(() => {
    const Ctor = detectorCtor();
    if (!Ctor || !cameraCapable()) {
      setErrorKind("camera");
      return;
    }
    setErrorKind(null);
    setState("starting");
    const detector = new Ctor({ formats: ["qr_code"] });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(async (stream) => {
        const video = videoRef.current;
        if (!video) {
          for (const track of stream.getTracks()) track.stop();
          setState("idle");
          return;
        }
        streamRef.current = stream;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        video.muted = true;
        try {
          await video.play();
        } catch {
          /* Autoplay-Restriktion ignorieren — Frames kommen trotzdem. */
        }
        lastHitRef.current = { value: "", at: 0 };
        setState("scanning");

        // Dauerscan-Schleife (lokal, self-schedulend). Bricht ab, sobald stop()
        // den Stream entfernt — auch für eine noch laufende detect()-Promise.
        const scanFrame = (): void => {
          if (!streamRef.current) return;
          const live = videoRef.current;
          if (!live || live.readyState < 2) {
            rafRef.current = requestAnimationFrame(scanFrame);
            return;
          }
          detector
            .detect(live)
            .then((codes) => {
              const raw = codes[0]?.rawValue?.trim();
              if (!raw) return;
              const now = Date.now();
              const last = lastHitRef.current;
              if (raw !== last.value || now - last.at > REPEAT_LOCK_MS) {
                lastHitRef.current = { value: raw, at: now };
                decodeRef.current(raw);
              }
            })
            .catch(() => {
              /* Einzel-Frame-Fehler ignorieren und weiter scannen. */
            })
            .finally(() => {
              if (streamRef.current) rafRef.current = requestAnimationFrame(scanFrame);
            });
        };
        rafRef.current = requestAnimationFrame(scanFrame);
      })
      .catch((err: unknown) => {
        const name = err instanceof DOMException ? err.name : "";
        setErrorKind(name === "NotAllowedError" || name === "SecurityError" ? "permission" : "camera");
        setState("idle");
      });
  }, []);

  // Beim Unmount Kamera + Schleife sauber beenden (kein Leak, Kamera-LED aus).
  useEffect(() => stop, [stop]);

  return { state, errorKind, videoRef, start, stop };
}
