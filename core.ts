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
