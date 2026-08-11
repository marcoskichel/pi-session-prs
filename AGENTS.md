# pi-session-prs

The extension only runs inside pi. Unit tests cover `core.ts` and prove nothing
about `index.ts` wiring, so test a change to `index.ts` in a live pi session
before you push it.

## Commands

- `npm run check` — types and lint.
- `npm test` — unit tests.
- `npm run dev` — load this checkout in pi. `npm run dev -- --off` restores.

## Rules

- Keep pi imports out of `core.ts` so the unit tests stay runnable.
- Never switch branches in this checkout. Create a worktree under `_worktrees/`.
