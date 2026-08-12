/** Pure helpers, kept free of pi imports so test.ts can run under tsx. */
export const PR_URL = /https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+/g;
const MAX_SHOWN = 5;

export type State = "OPEN" | "MERGED" | "CLOSED";

export interface Pr {
	number: number;
	title: string;
	state: State;
}

/** url -> pr */
export type Prs = Map<string, Pr>;

/** Display order: open work first, then landed, then abandoned. */
export const STATES: State[] = ["OPEN", "MERGED", "CLOSED"];
export type Color = "success" | "accent" | "error";
export const STYLE: Record<State, { icon: string; color: Color }> = {
	OPEN: { icon: "●", color: "success" },
	MERGED: { icon: "✔", color: "accent" },
	CLOSED: { icon: "✕", color: "error" },
};

/** One row of `gh pr checks --json ...` — a workflow job on the PR's head commit. */
export interface Check {
	name: string;
	state: string;
	bucket: string;
	link: string;
	workflow?: string;
	description?: string;
	startedAt?: string;
	completedAt?: string;
}

/** Failures first: that is the only reason anyone opens this picker. */
const BUCKETS = ["fail", "pending", "pass", "cancel", "skipping"];
const BUCKET_ICON: Record<string, string> = {
	fail: "✕",
	pending: "●",
	pass: "✔",
	cancel: "⊘",
	skipping: "○",
};

function duration(from?: string, to?: string): string {
	const start = from ? Date.parse(from) : Number.NaN;
	const end = to ? Date.parse(to) : Number.NaN;
	if (Number.isNaN(start) || Number.isNaN(end) || end < start) return "";
	const s = Math.round((end - start) / 1000);
	return s < 60
		? `${s}s`
		: `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
}

/** Sorted so the picker reads top-down: broken, running, then the boring ones. */
export function checks(stdout: string): Check[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(stdout);
	} catch {
		return [];
	}
	if (!Array.isArray(parsed)) return [];
	return (parsed as Check[])
		.filter((c) => c?.name)
		.sort(
			(a, b) =>
				BUCKETS.indexOf(a.bucket) - BUCKETS.indexOf(b.bucket) ||
				a.name.localeCompare(b.name),
		);
}

/** Everything worth knowing before pressing enter: outcome, job, workflow, time, error. */
export function checkLabel(c: Check, now: number = Date.now()): string {
	const icon = BUCKET_ICON[c.bucket] ?? "·";
	const workflow =
		c.workflow && c.workflow !== c.name ? ` (${c.workflow})` : "";
	const took =
		duration(c.startedAt, c.completedAt) ||
		(c.bucket === "pending"
			? duration(c.startedAt, new Date(now).toISOString())
			: "");
	const state = c.state ? c.state.toLowerCase() : c.bucket;
	const tail = [state, took, c.description].filter(Boolean).join(" · ");
	return `${icon} ${c.name}${workflow} — ${tail}`;
}

export function candidates(text: string): string[] {
	return [...new Set(text.match(PR_URL) ?? [])];
}

export function sorted(prs: Prs): [string, Pr][] {
	return [...prs].sort(
		(a, b) =>
			STATES.indexOf(a[1].state) - STATES.indexOf(b[1].state) ||
			a[1].number - b[1].number,
	);
}

export function format(
	prs: Prs,
	link: (text: string, url: string) => string,
	paint: (color: Color, text: string) => string = (_c, t) => t,
): string | undefined {
	if (prs.size === 0) return undefined;
	const all = sorted(prs);
	const shown = all.slice(0, MAX_SHOWN);
	const rest = all.length - shown.length;

	const groups = STATES.map((state) => {
		const members = shown.filter(([, pr]) => pr.state === state);
		if (members.length === 0) return "";
		const links = members
			.map(([url, pr]) => link(`#${pr.number}`, url))
			.join(" ");
		return paint(STYLE[state].color, `${STYLE[state].icon} ${links}`);
	}).filter(Boolean);

	return `PR ${groups.join(" ")}${rest > 0 ? ` +${rest}` : ""}`;
}
