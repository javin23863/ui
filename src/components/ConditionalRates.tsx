import { useMemo, useState } from "react";
import { Radar } from "lucide-react";
import { ClassFrequencyBars } from "./charts";
import { Card, Chip, cx, Refusal } from "../ui";
import { REPORTS } from "../fixtures/reports";
import {
  classRowsFor,
  DENOMINATOR_FLOOR,
  liftFor,
  type Quantity,
  refusalFor,
  type Report,
  totalFor,
} from "../rates";

/**
 * §16/§18a — Conditional Rates. What usually happened after a named setup.
 *
 * This is the EVIDENCE half of the screening surface (§18a). It answers "what
 * usually happened after this setup?" for this asset in this session, and
 * refuses to state a rate it cannot support. The Screener answers the other
 * half — whether the setup happened — and links back here.
 *
 * Named for the conditional rate, not the baseline: the panel renders
 * `Baseline rate` as a separate field, and its whole point is showing the
 * conditional rate BESIDE that baseline. It is not called Probabilities either;
 * the Atlas contract prohibits that wording until calibrated status is earned,
 * and the navigation is where every screen inherits its claim from.
 */
export default function ConditionalRates({ symbol, timeframe }: { symbol: string; timeframe: string }) {
  const [id, setId] = useState(REPORTS[0].id);
  const [chartLinked, setChartLinked] = useState(false);

  // Chart-linked mode filters which reports are OFFERED. It never transforms a
  // report's counts — recomputing a cohort for a different scope is the engine's
  // job, and a panel that silently rescaled someone else's numbers would be
  // inventing a result.
  const offered = useMemo(
    () => (chartLinked ? REPORTS.filter((r) => r.symbol === symbol) : REPORTS),
    [chartLinked, symbol],
  );
  const report = offered.find((r) => r.id === id) ?? offered[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-apollo-id="conditional-rates">
      <header className="shrink-0 px-4 pt-3">
        <div className="flex items-center gap-2">
          <Radar size={15} className="text-accent" />
          <h2 className="text-[15px] font-medium">Conditional Rates</h2>
          <span className="text-[12px] text-text-muted">
            How a named setup has resolved before — not which instruments are moving now
          </span>
          <label className="ml-auto flex items-center gap-1.5 text-[11px] text-text-muted">
            <input
              type="checkbox"
              data-apollo-id="rates-chart-linked"
              checked={chartLinked}
              onChange={(e) => setChartLinked(e.target.checked)}
              className="accent-accent"
            />
            Scope to the loaded chart ({symbol} · {timeframe})
          </label>
        </div>
        <p className="mt-2 text-[11px] text-text-muted" data-apollo-id="rates-fixture-notice">
          These reports are fixture data, not a live event ledger — the counts are fixed and no
          market is being read.
        </p>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-4 pt-3 pb-6" style={{ gridTemplateColumns: "200px 1fr" }}>
        <LeftRail reports={offered} selected={report} onSelect={setId} chartLinked={chartLinked} symbol={symbol} />
        {report ? <ReportView report={report} /> : (
          <Refusal>
            No report covers {symbol} in this session. Scoping to the chart cannot borrow another
            instrument's history — a rate measured on a different market is a different claim.
          </Refusal>
        )}
      </div>
    </div>
  );
}

function LeftRail({
  reports,
  selected,
  onSelect,
  chartLinked,
  symbol,
}: {
  reports: Report[];
  selected: Report | undefined;
  onSelect: (id: string) => void;
  chartLinked: boolean;
  symbol: string;
}) {
  return (
    <aside className="flex flex-col gap-3 text-[11px]">
      <div>
        <div className="mb-1.5 tracking-[0.06em] text-text-muted uppercase">Report</div>
        <ul className="flex flex-col gap-0.5" data-apollo-id="rates-report-list">
          {reports.map((r) => (
            <li key={r.id}>
              <button
                data-apollo-id={`rates-report-${r.id}`}
                aria-pressed={selected?.id === r.id}
                onClick={() => onSelect(r.id)}
                className={cx(
                  "w-full rounded px-2 py-1 text-left",
                  selected?.id === r.id ? "bg-bg-elevated text-text-primary" : "text-text-muted hover:text-text-primary",
                )}
              >
                {r.label}
              </button>
            </li>
          ))}
          {!reports.length && (
            <li className="px-2 py-1 text-text-muted">No report matches {symbol}.</li>
          )}
        </ul>
      </div>

      {selected && (
        <dl className="flex flex-col gap-1.5">
          {[
            ["Subreport", selected.subreport],
            ["Asset & ticker", selected.symbol],
            ["Date range", selected.rangeLabel],
            ["Session", selected.session],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="tracking-[0.06em] text-text-muted uppercase">{k}</dt>
              <dd className="text-text-secondary">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {chartLinked && (
        <p className="text-text-muted">
          Showing only reports measured on {symbol}. Scoping filters which reports apply; it does
          not rescale a report's counts.
        </p>
      )}
    </aside>
  );
}

/**
 * Renders a Quantity. There is no dash branch — a missing number shows its reason.
 *
 * `signed` is opt-in because a rate is not a delta. A baseline of "+71.40%" or a
 * retention of "+19.38%" reads as a change from something; only the lifts are
 * changes, and only they carry a sign.
 */
function Q({
  q,
  unit = "",
  digits = 2,
  signed = false,
}: {
  q: Quantity;
  unit?: string;
  digits?: number;
  signed?: boolean;
}) {
  if (q.value === null) return <span className="text-[11px] text-warning">{q.reason}</span>;
  const sign = signed ? (q.value > 0 ? "+" : q.value < 0 ? "−" : "") : q.value < 0 ? "−" : "";
  return (
    <span className="tnum">
      {sign}
      {Math.abs(q.value).toFixed(digits)}
      {unit}
    </span>
  );
}

function ReportView({ report }: { report: Report }) {
  const refusal = refusalFor(report);
  const rows = classRowsFor(report);
  const total = totalFor(report);
  // The headline class is the largest measured one; lift is stated against it.
  const headline = rows.filter((r) => !r.expression).reduce((a, b) => (b.rate > a.rate ? b : a), rows[0]);
  const lift = headline ? liftFor(report, headline.rate, headline.n) : null;

  if (refusal) {
    return (
      <div className="min-w-0" data-apollo-id={`rates-refusal-${refusal.id}`}>
        <Card title={report.label}>
          <Refusal>
            <span>
              <strong className="text-text-secondary">{refusal.headline}</strong>
              <br />
              {refusal.detail}
            </span>
          </Refusal>
          <Settings report={report} />
        </Card>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-4" style={{ gridTemplateColumns: "1fr" }}>
      {/* §8 — say it before any number, not in a footnote. */}
      {report.conditionsOnEventualCompletion && (
        <div
          className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[11px] text-text-secondary"
          data-apollo-id="rates-eventual-notice"
        >
          <strong className="text-warning">Conditioned on eventual completion.</strong>{" "}
          {report.eventualNote}
        </div>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: "58fr 42fr" }}>
        <Card title={report.label}>
          <ClassFrequencyBars
            data={rows.filter((r) => !r.expression).map((r) => ({ label: r.label, rate: r.rate }))}
            apolloId="rates-distribution"
          />
          <Settings report={report} />
        </Card>

        <div className="flex flex-col gap-2" data-apollo-id="rates-insights">
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg border border-border bg-bg-panel p-3" data-apollo-id={`rates-class-${r.id}`}>
              <div className="flex items-baseline gap-2">
                <span className="tnum text-[20px] font-medium">{r.rate.toFixed(2)}%</span>
                <span className="text-[12px] text-text-secondary">{r.label}</span>
                {r.expression && <Chip tone="neutral">derived</Chip>}
              </div>
              {/* The denominator's own label travels with k and n — one call, one claim. */}
              <div className="mt-1 text-[11px] text-text-muted">
                {r.k} out of {r.n} <span className="font-mono">{r.denominatorLabel}</span>
              </div>
              {r.expression && (
                <div className="mt-1 text-[11px] text-text-muted">
                  Derived class, not measured: <span className="font-mono">{r.expression}</span>
                </div>
              )}
            </div>
          ))}

          {/* §9 — the classes AND the total. */}
          <div className="rounded-lg border border-border px-3 py-2 text-[11px]" data-apollo-id="rates-class-total">
            <span className="text-text-muted">Measured classes total </span>
            <span className="tnum text-text-secondary">
              {total.k} out of {total.n}
            </span>
            <span className="text-text-muted"> {total.denominatorLabel}</span>
          </div>
        </div>
      </div>

      {/* NOT collapsible — §16 is explicit. This block is the differentiator. */}
      <Card title="What it would have been anyway">
        <div className="grid gap-x-6 gap-y-2 text-[12px]" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Row label="Headline class">{headline?.label ?? "—"}</Row>
          <Row label="Baseline cohort">{report.baseline?.label ?? "none"}</Row>
          <Row label="Baseline rate">{lift && <Q q={lift.baselineRate} unit="%" />}</Row>
          <Row label="Absolute lift">{lift && <Q q={lift.absolute} unit=" pp" signed />}</Row>
          <Row label="Relative lift" apolloId="rates-relative-lift">
            {lift && <Q q={lift.relative} unit="%" signed />}
          </Row>
          <Row label="Sample retention">{lift && <Q q={lift.retention} unit="%" />}</Row>
        </div>

        <div className="mt-3 grid gap-x-6 gap-y-2 border-t border-border pt-3 text-[12px]" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {/* §11.3 — both counts AND the rule that produced the difference. */}
          <Row label="Raw events">
            <span className="tnum">{report.dependence.rawEventN}</span>
          </Row>
          <Row label="Independent observations">
            <span className="tnum">{report.dependence.independentN}</span>
          </Row>
          <Row label="Independent-unit rule">{report.dependence.independentUnit ?? "none declared"}</Row>
          <Row label="Dependence adjustment">{report.dependence.adjustment ?? "none applied"}</Row>
        </div>

        {/* §9 — unresolved, censored and excluded are shown SEPARATELY. */}
        <div className="mt-3 grid gap-x-6 gap-y-2 border-t border-border pt-3 text-[12px]" style={{ gridTemplateColumns: "1fr 1fr" }} data-apollo-id="rates-censoring">
          <Row label="Unresolved">
            <span className="tnum">{report.censoring.unresolvedN}</span>
          </Row>
          <Row label="Censored">
            <span className="tnum">{report.censoring.censoredN}</span>
          </Row>
          <Row label="Excluded">
            <span className="tnum">{report.censoring.excludedN}</span>
          </Row>
          <Row label="Censoring policy">{report.censoring.policy ?? "not declared"}</Row>
        </div>

        <p className="mt-3 text-[11px] text-text-muted">
          Rates here are observed historical frequencies over the stated denominator. The floor for
          stating one on this surface is {DENOMINATOR_FLOOR} resolved observations.
        </p>
      </Card>
    </div>
  );
}

function Settings({ report }: { report: Report }) {
  return (
    <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2 text-[11px]" data-apollo-id="rates-settings">
      {report.settings.map((s) => (
        <div key={s.label} className="flex gap-1.5">
          <dt className="text-text-muted">{s.label}</dt>
          <dd className="text-text-secondary">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Row({
  label,
  apolloId,
  children,
}: {
  label: string;
  apolloId?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-3 border-t border-border py-1">
      <span className="text-text-muted">{label}</span>
      <span className="text-right text-text-secondary" data-apollo-id={apolloId}>
        {children}
      </span>
    </div>
  );
}
