import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Chip, cx, Signed } from "../ui";
import { trades, type Trade } from "../fixtures/market";

// §8d — OUR tab. Gross / Costs / Net are three separate columns on purpose;
// the reference collapses cost into nothing at all.
const COLS: { key: keyof Trade | "spacer"; label: string; align?: "right"; frozen?: boolean }[] = [
  { key: "n", label: "#", frozen: true },
  { key: "side", label: "Side", frozen: true },
  { key: "entryTime", label: "Entry" },
  { key: "exitTime", label: "Exit" },
  { key: "bars", label: "Bars", align: "right" },
  { key: "qty", label: "Qty", align: "right" },
  { key: "entryPx", label: "Entry px", align: "right" },
  { key: "exitPx", label: "Exit px", align: "right" },
  { key: "gross", label: "Gross", align: "right" },
  { key: "costs", label: "Costs", align: "right" },
  { key: "net", label: "Net", align: "right", frozen: true },
  { key: "r", label: "R", align: "right" },
  { key: "mae", label: "MAE", align: "right" },
  { key: "mfe", label: "MFE", align: "right" },
  { key: "cum", label: "Cum. net", align: "right" },
  { key: "regime", label: "Regime" },
  { key: "sample", label: "Sample" },
];

const dt = (t: number) =>
  new Date(t * 1000).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

export default function TradesLog({
  costsModelled = true,
  regimesTagged = true,
  onShowOnChart,
}: {
  costsModelled?: boolean;
  /** §11: an untagged run shows `—` in Regime here, not a guessed label. */
  regimesTagged?: boolean;
  onShowOnChart?: (t: Trade) => void;
}) {
  const [side, setSide] = useState<"All" | "Long" | "Short">("All");
  const [sample, setSample] = useState<"All" | "IS" | "OOS">("All");
  const [sort, setSort] = useState<{ key: keyof Trade; dir: 1 | -1 }>({ key: "n", dir: 1 });

  const rows = useMemo(() => {
    const f = trades.filter((t) => (side === "All" || t.side === side) && (sample === "All" || t.sample === sample));
    return [...f].sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
    });
  }, [side, sample, sort]);

  const tot = rows.reduce(
    (s, t) => ({ gross: s.gross + t.gross, costs: s.costs + (t.costs ?? 0), net: s.net + t.net }),
    { gross: 0, costs: 0, net: 0 },
  );

  const exportCsv = () => {
    const head = COLS.map((c) => c.label).join(",");
    const body = rows.map((r) => COLS.map((c) => String(r[c.key as keyof Trade] ?? "")).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`${head}\n${body}`], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "trades.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const Filter = <T extends string>(opts: readonly T[], v: T, set: (t: T) => void, id: string) => (
    <div className="flex gap-1">
      {opts.map((o) => (
        <button
          key={o}
          data-apollo-id={`${id}-${o.toLowerCase()}`}
          onClick={() => set(o)}
          className={cx("rounded px-2 py-0.5 text-[11px]", v === o ? "bg-bg-elevated text-text-primary" : "text-text-muted hover:text-text-primary")}
        >
          {o}
        </button>
      ))}
    </div>
  );

  return (
    <div className="pt-4">
      <div className="mb-2 flex items-center gap-4">
        {Filter(["All", "Long", "Short"] as const, side, setSide, "log-side")}
        <span className="h-4 w-px bg-border" />
        {Filter(["All", "IS", "OOS"] as const, sample, setSample, "log-sample")}
        <button
          data-apollo-id="export-csv"
          onClick={exportCsv}
          className="ml-auto flex h-8 items-center gap-1.5 rounded-md bg-bg-panel px-3 text-[13px] hover:bg-bg-hover"
        >
          <Download size={13} /> Export CSV
        </button>
      </div>

      {!costsModelled && (
        <p className="mb-2 rounded-md bg-bg-elevated px-3 py-2 text-[11px] text-text-muted">
          Costs not modelled — Net equals Gross.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[1180px] text-[12px]" data-apollo-id="trades-log">
          <thead className="sticky top-0 bg-bg-panel">
            <tr className="text-text-muted">
              {COLS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => setSort((s) => ({ key: c.key as keyof Trade, dir: s.key === c.key && s.dir === 1 ? -1 : 1 }))}
                  className={cx(
                    "cursor-pointer border-b border-border px-2.5 py-2 font-normal whitespace-nowrap select-none hover:text-text-primary",
                    c.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {c.label}
                  {sort.key === c.key && <span className="ml-1">{sort.dir === 1 ? "↑" : "↓"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr
                key={t.n}
                onClick={() => onShowOnChart?.(t)}
                title="Show this trade on the chart"
                className="cursor-pointer border-b border-border last:border-0 hover:bg-bg-hover"
              >
                <td className="px-2.5 py-1.5 text-text-muted">{t.n}</td>
                <td className="px-2.5 py-1.5">
                  <Chip tone={t.side === "Long" ? "profit" : "loss"}>{t.side}</Chip>
                </td>
                <td className="px-2.5 py-1.5 whitespace-nowrap text-text-muted">{dt(t.entryTime)}</td>
                <td className="px-2.5 py-1.5 whitespace-nowrap text-text-muted">{dt(t.exitTime)}</td>
                <td className="tnum px-2.5 py-1.5 text-right">{t.bars}</td>
                <td className="tnum px-2.5 py-1.5 text-right">{t.qty}</td>
                <td className="tnum px-2.5 py-1.5 text-right">{t.entryPx.toFixed(2)}</td>
                <td className="tnum px-2.5 py-1.5 text-right">{t.exitPx.toFixed(2)}</td>
                <td className="tnum px-2.5 py-1.5 text-right">
                  <Signed value={t.gross} />
                </td>
                <td className="tnum px-2.5 py-1.5 text-right text-loss">
                  {costsModelled && t.costs !== null ? t.costs.toFixed(2) : "—"}
                </td>
                <td className="tnum px-2.5 py-1.5 text-right font-medium">
                  <Signed value={costsModelled ? t.net : t.gross} />
                </td>
                <td className="tnum px-2.5 py-1.5 text-right">
                  <Signed value={t.r} />
                </td>
                <td className="tnum px-2.5 py-1.5 text-right text-text-muted">{t.mae.toFixed(2)}</td>
                <td className="tnum px-2.5 py-1.5 text-right text-text-muted">{t.mfe.toFixed(2)}</td>
                <td className="tnum px-2.5 py-1.5 text-right">
                  <Signed value={t.cum} />
                </td>
                <td className="px-2.5 py-1.5 whitespace-nowrap text-text-muted">{regimesTagged ? (t.regime ?? "—") : "—"}</td>
                <td className="px-2.5 py-1.5">
                  <Chip tone={t.sample === "OOS" ? "accent" : "neutral"}>{t.sample}</Chip>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 bg-bg-elevated">
            <tr>
              <td className="px-2.5 py-2 text-text-muted" colSpan={8}>
                {rows.length} trades
              </td>
              <td className="tnum px-2.5 py-2 text-right">
                <Signed value={tot.gross} />
              </td>
              <td className="tnum px-2.5 py-2 text-right text-loss">{costsModelled ? tot.costs.toFixed(2) : "—"}</td>
              <td className="tnum px-2.5 py-2 text-right font-medium">
                <Signed value={costsModelled ? tot.net : tot.gross} />
              </td>
              <td colSpan={6} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
