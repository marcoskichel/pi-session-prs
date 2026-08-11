# pi-session-prs

A [pi](https://github.com/badlogic/pi-mono) extension that lists the GitHub PRs of the current session in the footer, grouped by state: `● open`, `✔ merged`, `✕ closed`. Numbers are clickable. A url only counts once `gh pr view` confirms the PR exists, so pasted or hypothetical numbers never show up.

PRs are picked up from the session transcript, from tool results, and from `gh pr list` for the current branch. States refresh while the session runs.

## Install

```bash
pi install npm:pi-session-prs
```

Or add a local checkout to `~/.pi/agent/settings.json`:

```json
{
  "extensions": ["/path/to/pi-session-prs/index.ts"]
}
```

## Usage

- The footer shows `PR ● #604 #612 ✔ #598 ✕ #590`, up to 5 entries plus a `+n` overflow count.
- `/prs` — pick a PR from this session and open it in the browser.

## Requirements

The [`gh` CLI](https://cli.github.com), authenticated.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md).
