import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, GitBranch, Star } from "lucide-react";
import { Chip, cx, Refusal, Signed } from "../ui";
import { SORTS, type SavedRun, type SortId, warningsFor } from "../runs";

/**
 * §15 — the Strategy Library. Ours; the reference has a star icon with nothing
 * behind it.
 *
 * The design problem here is judgement, not storage. A library sorted by return
 * is a machine for promoting the luckiest overfit run the user ever produced, so
 * the default order is fewest-warnings-first and the control says so in words.
 */
export default function StrategyLibrary({
  runs,
  onArchive,
}: {
  runs: SavedRun[];
  onArchive: (id: string, archived: boolean) => void;
}) {
  const [sort, setSort] = useState<SortId>("trust");
  const [archived, setArchived] = useState(false);

  const shown = useMemo(() => {
    const compare = SORTS.find((s) => s.id === sort)!.compare;
    return runs.filter((r) => r.archived === archived).sort(compare);
  }, [runs, sort, archived]);

  const byName = new Map(runs.map((r) => [r.id, r.strategy]));

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-apollo-id="strategy-library">
      <header className="shrink-0 px-4 pt-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-medium">Strategy Library</h2>
          <span className="text-[12px] text-text-muted">
            {shown.length} {archived ? "archived" : "saved"}
          </span>

          <div className="ml-auto flex items-center gap-1 text-[11px]" role="group" aria-label="Sort">
            <span className="mr-1 text-text-muted">Sort</span>
            {SORTS.map((s) => (
              <button
                key={s.id}
                data-apollo-id={`library-sort-${s.id}`}
                aria-pressed={sort === s.id}
                onClick={() => setSort(s.id)}
                className={cx(
                  "rounded px-2 py-0.5",
                  sort === s.id ? "bg-bg-elevated text-text-primary" : "text-text-muted hover:text-text-primary",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 text-[11px]" role="group" aria-label="Filter">
            {[
              { id: false, label: "Active" },
              { id: true, label: "Archived" },
            ].map((f) => (
              <button
                key={f.label}
                data-apollo-id={`library-filter-${f.label.toLowerCase()}`}
                aria-pressed={archived === f.id}
                onClick={() => setArchived(f.id)}
                className={cx(
                  "rounded px-2 py-0.5",
                  archived === f.id ? "bg-bg-elevated text-text-primary" : "text-text-muted hover:text-text-primary",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* §15: a save that SILENTLY evaporates on reload is worse than no save
            button. Nothing here is stored anywhere, so the screen says it. */}
        <p className="mt-2 text-[11px] text-text-muted" data-apollo-id="library-storage-notice">
          Saved runs live in this browser tab only and are lost on reload — nothing is stored to an
          account yet.
        </p>
        <p className="mt-2 text-[11px] text-text-muted">
          Sorted by how well each run supports its own headline number, not by how large that number
          is.
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-6">
        {shown.length === 0 ? (
          <Refusal>
            {archived ? (
              <>Nothing archived. A run you stop working on goes here rather than being deleted — a strategy that failed is still evidence.</>
            ) : (
              <>
                No saved runs yet. Starring a backtest keeps the instrument, timeframe, date range,
                the strategy source and that run's own numbers, so it can be re-opened exactly as it
                was — and shows what the run could not support alongside what it earned.
              </>
            )}
          </Refusal>
        ) : (
          <ul className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
            {shown.map((r) => (
              <RunCard
                key={r.id}
                run={r}
                parentName={r.parentId ? byName.get(r.parentId) : undefined}
                onArchive={onArchive}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const stamp = (t: number) =>
  new Date(t).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

function RunCard({
  run,
  parentName,
  onArchive,
}: {
  run: SavedRun;
  parentName?: string;
  onArchive: (id: string, archived: boolean) => void;
}) {
  const warnings = warningsFor(run.facts);

  return (
    <li className="rounded-lg border border-border bg-bg-panel p-3" data-apollo-id={`library-card-${run.id}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-medium text-text-primary">{run.strategy}</h3>
          <p className="mt-0.5 text-[11px] text-text-muted">
            {run.symbol} · {run.timeframe} · {run.rangeLabel}
          </p>
        </div>
        <button
          data-apollo-id={`library-archive-${run.id}`}
          aria-label={run.archived ? "Restore run" : "Archive run"}
          title={run.archived ? "Restore" : "Archive"}
          onClick={() => onArchive(run.id, !run.archived)}
          className="ml-auto shrink-0 text-text-muted hover:text-text-primary"
        >
          {run.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
        </button>
      </div>

      {parentName && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-text-muted">
          <GitBranch size={11} /> Edited from {parentName}
        </p>
      )}

      {run.fixtureAvailable ? (
        <>
          <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
            {(
              [
                ["Net", <Signed value={run.netProfit} unit="USD" />],
                ["Trades", <span className="tnum">{run.facts.trades}</span>],
                ["Win rate", <span className="tnum">{run.winRate.toFixed(2)}%</span>],
                [
                  "Profit factor",
                  <span className={cx("tnum", run.profitFactor > 1 ? "text-profit" : "text-loss")}>
                    {run.profitFactor.toFixed(3)}
                  </span>,
                ],
              ] as [string, React.ReactNode][]
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between border-t border-border py-1">
                <dt className="text-text-muted">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>

          {/* §15b — on the CARD, not only on a detail page. A run that cannot
              support its headline says so where the headline is read. */}
          <div className="mt-2 flex flex-wrap gap-1.5" data-apollo-id={`library-chips-${run.id}`}>
            {warnings.length ? (
              warnings.map((w) => (
                <Chip key={w.id} tone="warning">
                  {w.label}
                </Chip>
              ))
            ) : (
              <Chip tone="profit">Nothing flagged</Chip>
            )}
          </div>
        </>
      ) : (
        /* §15 — never re-render a saved run against different data. */
        <Refusal>
          The data this run was computed from is no longer loaded, so its numbers cannot be shown.
          Re-running it against whatever is loaded now would produce a different result under the
          same name.
        </Refusal>
      )}

      {/* §15a lists the strategy source among the context a save must capture.
          Showing it is what makes that checkable rather than asserted. There is
          deliberately no "open this run" action: loading a saved run's own data
          back into the chart needs a data path this build does not have, and a
          button that returned to the currently-loaded fixture under another
          run's name would be the label-without-its-data defect again. */}
      <details className="mt-2.5 border-t border-border pt-2">
        <summary
          data-apollo-id={`library-source-${run.id}`}
          className="cursor-pointer text-[11px] text-text-muted hover:text-text-primary"
        >
          Strategy source, as saved
        </summary>
        <pre className="mt-1.5 max-h-40 overflow-auto rounded bg-bg-elevated p-2 font-mono text-[10px] leading-[1.5] whitespace-pre-wrap text-text-secondary">
          {run.source.trim()}
        </pre>
      </details>

      <div className="mt-2 flex items-center gap-2">
        <Star size={11} className="text-text-muted" />
        <span className="text-[11px] text-text-muted">Saved {stamp(run.savedAt)}</span>
      </div>
    </li>
  );
}
