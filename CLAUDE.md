# Kestrel

A transaction-intelligence command center: a live fraud-detection demo for a bank/fintech executive audience, rendered on a 3D globe. **All data is 100% synthetic** — the SIMULATED DATA badge must stay visible on every page, always.

Kestrel is also a showcase of agentic development: after the initial scaffold, every change ships as an agent-authored PR. The `/fleet` page visualizes this repo's own development history.

## Commands

| Command | What |
|---|---|
| `pnpm dev` | Vite dev server (Worker runs in real workerd) |
| `pnpm check` | Biome + `tsc -b` + Vitest — run before every push |
| `pnpm test` | Vitest: `unit` pool (node) + `worker` pool (workerd) |
| `pnpm build` | Typecheck + production build |
| `pnpm deploy` | Build + `wrangler deploy` (CI does this on merge to main) |

## Architecture — one Worker, one deploy

- `sim/` — the deterministic simulation engine. **Purity rules (hard invariants):**
  - Zero dependencies. No DOM, no Workers APIs, no Node APIs.
  - Never read the clock — callers pass time in. `Date.now()` inside `sim/` is a bug.
  - All generation is a pure function of `(GLOBAL_SEED, bucketIndex)`; the browser and the Worker must compute byte-identical worlds.
  - Bump `ENGINE_VERSION` on ANY change that affects generated output, and update snapshot tests.
- `worker/` — Hono API. Only `/api/*` reaches the Worker (`assets.run_worker_first`); everything else is served by the assets layer. Cloudflare-specific code lives ONLY here (Azure portability).
- `src/` — React 19 client. Tailwind v4 theme tokens live in `src/index.css` under `@theme`.
- `test/` — `test/sim` + `test/components` run in the unit pool; `test/worker` runs in workerd via `@cloudflare/vitest-pool-workers`.

## Conventions

- Biome is the only linter/formatter (tabs, double quotes). `pnpm format` to fix.
- Relative imports use explicit `.ts` extensions (the worker tsconfig resolves with nodenext).
- Branches: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`.
- Every PR carries exactly one `agent:*` label (`agent:planner|builder|reviewer|tester`) and links its issue — the `/fleet` page is built from these labels, so an unlabeled PR is invisible to the demo.
- Commit style: imperative subject, body explains why.

## Agent fleet workflow

1. **planner** takes an issue → posts a design + scoped task breakdown as an issue comment.
2. **builder** implements one scoped task on a feature branch.
3. **tester** extends tests (determinism tests are sacred — same seed ⇒ same world).
4. **reviewer** adversarially verifies against the issue's acceptance criteria.
5. PR opens → CI + preview URL auto-comment.
6. **Human review (final gate).** Once every subagent above is done — issue has planner's notes, PR has the diff, CI + tests are green — a human reads it all and decides whether to merge. This is a pause for a go/no-go call, not another round of design or implementation; the agents already did that work.
7. Merge to main → auto-deploy to production Cloudflare (workers.dev) → `/fleet` records the event.

## Demo runbook (live sessions)

1. Open the live site and `/fleet` side by side.
2. Pick a prepared issue (good candidates: 5th fraud pattern "merchant bust-out", corridor league table, quality-preset improvements).
3. Fan out: planner → parallel builders → tester + reviewer.
4. Merge the PR; watch the deploy land (~1 min) and refresh the site.
5. End on `/fleet`: the feature you just watched ship is now part of the data.
