import { useMemo } from "react";
import { CostCurve, DurationHistogram, MaeMfeScatter, RDistribution } from "./charts";
import { Card, Chip, cx, KpiStrip, Refusal, Signed } from "../ui";
import { factsForProfile, type Profile, PROFILES, presentedRowsFor, warningsFor } from "../runs";

// §8c — OUR tab. The reference never opens it, so nothing here is parity.
// Design rule: every panel must be able to say no. The `profile` switch below
// exists so that refusal is demonstrable, not just claimed — it is the P6
// empty-state sweep made interactive.
//
// The adequacy thresholds used to be written out here. They now live in
// `src/runs.ts` and are read by both this panel and the §15 library card, so the
// two surfaces cannot come to different conclusions about the same run.

/**
 * The run profile describes the RUN, not this tab, so it is owned by the panel
 * and drives every tab. It used to be local state here, which meant the
 * Trades Log could never render its own no-costs state — §11 declares a banner
 * and a `—` column there for the same input that makes this tab refuse, and
 * that half was unreachable in the app.
 */
export default function TradesAnalysis({
  profile,
  setProfile,
}: {
  profile: Profile;
  setProfile: (p: Profile) => void;
}) {

  // PRESENTED rows, not raw. The IS/OOS table, the regime table and the
  // distributions all total `t.net`, so under a profile that does not model
  // costs they must total the same cost-free values the KPI strip and the
  // Trades Log report. Reading raw rows here left the IS/OOS split summing to
  // +1,999.70 beside a Net Profit of +2,587.70 for the same run.
  const rows = useMemo(() => presentedRowsFor(profile), [profile]);
  // Declared by the run AND actually populated. The thin-sample profile declares
  // a holdout that no trade lands in, and the panel rendered 0.00 / 0.0% / a
  // −54.5 pp delta against it — reporting that the strategy scored zero out of
  // sample when the truth is it was never tested there. A guard that reads the
  // declaration instead of the data cannot catch that, which is why `holdout`
  // carries three states rather than a boolean.
  const facts = factsForProfile(profile);
  const flagged = new Set(warningsFor(facts).map((w) => w.id));
  const costsModelled = facts.costsModelled;
  const hasRegimes = profile !== "no-regimes";

  const perMonth = facts.perMonth;
  const top3Share = facts.top3Share;

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
  const hasHoldout = facts.holdout === "ok";

  const regimes = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const t of rows) {
      if (!t.regime) continue;
      map.set(t.regime, [...(map.get(t.regime) ?? []), t]);
    }
    return [...map.entries()].map(([name, ts]) => ({ name, ...stat(ts) }));
  }, [rows]);

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
          { label: "Trades", value: <span className="tnum">{rows.length}</span>, sub: flagged.has("thin") ? "thin sample" : undefined },
          { label: "Trades / Month", value: <span className="tnum">{perMonth.toFixed(2)}</span>, sub: flagged.has("sparse") ? "sparse" : undefined },
          { label: "Top-3 Trade Share", value: <span className={cx("tnum", top3Share > 60 ? "text-loss" : flagged.has("top3") ? "text-warning" : "")}>{top3Share.toFixed(0)}%</span> },
          { label: "Longest Flat Period", value: <span className="tnum">94 days</span> },
          { label: "Exposure", value: <span className="tnum">18%</span> },
        ]}
      />
      {/* The two remaining §15b signals — costs and holdout — are full-card
          refusals on this panel rather than chips, so only these three render
          here. All five come from the same call. */}
      <div className="mb-5 flex gap-2 pt-2">
        {warningsFor(facts)
          .filter((w) => w.id === "thin" || w.id === "sparse" || w.id === "top3")
          .map((w) => (
            <Chip key={w.id} tone="warning">
              {w.label}
            </Chip>
          ))}
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
              {facts.holdout === "declared-empty"
                ? `A holdout is declared but no trade falls in it — ${isS.n} in-sample, ${oosS.n} out-of-sample. There is no out-of-sample result to compare against, which is not the same as one that came out flat.`
                : "No out-of-sample period declared for this run. A split invented at display time is not a holdout."}
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
