import { useCallback, useEffect, useRef, useState } from "react";

// Voice input — spec §4a. Native SpeechRecognition, zero dependencies, no
// backend, no audio-handling code of our own. Dictation only: it fills the
// composer and never auto-sends.
export type DictationState = "idle" | "requesting" | "listening" | "denied" | "unsupported";

type SR = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

const Recognition: (new () => SR) | undefined =
  (globalThis as any).SpeechRecognition ?? (globalThis as any).webkitSpeechRecognition;

/** Never render a mic button that cannot work — Firefox has no SpeechRecognition. */
export const dictationSupported = Boolean(Recognition);

const SILENCE_MS = 2500;

export function useDictation(onText: (finalText: string) => void) {
  const [state, setState] = useState<DictationState>(dictationSupported ? "idle" : "unsupported");
  const [interim, setInterim] = useState("");
  const [level, setLevel] = useState<number[]>([0, 0, 0, 0, 0]);

  const recRef = useRef<SR | null>(null);
  const silence = useRef<number | undefined>(undefined);
  const audio = useRef<{ ctx: AudioContext; stream: MediaStream; raf: number } | null>(null);
  // Bumped on every teardown. getUserMedia is async, so a stop or unmount can
  // land while the permission prompt is still open — without this the late
  // continuation stores a live stream after cleanup ran and the microphone
  // stays hot with the UI showing "stopped".
  const meterToken = useRef(0);

  const teardownMeter = useCallback(() => {
    meterToken.current++;
    if (!audio.current) return;
    cancelAnimationFrame(audio.current.raf);
    audio.current.stream.getTracks().forEach((t) => t.stop());
    void audio.current.ctx.close();
    audio.current = null;
    setLevel([0, 0, 0, 0, 0]);
  }, []);

  const stop = useCallback(() => {
    window.clearTimeout(silence.current);
    recRef.current?.stop();
    recRef.current = null;
    teardownMeter();
    setInterim("");
    setState("idle");
  }, [teardownMeter]);

  // Amplitude meter — decorative, aria-hidden. Drives the 5 bars in the composer.
  const startMeter = useCallback(async () => {
    const token = ++meterToken.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stopped while the prompt was open — release the device immediately.
      if (token !== meterToken.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += (v - 128) ** 2;
        const rms = Math.min(1, Math.sqrt(sum / buf.length) / 40);
        setLevel((prev) => [rms, ...prev.slice(0, 4)]);
        if (audio.current) audio.current.raf = requestAnimationFrame(tick);
      };
      audio.current = { ctx, stream, raf: requestAnimationFrame(tick) };
    } catch {
      /* meter is optional; recognition still runs */
    }
  }, []);

  const start = useCallback(() => {
    if (!Recognition) return;
    setState("requesting");
    const rec = new Recognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";

    rec.onresult = (e: any) => {
      setState("listening");
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) onText(r[0].transcript.trim() + " ");
        else live += r[0].transcript;
      }
      setInterim(live);
      window.clearTimeout(silence.current);
      silence.current = window.setTimeout(stop, SILENCE_MS);
    };
    rec.onerror = (e: any) => {
      setState(e?.error === "not-allowed" || e?.error === "service-not-allowed" ? "denied" : "idle");
      teardownMeter();
    };
    rec.onend = () => {
      teardownMeter();
      setState((s) => (s === "denied" ? s : "idle"));
    };

    recRef.current = rec;
    rec.start();
    setState("listening");
    void startMeter();
  }, [onText, startMeter, stop, teardownMeter]);

  useEffect(() => () => stop(), [stop]);

  return { state, interim, level, start, stop, toggle: () => (state === "listening" ? stop() : start()) };
}
