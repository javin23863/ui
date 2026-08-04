import { useEffect, useRef, useState } from "react";
import { Check, Search } from "lucide-react";
import { cx } from "../ui";

const CATS = ["Stocks", "ETFs", "Crypto", "Forex", "Commodities"] as const;

const BOOK: Record<string, { sym: string; name: string }[]> = {
  Stocks: [
    { sym: "NVDA", name: "NVIDIA Corporation" },
    { sym: "AAPL", name: "Apple Inc." },
    { sym: "MSFT", name: "Microsoft Corporation" },
    { sym: "TSLA", name: "Tesla, Inc." },
  ],
  ETFs: [
    { sym: "SPY", name: "SPDR S&P 500 ETF Trust" },
    { sym: "QQQ", name: "Invesco QQQ Trust" },
  ],
  Crypto: [
    { sym: "BTCUSD", name: "Bitcoin / U.S. Dollar" },
    { sym: "ETHUSD", name: "Ethereum / U.S. Dollar" },
  ],
  Forex: [
    { sym: "GBPUSD", name: "British Pound / U.S. Dollar" },
    { sym: "USDCHF", name: "U.S. Dollar / Swiss Franc" },
    { sym: "AUDUSD", name: "Australian Dollar / U.S. Dollar" },
    { sym: "USDCAD", name: "U.S. Dollar / Canadian Dollar" },
    { sym: "NZDUSD", name: "New Zealand Dollar / U.S. Dollar" },
  ],
  Commodities: [
    { sym: "XAUUSD", name: "Gold / U.S. Dollar" },
    { sym: "XAGUSD", name: "Silver / U.S. Dollar" },
    { sym: "WTIUSD", name: "Crude Oil WTI / U.S. Dollar" },
  ],
};

export default function TickerPicker({
  current,
  onPick,
  onClose,
}: {
  current: string;
  onPick: (s: string) => void;
  onClose: () => void;
}) {
  const [cat, setCat] = useState<(typeof CATS)[number]>("Commodities");
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => !box.current?.contains(e.target as Node) && onClose();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", h);
    window.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      window.removeEventListener("keydown", k);
    };
  }, [onClose]);

  const rows = BOOK[cat].filter(
    (r) => r.sym.toLowerCase().includes(q.toLowerCase()) || r.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div
      ref={box}
      data-apollo-id="ticker-picker"
      className="absolute top-11 left-4 z-30 w-[235px] rounded-lg border border-border bg-bg-elevated p-2 shadow-xl"
    >
      <div className="flex h-8 items-center gap-2 rounded-md bg-bg-panel px-2">
        <Search size={13} className="text-text-muted" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search ticker…"
          className="w-full bg-transparent text-[13px] placeholder:text-text-muted focus:outline-none"
        />
      </div>

      <div className="my-2 flex flex-wrap gap-1">
        {CATS.map((c) => (
          <button
            key={c}
            data-apollo-id={`ticker-cat-${c.toLowerCase()}`}
            onClick={() => setCat(c)}
            className={cx(
              "rounded-full px-2 py-0.5 text-[11px]",
              cat === c ? "bg-accent text-bg-app" : "text-text-muted hover:text-text-primary",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <ul className="max-h-[185px] overflow-y-auto">
        {rows.map((r) => (
          <li key={r.sym}>
            <button
              onClick={() => onPick(r.sym)}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-bg-hover"
            >
              <span>
                <span className="block text-[13px]">{r.sym}</span>
                <span className="block text-[11px] text-text-muted">{r.name}</span>
              </span>
              {r.sym === current && <Check size={13} className="text-text-muted" />}
            </button>
          </li>
        ))}
        {!rows.length && <li className="px-2 py-3 text-center text-[12px] text-text-muted">No match.</li>}
      </ul>
    </div>
  );
}
