// Show the findings from the LATEST review round only.
//
// Do not filter on `commit_id`: GitHub rebases that field forward to the newest
// commit a comment's line still exists at, so a defect fixed three rounds ago
// still reports `commit_id === head` and gets "fixed" twice. The round a comment
// belongs to is `pull_request_review_id`; where it was written is
// `original_commit_id`. Both are stable.
import { execFileSync } from "node:child_process";

const pr = process.argv[2] ?? "2";
const branch = process.argv[3] ?? "feat/ui-build";
const head = execFileSync("git", ["rev-parse", `origin/${branch}`], { encoding: "utf8" }).trim();
const all = JSON.parse(
  execFileSync("gh", ["api", `repos/javin23863/ui/pulls/${pr}/comments`, "--paginate"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }),
);

if (!all.length) {
  console.log(`PR #${pr} — no review comments yet`);
  process.exit(0);
}

const round = Math.max(...all.map((c) => c.pull_request_review_id));
const live = all.filter((c) => c.pull_request_review_id === round);
const reviewed = live[0].original_commit_id;

console.log(
  `PR #${pr} — round ${round} reviewed ${reviewed.slice(0, 7)}, head is ${head.slice(0, 7)}` +
    (reviewed === head ? " (current)" : " — REVIEW IS STALE, a newer commit is unreviewed") +
    `\n${live.length} finding(s) of ${all.length} total across all rounds\n`,
);

for (const c of live) {
  const body = c.body.split("<details>")[0];
  const title = /\*\*(.+?)\*\*/.exec(body)?.[1] ?? "";
  const prose = body
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("<a href") && !l.startsWith("**") && !l.startsWith("<sub>"))
    .join(" ")
    .replace(/<sub>.*$/, "")
    .trim()
    .slice(0, 600);
  console.log(`### ${c.path}:${c.line ?? c.original_line}\n${title}\n${prose}\n`);
}
