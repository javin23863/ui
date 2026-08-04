import type { ReactNode } from "react";

export const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(" ");

/** Signed money/number. Colour is never the only carrier — the sign always renders (§2c). */
export function Signed({ value, unit, digits = 2 }: { value: number; unit?: string; digits?: number }) {
  const tone = value > 0 ? "text-profit" : value < 0 ? "text-loss" : "text-text-primary";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return (
    <span className={cx(tone, "tnum")}>
      {sign}
      {Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}
      {unit && <span className="ml-1 text-[11px] text-text-muted">{unit}</span>}
    </span>
  );
}

export function Chip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "profit" | "loss" | "accent" | "warning";
}) {
  const tones = {
    neutral: "bg-bg-elevated text-text-muted",
    profit: "bg-profit/18 text-profit",
    loss: "bg-loss/18 text-loss",
    accent: "bg-accent/18 text-accent",
    warning: "bg-warning/18 text-warning",
  };
  return <span className={cx("rounded px-1.5 py-0.5 text-[10px] leading-4 font-medium", tones[tone])}>{children}</span>;
}

/** A panel that refuses. §8c's design rule: every panel must be able to say no. */
export function Refusal({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-30 items-center justify-center px-6 text-center text-[13px] text-text-muted">
      {children}
    </div>
  );
}

export function Card({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-bg-panel p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-medium text-text-primary">{title}</h3>
        {right}
      </header>
      {children}
    </section>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-2 flex items-center gap-4">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-[11px] text-text-muted">
          <span className="size-2 rounded-[2px]" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function KpiStrip({
  items,
}: {
  items: { label: string; value: ReactNode; sub?: string }[];
}) {
  return (
    <div className="grid border-t border-border" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map((k) => (
        <div key={k.label} className="px-4 py-3">
          <div className="text-[10px] font-medium tracking-[0.06em] text-text-muted uppercase">{k.label}</div>
          <div className="mt-1 text-[14px] font-medium">
            {k.value}
            {k.sub && <span className="ml-1.5 text-[11px] text-text-muted">{k.sub}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
