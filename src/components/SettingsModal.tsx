import { useEffect, useState } from "react";
import { Info, X } from "lucide-react";
import { cx } from "../ui";

// §9 — settings modal. Label left, control right, uppercase muted section heads.
const SECTIONS = [
  {
    head: "Signal Filters",
    rows: [{ label: "Previous Candle Direction", kind: "select", value: "Same Direction", options: ["Any", "Same Direction"], info: true }],
  },
  {
    head: "EMA Trend Filter",
    rows: [
      { label: "Use & Show EMA Trend Filter", kind: "check", value: true, info: true },
      { label: "EMA Length", kind: "number", value: "200" },
    ],
  },
  {
    head: "Risk Management",
    rows: [
      { label: "Stop Loss Method", kind: "select", value: "ATR", options: ["ATR", "Candle High/Low"], info: true },
      { label: "ATR Length", kind: "number", value: "14" },
      { label: "ATR Multiplier", kind: "number", value: "5" },
      { label: "Risk/Reward Ratio", kind: "number", value: "1.5" },
    ],
  },
] as const;

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"Inputs" | "Properties">("Inputs");

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center" style={{ background: "var(--scrim)" }} onClick={onClose}>
      <div
        role="dialog"
        aria-label="Strategy settings"
        data-apollo-id="settings-modal"
        onClick={(e) => e.stopPropagation()}
        className="w-[340px] rounded-[10px] border border-border bg-bg-panel p-5"
      >
        <div className="flex items-start justify-between">
          <h2 className="text-[15px] font-medium">Sweep and Engulf Strategy</h2>
          <button data-apollo-id="settings-close" aria-label="Close" onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={15} />
          </button>
        </div>

        <nav className="mt-3 flex gap-4 border-b border-border" role="tablist">
          {(["Inputs", "Properties"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              data-apollo-id={`settings-tab-${t.toLowerCase()}`}
              onClick={() => setTab(t)}
              className={cx(
                "-mb-px border-b-2 pb-2 text-[13px] font-medium",
                tab === t ? "border-text-primary text-text-secondary" : "border-transparent text-text-muted",
              )}
            >
              {t}
            </button>
          ))}
        </nav>

        {tab === "Inputs" ? (
          <div className="max-h-[52vh] overflow-y-auto pt-4">
            {SECTIONS.map((s) => (
              <section key={s.head} className="mb-5">
                <h3 className="mb-3 text-[10px] font-medium tracking-[0.06em] text-text-muted uppercase">{s.head}</h3>
                {s.rows.map((r) => (
                  <div key={r.label} className="mb-3 flex items-center gap-2">
                    {r.kind === "check" ? (
                      <>
                        <input type="checkbox" defaultChecked={r.value as boolean} className="size-4 accent-accent" />
                        <span className="text-[13px]">{r.label}</span>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-[13px]">{r.label}</span>
                        {r.kind === "select" ? (
                          <select
                            defaultValue={r.value as string}
                            className="h-8 w-[110px] truncate rounded-md bg-bg-elevated px-2 text-[13px] focus:outline-none"
                          >
                            {(r.options as readonly string[]).map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            defaultValue={r.value as string}
                            className="tnum h-8 w-[110px] rounded-md bg-bg-elevated px-2 text-[13px] focus:outline-none"
                          />
                        )}
                      </>
                    )}
                    {"info" in r && r.info && <Info size={13} className="text-text-muted" />}
                  </div>
                ))}
              </section>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-[13px] text-text-muted">
            Order size, slippage and commission. Not modelled in this run.
          </div>
        )}

        <footer className="flex justify-end gap-2 border-t border-border pt-3">
          <button data-apollo-id="settings-cancel" onClick={onClose} className="h-8 rounded-md px-3 text-[13px] text-text-muted hover:text-text-primary">
            Cancel
          </button>
          <button data-apollo-id="settings-ok" onClick={onClose} className="h-8 rounded-md bg-bg-elevated px-4 text-[13px]">
            Ok
          </button>
        </footer>
      </div>
    </div>
  );
}
