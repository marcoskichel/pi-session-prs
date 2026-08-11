/**
 * Footer status listing the GitHub PRs belonging to this session, grouped by state
 * (● open, ✔ merged, ✕ closed), plus `/prs` to open one in the browser.
 *
 * A url only counts once `gh pr view` confirms it exists, so pasted or hypothetical
 * numbers never reach the footer.
 */

import { readFileSync } from "node:fs";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { hyperlink } from "@earendil-works/pi-tui";

import {
	candidates,
	format,
	type Prs,
	STYLE,
	type State,
	sorted,
} from "./core.ts";

const GH_TIMEOUT_MS = 15_000;
const STATE_TTL_MS = 60_000;

/** A fresh session has no transcript on disk yet, so the file is routinely missing. */
function readSession(file: string | undefined): string {
	if (!file) return "";
	try {
		return readFileSync(file, "utf8");
	} catch {
		return "";
	}
}

export default function (pi: ExtensionAPI) {
	const prs: Prs = new Map();
	const rejected = new Set<string>();
	let statesCheckedAt = 0;

	const render = (ctx: ExtensionContext) => {
		const text = format(prs, hyperlink, (color, t) =>
			ctx.ui.theme.fg(color, t),
		);
		ctx.ui.setStatus("pr", text);
	};

	/** Never throws: a flaky gh call must not take the pi process (and its tmux pane) down. */
	const lookup = async (ctx: ExtensionContext, url: string) => {
		try {
			const res = await pi.exec(
				"gh",
				["pr", "view", url, "--json", "number,title,state"],
				{
					cwd: ctx.cwd,
					timeout: GH_TIMEOUT_MS,
				},
			);
			if (res.code !== 0) return undefined;
			const pr = JSON.parse(res.stdout) as {
				number: number;
				title: string;
				state: State;
			};
			return STYLE[pr.state] ? pr : undefined;
		} catch {
			return undefined;
		}
	};

	const add = async (ctx: ExtensionContext, urls: string[]) => {
		let changed = false;
		for (const url of urls) {
			if (prs.has(url) || rejected.has(url)) continue;
			const pr = await lookup(ctx, url);
			if (!pr) {
				rejected.add(url);
				continue;
			}
			prs.set(url, pr);
			changed = true;
		}
		return changed;
	};

	/** States drift (a PR gets merged while the session runs), so re-poll on a timer. */
	const refreshStates = async (ctx: ExtensionContext) => {
		if (Date.now() - statesCheckedAt < STATE_TTL_MS) return false;
		statesCheckedAt = Date.now();
		let changed = false;
		for (const [url, known] of prs) {
			const pr = await lookup(ctx, url);
			if (pr && pr.state !== known.state) {
				prs.set(url, pr);
				changed = true;
			}
		}
		return changed;
	};

	const branchUrls = async (ctx: ExtensionContext) => {
		const opts = { cwd: ctx.cwd, timeout: GH_TIMEOUT_MS };
		try {
			const branch = (
				await pi.exec("git", ["rev-parse", "--abbrev-ref", "HEAD"], opts)
			).stdout.trim();
			if (!branch) return [];
			const res = await pi.exec(
				"gh",
				["pr", "list", "--head", branch, "--json", "url"],
				opts,
			);
			return res.code === 0 ? candidates(res.stdout) : [];
		} catch {
			return [];
		}
	};

	pi.on("session_start", async (_e, ctx) => {
		prs.clear();
		rejected.clear();
		statesCheckedAt = Date.now();
		const seen = candidates(readSession(ctx.sessionManager.getSessionFile()));
		await add(ctx, [...seen, ...(await branchUrls(ctx))]);
		render(ctx);
	});

	pi.on("tool_execution_end", async (event, ctx) => {
		const text =
			typeof event.result === "string"
				? event.result
				: JSON.stringify(event.result);
		if (text && (await add(ctx, candidates(text)))) render(ctx);
	});

	pi.on("agent_settled", async (_e, ctx) => {
		const found = await add(ctx, await branchUrls(ctx));
		if ((await refreshStates(ctx)) || found) render(ctx);
	});

	pi.registerCommand("prs", {
		description: "Open a PR from this session in the browser",
		handler: async (_args, ctx) => {
			statesCheckedAt = 0;
			if (await refreshStates(ctx)) render(ctx);
			const all = sorted(prs);
			if (all.length === 0)
				return ctx.ui.notify("No PRs in this session", "info");
			const labels = all.map(
				([, pr]) => `${STYLE[pr.state].icon} #${pr.number} ${pr.title}`,
			);
			const picked = await ctx.ui.select("Open PR", labels);
			const entry = picked ? all[labels.indexOf(picked)] : undefined;
			if (entry) {
				await pi
					.exec("open", [entry[0]], { timeout: GH_TIMEOUT_MS })
					.catch(() => {});
			}
		},
	});
}
