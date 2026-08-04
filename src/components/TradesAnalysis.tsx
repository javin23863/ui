import { useMemo, useState } from "react";
import { CostCurve, DurationHistogram, MaeMfeScatter, RDistribution } from "./charts";
import { Card, Chip, cx, KpiStrip, Refusal, Signed } from "../ui";
import { trades } from "../fixtures/market";

// §8c — OUR tab. The reference never opens it, so nothing here is parity.
// Design rule: every panel must be able to say no. The `profile` switch below
// exists so that refusal is demonstrable, not just claimed — it is the P6
// empty-state sweep made interactive.
type Profile = "full" | "no-costs" | "no-holdout" | "thin" | "no-regimes";

const PROFILES: { id: Profile; label: string }[] = [
  { id: "full", label: "Full run" },
  { id: "no-costs", label: "Costs not modelled" },
  { id: "no-holdout", label: "No holdout" },
  { id: "thin", label: "Thin sample" },
  { id: "no-regimes", label: "Untagged regimes" },
];

export default function TradesAnalysis() {
  const [profile, setProfile] = useState<Profile>("full");

  const rows = useMemo(() => (profile === "thin" ? trades.slice(0, 11) : trades), [profile]);
  const costsModelled = profile !== "no-costs";
  const hasHoldout = profile !== "no-holdout";
  const hasRegimes = profile !== "no-regimes";

  const net = rows.reduce((s, t) => s + t.net, 0);
  const months = 37;
  const perMonth = rows.length / (profile === "thin" ? 12 : months);
  const top3 = [...rows].sort((a, b) => b.net - a.net).slice(0, 3).reduce((s, t) => s + t.net, 0);
  const top3Share = net > 0 ? (top3 / net) * 100 : 0;

  const modelledCost = 14.2;
  const costPoints = Array.from({ length: 25 }, (_, i) => {
    const cost = (i / 24) * modelledCost * 2;
    return { cost, net: rows.reduce((s, t) => s + t.gross, 0) - cost * rows.length };
  });
  const breakeven = costPoints.find((p) => p.net <= 0)?.cost ?? null;
  const headroom = breakeven ? breakeven / modelledCost : null;

  const is = rows.filter((t) => t.sample === "IS");
  const oos = rows.filter((t) => t.sample === "OOS");
  const stat = (arr: typeof rows) => {
    const w = arr.filter((t) => t.net > 0);
    const gp = w.reduce((s, t) => s + t.net, 0);
    const gl = Math.abs(arr.filter((t) => t.net <= 0).reduce((s, t) => s + t.net, 0));
    return { net: arr.reduce((s, t) => s + t.net, 0), win: arr.length ? (w.length / arr.length) * 100 : 0, pf: gl ? gp / gl : 0, n: arr.length };
  };
  const isS = stat(is);
  const oosS = stat(oos);

  const regimes = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const t of rows) {
      if (!t.regime) continue;
      map.set(t.regime, [...(map.get(t.regime) ?? []), t]);
    }
    return [...map.entries()].map(([name, ts]) => ({ name, ...stat(ts) }));
  }, [rows]);

  const warn = (bad: boolean, label: string) => (bad ? <Chip tone="warning">{label}</Chip> : null);

  return (
    <div className="pt-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[11px] text-text-muted">Run profile</span>
        {PROFILES.map((p) => (
          <button
            key={p.id}
            data-apollo-id={`profile-${p.id}`}
            onClick={() => setProfile(p.id)}
            className={cx(
              "rounded-full px-2.5 py-1 text-[11px]",
              profile === p.id ? "bg-accent/18 text-accent" : "text-text-muted hover:text-text-primary",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <KpiStrip
        items={[
          { label: "Trades", value: <span className="tnum">{rows.length}</span>, sub: rows.length < 30 ? "thin sample" : undefined },
          { label: "Trades / Month", value: <span className="tnum">{perMonth.toFixed(2)}</span>, sub: perMonth < 2 ? "sparse" : undefined },
          { label: "Top-3 Trade Share", value: <span className={cx("tnum", top3Share > 60 ? "text-loss" : top3Share > 40 ? "text-warning" : "")}>{top3Share.toFixed(0)}%</span> },
          { label: "Longest Flat Period", value: <span className="tnum">94 days</span> },
          { label: "Exposure", value: <span className="tnum">18%</span> },
        ]}
      />
      <div className="mb-5 flex gap-2 pt-2">
        {warn(rows.length < 30, "Thin sample")}
        {warn(perMonth < 2, "Sparse")}
        {warn(top3Share > 40, `Top-3 carries ${top3Share.toFixed(0)}% of net`)}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Card title="Cost Sensitivity">
          {costsModelled ? (
            <>
              <CostCurve points={costPoints} modelled={modelledCost} breakeven={breakeven} apolloId="cost-sensitivity" />
              <dl className="mt-2">
                {[
                  ["Modelled cost", `$${modelledCost.toFixed(2)} / round turn`, ""],
                  ["Breakeven cost", breakeven ? `$${breakeven.toFixed(2)} / round turn` : "beyond 2× modelled", ""],
                  [
                    "Headroom",
                    headroom ? `${headroom.toFixed(2)}×` : "> 2×",
                    headroom && headroom < 1.5 ? "text-loss" : headroom && headroom > 3 ? "text-profit" : "",
                  ],
                ].map(([k, v, cls]) => (
                  <div key={k} className="flex justify-between border-t border-border py-1.5 text-[12px]">
                    <dt className="text-text-muted">{k}</dt>
                    <dd className={cx("tnum", cls)}>{v}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <Refusal>
              Spread and commissions not modelled — this result is a gross-return upper bound.
            </Refusal>
          )}
        </Card>

        <Card title="In-Sample / Out-of-Sample">
          {hasHoldout ? (
            <>
              <div className="grid grid-cols-4 gap-2 text-[12px]">
                <div />
                <div className="text-text-muted">In-sample</div>
                <div className="text-text-muted">Out-of-sample</div>
                <div className="text-text-muted">Δ</div>
                {(
                  [
                    { label: "Net", a: isS.net, b: oosS.net, render: (v: number) => <Signed value={v} />, dp: 2 },
                    // A win-rate gap is in percentage POINTS. Rendering it as a
                    // bare number next to two values carrying % invites reading
                    // it as a percentage change, which is a different quantity.
                    { label: "Win rate", a: isS.win, b: oosS.win, render: (v: number) => <span className="tnum">{v.toFixed(1)}%</span>, dp: 1, unit: " pp" },
                    { label: "Profit factor", a: isS.pf, b: oosS.pf, render: (v: number) => <span className="tnum">{v.toFixed(2)}</span>, dp: 2 },
                    // How the run was split, not how it performed. Colouring the
                    // smaller holdout red reads as a result getting worse.
                    { label: "Trades", a: isS.n, b: oosS.n, render: (v: number) => <span className="tnum">{v}</span>, dp: 0, neutral: true },
                  ] as {
                    label: string;
                    a: number;
                    b: number;
                    render: (v: number) => React.ReactNode;
                    dp: number;
                    unit?: string;
                    neutral?: boolean;
                  }[]
                ).map(({ label, a, b, render, dp, unit = "", neutral = false }) => {
                  const d = b - a;
                  return (
                    <div key={label} className="contents">
                      <div className="border-t border-border py-1.5">{label}</div>
                      <div className="border-t border-border py-1.5">{render(a)}</div>
                      <div className="border-t border-border py-1.5">{render(b)}</div>
                      <div
                        className={cx(
                          "tnum border-t border-border py-1.5",
                          neutral ? "text-text-muted" : d < 0 ? "text-loss" : "text-profit",
                        )}
                      >
                        {d > 0 ? "+" : d < 0 ? "−" : ""}
                        {Math.abs(d).toFixed(dp)}
                        {unit}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-text-muted">
                Split after trade #{isS.n}. OOS is {oosS.n} trades.
              </p>
            </>
          ) : (
            <Refusal>
              No out-of-sample period declared for this run. A split invented at display time is not a holdout.
            </Refusal>
          )}
        </Card>

        <Card title="Trade Distribution (R)">
          <RDistribution values={rows.map((t) => t.r)} apolloId="r-distribution" />
        </Card>

        <Card title="MAE / MFE">
          <MaeMfeScatter points={rows.map((t) => ({ mae: t.mae, mfe: t.mfe, win: t.net > 0 }))} apolloId="mae-mfe" />
        </Card>

        <Card title="Duration — Winners vs Losers">
          <DurationHistogram
            wins={rows.filter((t) => t.net > 0).map((t) => t.bars)}
            losses={rows.filter((t) => t.net <= 0).map((t) => t.bars)}
            apolloId="duration"
          />
        </Card>

        <Card title="Regime Breakdown">
          {hasRegimes && regimes.length ? (
            <table className="w-full text-[12px]" data-apollo-id="regime-table">
              <thead>
                <tr className="text-text-muted">
                  <th className="pb-1 text-left font-normal">Regime</th>
                  <th className="pb-1 text-right font-normal">Trades</th>
                  <th className="pb-1 text-right font-normal">Win rate</th>
                  <th className="pb-1 text-right font-normal">Net</th>
                  <th className="pb-1 text-right font-normal">PF</th>
                </tr>
              </thead>
              <tbody>
                {regimes.map((r) => {
                  const thin = r.n < 10;
                  return (
                    <tr key={r.name} className={cx("border-t border-border", thin && "text-text-muted")}>
                      <td className="py-1.5">
                        {r.name} {thin && <Chip tone="warning">Thin</Chip>}
                      </td>
                      <td className="tnum py-1.5 text-right">{r.n}</td>
                      <td className="tnum py-1.5 text-right">{r.win.toFixed(1)}%</td>
                      <td className="tnum py-1.5 text-right">{thin ? r.net.toFixed(2) : <Signed value={r.net} />}</td>
                      <td className="tnum py-1.5 text-right">{r.pf.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <Refusal>Regime tags not available for this run.</Refusal>
          )}
        </Card>
      </div>
    </div>
  );
}
