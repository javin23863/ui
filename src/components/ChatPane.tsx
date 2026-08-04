import { useEffect, useRef, useState } from "react";
import { ArrowUp, Image as ImageIcon, Lightbulb, Mic, TrendingUp } from "lucide-react";
import { cx } from "../ui";
import { dictationSupported, useDictation } from "./useDictation";

// Turn model carries `source` from day one — spec §13.4. Apollo's turns land in
// this same transcript, and adding the discriminant later would mean migrating
// every stored conversation.
export type Turn = {
  id: string;
  source: "user" | "apollo";
  text: string;
  /** What Apollo looked at to say this, when it looked at anything. */
  saw?: string;
};

const CONSENT_KEY = "tc.voice.consent";

function Markdownish({ text }: { text: string }) {
  return (
    <>
      {text.split("\n\n").map((block, i) => {
        if (/^\d+\.\s/m.test(block)) {
          return (
            <ol key={i} className="my-2 list-decimal space-y-1.5 pl-5">
              {block.split("\n").map((li, j) => (
                <li key={j}>{inline(li.replace(/^\d+\.\s/, ""))}</li>
              ))}
            </ol>
          );
        }
        if (/^[-•]\s/m.test(block)) {
          return (
            <ul key={i} className="my-2 list-disc space-y-1.5 pl-5">
              {block.split("\n").map((li, j) => (
                <li key={j}>{inline(li.replace(/^[-•]\s/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="my-2">
            {inline(block)}
          </p>
        );
      })}
    </>
  );
}

function inline(s: string) {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`"))
      return (
        <code key={i} className="rounded bg-bg-elevated px-1 py-0.5 font-mono text-[12px]">
          {part.slice(1, -1)}
        </code>
      );
    return part;
  });
}

export default function ChatPane({
  turns,
  onSend,
  onVoice,
}: {
  turns: Turn[];
  onSend: (t: string) => void;
  /** Mirrors mic state + amplitude up to Apollo, so the orb reacts to your voice. */
  onVoice?: (state: "idle" | "listening", level: number) => void;
}) {
  const [draft, setDraft] = useState("");
  const [consent, setConsent] = useState(() => localStorage.getItem(CONSENT_KEY) === "1");
  const [askConsent, setAskConsent] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const dict = useDictation((finalText) => setDraft((d) => (d ? d + " " : "") + finalText));
  const empty = turns.length === 0;

  const listening = dict.state === "listening";
  useEffect(() => {
    onVoice?.(listening ? "listening" : "idle", listening ? (dict.level[0] ?? 0) : 0);
  }, [listening, dict.level, onVoice]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [turns.length]);

  const send = () => {
    if (!draft.trim()) return;
    if (dict.state === "listening") dict.stop();
    onSend(draft.trim());
    setDraft("");
  };

  const micPressed = dict.state === "listening";
  const onMic = () => {
    if (micPressed) return dict.stop();
    // Consent BEFORE the first capture — Chrome streams audio to its speech
    // service. Not a modal, not pre-checked, capture blocked until Allow (§4a).
    if (!consent) return setAskConsent(true);
    dict.start();
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        onMic();
      }
      if (e.key === "Escape" && micPressed) dict.stop();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div ref={scroller} className={cx("min-h-0 flex-1 overflow-y-auto px-3", empty && "flex items-center")}>
        {empty ? (
          <div className="w-full pb-10">
            <h1 className="text-center text-[24px] leading-tight font-semibold">What do you want to create?</h1>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {[
                { icon: ImageIcon, label: "Generate From Image" },
                { icon: TrendingUp, label: "Search Trending Scripts" },
                { icon: Lightbulb, label: "Brainstorm Ideas" },
              ].map((b) => (
                <button
                  key={b.label}
                  data-apollo-id={`starter-${b.label.toLowerCase().replace(/\s+/g, "-")}`}
                  className="flex h-8 items-center gap-2 rounded-lg border border-border bg-bg-panel px-3 text-[13px] hover:bg-bg-hover"
                >
                  <b.icon size={14} className="text-text-muted" />
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-6">
            {turns.map((t) =>
              t.source === "user" ? (
                <div key={t.id} className="flex justify-end">
                  <div className="max-w-[78%] rounded-[10px] bg-bg-elevated px-3.5 py-2.5">{t.text}</div>
                </div>
              ) : (
                <div key={t.id} className="text-text-primary">
                  {t.saw && (
                    <div className="mb-1.5 text-[11px] text-text-muted">
                      <span className="text-accent">◆</span> read {t.saw}
                    </div>
                  )}
                  <Markdownish text={t.text} />
                </div>
              ),
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 px-3 pb-3">
        {askConsent && (
          <div className="mb-2 rounded-lg border border-border bg-bg-panel p-3 text-[12px] text-text-muted">
            Voice input sends audio to your browser&apos;s speech service. Use text instead?
            <div className="mt-2 flex gap-2">
              <button
                data-apollo-id="voice-consent-decline"
                className="h-7 rounded-md px-2.5 text-text-muted hover:text-text-primary"
                onClick={() => setAskConsent(false)}
              >
                Not now
              </button>
              <button
                data-apollo-id="voice-consent-allow"
                className="h-7 rounded-md bg-bg-elevated px-2.5 text-text-primary"
                onClick={() => {
                  localStorage.setItem(CONSENT_KEY, "1");
                  setConsent(true);
                  setAskConsent(false);
                  dict.start();
                }}
              >
                Allow
              </button>
            </div>
          </div>
        )}

        <div className="rounded-[10px] border border-border bg-bg-panel px-3 pt-2.5 pb-2">
          <textarea
            data-apollo-id="composer"
            value={draft + (dict.interim ? (draft ? " " : "") + dict.interim : "")}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            placeholder={empty ? "I want to…" : "Ask for an indicator"}
            className="max-h-40 w-full resize-none bg-transparent placeholder:text-text-muted focus:outline-none"
          />

          {micPressed && (
            <div aria-hidden className="flex h-4 items-end gap-[3px] pb-1">
              {dict.level.map((v, i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-accent transition-[height] duration-75"
                  style={{ height: `${Math.max(3, v * 16)}px` }}
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button data-apollo-id="attach-image" aria-label="Attach image" className="text-text-muted hover:text-text-primary">
              <ImageIcon size={16} />
            </button>
            <div className="flex items-center gap-2">
              {dictationSupported && (
                <button
                  data-apollo-id="mic"
                  aria-label="Dictate"
                  aria-pressed={micPressed}
                  onClick={onMic}
                  className={cx(
                    "grid size-[26px] place-items-center rounded-full transition-colors",
                    micPressed && "bg-accent text-text-primary",
                    dict.state === "denied" && "text-loss ring-1 ring-loss",
                    dict.state === "idle" && "text-text-muted hover:text-text-primary",
                    dict.state === "requesting" && "animate-pulse text-text-muted",
                  )}
                >
                  <Mic size={14} />
                </button>
              )}
              <button
                data-apollo-id="send"
                aria-label="Send"
                onClick={send}
                className="grid size-[26px] place-items-center rounded-full bg-text-primary text-bg-app"
              >
                <ArrowUp size={15} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>

        <div aria-live="polite" className="sr-only">
          {micPressed ? "Listening" : dict.state === "denied" ? "Microphone blocked" : "Stopped"}
        </div>
        {dict.state === "denied" && (
          <p className="mt-1.5 text-[11px] text-loss">Microphone blocked — enable it in your browser settings</p>
        )}

        <p className="mt-2 text-center text-[9px] text-text-muted">
          Past performance is not indicative of future results. This tool can make errors. Read{" "}
          <span className="underline">full disclaimer</span>.
        </p>
      </div>
    </div>
  );
}
