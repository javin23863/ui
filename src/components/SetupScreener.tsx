import { useMemo } from "react";
import { AlertTriangle, Radar } from "lucide-react";
import { cx, Refusal } from "../ui";
import type { SavedRun } from "../runs";
import {
  matchCount,
  SCREEN_TIMEFRAMES,
  type ScreenCell,
  type ScreenRow,
  screenRowsFor,
  unsupportedMatchCount,
} from "../setups";

/**
 * §18b — the Screener. The actionable half.
 *
 * One question: of the setups this trader saved, which ones matched on the
 * instrument they are looking at, and on which timeframes. Every answer carries
 * when it was observed, and every match either links to its evidence or says it
 * has none.
 *
 * It is NOT live. There is no market data and no engine, so the states below
 * come from a fixture and do not update. That is stated on the panel and the
 * notice is not dismissible — an actionable page that looks live while showing
 * stale state is the most misleading surface this build could ship.
 */
export default function SetupScreener({
  symbol,
  runs,
  onOpenEvidence,
}: {
  symbol: string;
  runs: SavedRun[];
  /** Opens the Conditional Rates panel ON the cited report. The support used to
   *  be inert text while the docs claimed the cell "links to" its evidence — a
   *  capability asserted in prose and absent from the code. */
  onOpenEvidence: (reportId: string) => void;
}) {
  const rows = useMemo(() => screenRowsFor(symbol, runs), [symbol, runs]);
  const matches = matchCount(rows);
  const unsupported = unsupportedMatchCount(rows);
  const hasAnySaved = runs.some((r) => !r.archived);

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-apollo-id="screener">
      <header className="shrink-0 px-4 pt-3">
        <div className="flex items-center gap-2">
          <Radar size={15} className="text-accent" />
          <h2 className="text-[15px] font-medium">Screener</h2>
          <span className="text-[12px] text-text-muted">
            Your saved setups on {symbol}, by timeframe
          </span>
          {rows.length > 0 && (
            <span className="ml-auto text-[11px] text-text-muted" data-apollo-id="screener-summary">
              <span className="tnum text-text-secondary">{matches}</span> matched
              {unsupported > 0 && (
                <>
                  {" · "}
                  <span className="tnum text-warning">{unsupported}</span> with no supporting history
                </>
              )}
            </span>
          )}
        </div>

        {/* Not dismissible, and stated before any cell. */}
        <p
          className="mt-2 flex items-start gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-3 py-1.5 text-[11px] text-text-secondary"
          data-apollo-id="screener-not-live"
        >
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-warning" />
          <span>
            <strong className="text-warning">Not connected to market data.</strong> These are
            recorded observations from a fixture, each stamped with when it was evaluated. Nothing
            here updates, and nothing here says a setup is happening now.
          </span>
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-4 pt-3 pb-6">
        {rows.length === 0 ? (
          // Two different sentences. "You saved nothing" is not "nothing matches
          // this instrument", and reading one as the other sends the trader to
          // the wrong place.
          <Refusal>
            {hasAnySaved ? (
              <span data-apollo-id="screener-none-for-symbol">
                None of your saved setups were measured on {symbol}. A setup measured on another
                instrument is a different claim, so it is not screened here — save a run on {symbol}{" "}
                to screen it.
              </span>
            ) : (
              <span data-apollo-id="screener-no-setups">
                No saved setups yet. The screener runs the setups in your library, so star a backtest
                to put one here — this page shows where they matched, never a setup you have not kept.
              </span>
            )}
          </Refusal>
        ) : (
          <table className="w-full border-collapse text-[12px]" data-apollo-id="screener-matrix">
            <thead>
              <tr className="text-text-muted">
                <th className="pb-2 text-left font-normal">Setup</th>
                {SCREEN_TIMEFRAMES.map((tf) => (
                  <th key={tf} className="pb-2 text-center font-normal">
                    {tf}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Row key={r.runId} row={r} onOpenEvidence={onOpenEvidence} />
              ))}
            </tbody>
          </table>
        )}

        {rows.length > 0 && (
          <p className="mt-3 text-[11px] text-text-muted">
            1m is not screened: it is a source resolution used to build these timeframes, not one to
            trade.
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ row, onOpenEvidence }: { row: ScreenRow; onOpenEvidence: (id: string) => void }) {
  return (
    <tr className="border-t border-border align-top">
      <td className="py-2 pr-3">
        <div className="text-text-primary">{row.setup}</div>
        {/* The saved run's scope, stated. Nothing below re-scopes it. */}
        <div className="mt-0.5 text-[11px] text-text-muted">
          history measured on {row.symbol} {row.capturedTimeframe}
        </div>
      </td>
      {row.cells.map((c) => (
        <td key={c.timeframe} className="py-2 text-center" data-apollo-id={`screener-cell-${row.runId}-${c.timeframe}`}>
          <CellView cell={c} onOpenEvidence={onOpenEvidence} />
        </td>
      ))}
    </tr>
  );
}

function CellView({ cell, onOpenEvidence }: { cell: ScreenCell; onOpenEvidence: (id: string) => void }) {
  if (cell.state === "not-evaluated")
    return (
      <span className="text-[11px] text-text-muted" title={cell.reason ?? undefined}>
        not evaluated
      </span>
    );

  if (cell.state === "no-match")
    return (
      <span className="text-[11px] text-text-muted">
        no match
        <br />
        <span className="text-[10px]">{cell.evaluatedAt}</span>
      </span>
    );

  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      {/* Past tense on purpose: what was seen, when. Never "active now". */}
      <span
        className={cx(
          "rounded px-1.5 py-0.5 text-[11px] font-medium",
          cell.supportReportId ? "bg-accent/18 text-accent" : "bg-warning/18 text-warning",
        )}
      >
        matched
      </span>
      <span className="text-[10px] text-text-muted">{cell.evaluatedAt}</span>
      {cell.note && <span className="text-[10px] text-text-muted">{cell.note}</span>}
      {cell.supportReportId ? (
        <button
          data-apollo-id={`screener-evidence-${cell.supportReportId}`}
          onClick={() => onOpenEvidence(cell.supportReportId!)}
          title="Open this setup's conditional rates"
          className="font-mono text-[10px] text-accent underline decoration-dotted underline-offset-2 hover:text-text-primary"
        >
          history: {cell.supportReportId}
        </button>
      ) : (
        // The rule that ties the two tabs together. A trigger with nothing
        // behind it is labelled, not quietly shown like the supported ones.
        <span className="text-[10px] text-warning" data-apollo-id="screener-unsupported">
          no supporting history at this timeframe
        </span>
      )}
    </span>
  );
}
