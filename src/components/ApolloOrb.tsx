import { useEffect, useRef, useState } from "react";
import { cx } from "../ui";
import type { ApolloState } from "./useApollo";

/**
 * Apollo — the ever-present assistant. A small floating sphere that breathes at
 * rest and pulses with audio while listening or speaking.
 *
 * Every motion constant lives in MOTION below so the feel can be retuned in one
 * place. Rendering is layered radial gradients on a canvas-free stack: no WebGL,
 * no animation library, and it degrades to a static sphere under
 * prefers-reduced-motion.
 */

const MOTION: Record<ApolloState, { base: number; gain: number; period: number; ringOpacity: number }> = {
  // base   resting scale
  // gain   how much audio amplitude grows it
  // period breathing cycle, ms — lower is faster
  // ringOpacity  strength of the emitted halo
  idle: { base: 1, gain: 0, period: 4200, ringOpacity: 0.16 },
  listening: { base: 1.02, gain: 0.16, period: 2600, ringOpacity: 0.34 },
  thinking: { base: 0.97, gain: 0, period: 1150, ringOpacity: 0.22 },
  speaking: { base: 1.04, gain: 0.2, period: 1700, ringOpacity: 0.42 },
};

const SIZE = 46;

export default function ApolloOrb({
  state,
  level,
  onClick,
  label,
}: {
  state: ApolloState;
  level: number;
  onClick?: () => void;
  label?: string | null;
}) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);
  const smoothed = useRef(0);

  // One rAF loop drives the whole thing: a slow sine for the resting breath,
  // plus a smoothed audio term so the pulse tracks speech without jittering.
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const tick = (t: number) => {
      const m = MOTION[state];
      smoothed.current += (level - smoothed.current) * 0.22;
      const breath = Math.sin((t / m.period) * Math.PI * 2) * 0.035;
      setScale(m.base + breath + smoothed.current * m.gain);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, level]);

  // Drag to reposition. A drag must not fire the click.
  useEffect(() => {
    if (!drag.current) return;
    const move = (e: PointerEvent) => {
      if (!drag.current) return;
      drag.current.moved = true;
      setPos({
        x: Math.min(Math.max(e.clientX - drag.current.dx, 8), innerWidth - SIZE - 8),
        y: Math.min(Math.max(e.clientY - drag.current.dy, 8), innerHeight - SIZE - 8),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setTimeout(() => (drag.current = null), 0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  });

  const m = MOTION[state];
  const active = state !== "idle";

  return (
    <div
      className="fixed z-40 select-none"
      style={pos ? { left: pos.x, top: pos.y } : { right: 26, bottom: 26 }}
      data-apollo-id="apollo-orb"
      data-apollo-state={state}
    >
      {label && (
        <div className="absolute right-0 bottom-full mb-2 w-max max-w-[220px] rounded-lg border border-border bg-bg-elevated px-2.5 py-1.5 text-[11px] text-text-muted shadow-lg">
          {label}
        </div>
      )}

      <button
        aria-label={`Apollo — ${state}`}
        title="Apollo"
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false };
        }}
        onClick={() => {
          if (drag.current?.moved) return;
          onClick?.();
        }}
        className="relative grid cursor-grab place-items-center active:cursor-grabbing"
        style={{ width: SIZE, height: SIZE }}
      >
        {/* Halo — sits behind the sphere and swells with it. */}
        <span
          aria-hidden
          className="absolute rounded-full transition-opacity duration-500"
          style={{
            width: SIZE * 1.9,
            height: SIZE * 1.9,
            opacity: m.ringOpacity * (0.6 + scale - 1),
            background:
              "radial-gradient(circle, color-mix(in oklab, var(--color-accent) 55%, transparent) 0%, transparent 62%)",
            transform: `scale(${1 + (scale - 1) * 1.6})`,
            filter: "blur(6px)",
          }}
        />

        {/* The orb. Soft-edged and bloom-led rather than a hard-edged 3D ball:
            the reference language is a blurred boundary with no outline, deep at
            the base tapering to pale toward the top. */}
        <span
          aria-hidden
          className="relative rounded-full"
          style={{
            width: SIZE,
            height: SIZE,
            transform: `scale(${scale})`,
            background: `
              radial-gradient(circle at 50% 34%,
                color-mix(in oklab, var(--color-accent) 12%, white) 0%,
                color-mix(in oklab, var(--color-accent) 72%, white) 30%,
                var(--color-accent) 58%,
                color-mix(in oklab, var(--color-accent) 70%, black) 88%,
                transparent 100%)`,
            filter: `blur(0.6px) saturate(1.15)`,
            boxShadow: `0 0 ${16 + scale * 12}px color-mix(in oklab, var(--color-accent) 42%, transparent)`,
          }}
        />

        {/* Inner bloom — keeps the centre luminous as the orb swells, so the
            pulse reads as light rather than as a resizing disc. */}
        <span
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            width: SIZE * 0.62,
            height: SIZE * 0.62,
            transform: `scale(${1 + (scale - 1) * 2.2})`,
            background:
              "radial-gradient(circle at 50% 42%, color-mix(in oklab, white 72%, var(--color-accent)) 0%, transparent 70%)",
            opacity: 0.28 + smoothed.current * 0.5,
            filter: "blur(4px)",
          }}
        />

        {/* Thinking: a single orbiting mote, so "working" is legible without text. */}
        {state === "thinking" && (
          <span aria-hidden className="absolute inset-0 animate-spin" style={{ animationDuration: "1.5s" }}>
            <span
              className="absolute size-1.5 rounded-full bg-text-primary"
              style={{ top: -2, left: "50%", marginLeft: -3, opacity: 0.9 }}
            />
          </span>
        )}
      </button>

      <span aria-live="polite" className="sr-only">
        {active ? `Apollo is ${state}` : ""}
      </span>

      <span
        aria-hidden
        className={cx(
          "absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full transition-colors",
          state === "listening" && "bg-accent",
          state === "speaking" && "bg-profit",
          state === "thinking" && "bg-warning",
          state === "idle" && "bg-transparent",
        )}
      />
    </div>
  );
}
