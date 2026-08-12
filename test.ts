import assert from "node:assert/strict";
import test from "node:test";

import {
	candidates,
	checkLabel,
	checks,
	format,
	type Prs,
	type State,
} from "./core.ts";

const url = (n: number) =>
	`https://github.com/ExodusMovement/qa-agents/pull/${n}`;
const plain = (t: string) => t;

function make(entries: [number, State][]): Prs {
	const prs: Prs = new Map();
	for (const [n, state] of entries)
		prs.set(url(n), { number: n, title: `pr ${n}`, state });
	return prs;
}

test("checks sorts failures first, then running, and survives junk", () => {
	const json = JSON.stringify([
		{ name: "lint", bucket: "pass" },
		{ name: "e2e", bucket: "pending" },
		{ name: "build", bucket: "fail" },
		{ name: "docs", bucket: "skipping" },
		{ bucket: "fail" },
	]);
	assert.deepEqual(
		checks(json).map((c) => c.name),
		["build", "e2e", "lint", "docs"],
	);
	assert.deepEqual(checks("not json"), []);
});

test("checkLabel shows outcome, workflow, duration and failure reason", () => {
	assert.equal(
		checkLabel({
			name: "build",
			workflow: "CI",
			bucket: "fail",
			state: "FAILURE",
			link: "https://github.com/o/r/actions/runs/1",
			description: "exit code 1",
			startedAt: "2024-01-01T00:00:00Z",
			completedAt: "2024-01-01T00:01:12Z",
		}),
		"✕ build (CI) — failure · 1m12s · exit code 1",
	);
});

test("checkLabel times a running check against now", () => {
	assert.equal(
		checkLabel(
			{
				name: "e2e",
				workflow: "e2e",
				bucket: "pending",
				state: "IN_PROGRESS",
				link: "https://github.com/o/r/actions/runs/2",
				startedAt: "2024-01-01T00:00:00Z",
			},
			Date.parse("2024-01-01T00:00:30Z"),
		),
		"● e2e — in_progress · 30s",
	);
});

test("candidates dedupes pull urls and ignores other paths", () => {
	assert.deepEqual(candidates(`opened ${url(604)} and ${url(604)} again`), [
		url(604),
	]);
	assert.deepEqual(
		candidates("https://github.com/o/r/issues/5 nothing here"),
		[],
	);
});

test("format returns undefined when there is nothing to show", () => {
	assert.equal(format(new Map(), plain), undefined);
});

test("format groups by state, open first, ascending inside a group", () => {
	const prs = make([
		[590, "CLOSED"],
		[598, "MERGED"],
		[612, "OPEN"],
		[604, "OPEN"],
	]);
	assert.equal(format(prs, plain), "PR ● #604 #612 ✔ #598 ✕ #590");
});

test("format drops the least interesting states on overflow and counts the rest", () => {
	const prs = make([
		[590, "CLOSED"],
		[598, "MERGED"],
		[612, "OPEN"],
		[604, "OPEN"],
		[700, "CLOSED"],
		[701, "CLOSED"],
	]);
	assert.equal(format(prs, plain), "PR ● #604 #612 ✔ #598 ✕ #590 #700 +1");
});

test("paint wraps each state group, never the whole line", () => {
	const prs = make([
		[590, "CLOSED"],
		[598, "MERGED"],
		[604, "OPEN"],
	]);
	assert.equal(
		format(prs, plain, (color, t) => `<${color}>${t}</>`),
		"PR <success>● #604</> <accent>✔ #598</> <error>✕ #590</>",
	);
});
