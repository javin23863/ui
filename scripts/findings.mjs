// Show only the review findings anchored to the PR's CURRENT head.
// The comments API returns every round ever, so without this filter a fixed
// defect keeps reappearing and gets "fixed" twice.
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
const live = all.filter((c) => c.commit_id === head);
console.log(`PR #${pr} head ${head.slice(0, 7)} — ${live.length} live of ${all.length} total\n`);
for (const c of live) {
  const body = c.body.split("<details>")[0];
  const title = /\*\*(.+?)\*\*/.exec(body)?.[1] ?? "";
  const prose = body
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("<a href") && !l.startsWith("**"))
    .join(" ")
    .slice(0, 600);
  console.log(`### ${c.path}:${c.line ?? c.original_line}\n${title}\n${prose}\n`);
}
