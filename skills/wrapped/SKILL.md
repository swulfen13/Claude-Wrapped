---
name: wrapped
description: Show the user's Claude Code usage with ccyear. Builds their year-in-review report, opens the live localhost dashboard or the desktop token widget. Use when the user asks about their Claude Code stats, tokens used, models used, most active hours, their "Wrapped", or wants a usage dashboard.
---

# ccyear

ccyear reads the session logs Claude Code keeps in `~/.claude/projects` and turns them into stats. Everything runs locally and nothing is uploaded unless the user joins a leaderboard.

Pick the command that matches what the user asked for:

| They want | Run |
| --- | --- |
| A quick answer ("how many tokens did I use this year?") | `npx @swulfen/ccyear --json --no-open` and answer from the JSON |
| Their Wrapped / year in review | `npx @swulfen/ccyear` (add `--name "<name>"` if you know it, `--all` for all time, `--year 2025` for another year) |
| A live dashboard | `npx @swulfen/ccyear serve`, then point them to http://localhost:4747 |
| A small live token counter on their desktop | `npx @swulfen/ccyear widget` |
| Token stats in Claude Code's status bar | `npm i -g @swulfen/ccyear` then `ccyear statusline --install` (ask before replacing an existing status line, which needs `--force`) |
| A warning when they spend too much | `npx @swulfen/ccyear budget --usd <amount>` or `--tokens <amount>` |
| A spreadsheet of their usage, for example per client project | `npx @swulfen/ccyear export --by project` (or `day`, `model`, `session`) |
| A badge for their GitHub profile | `npx @swulfen/ccyear badge --metric tokens` |
| Their achievements or coding style | `npx @swulfen/ccyear --json --no-open` and read `achievements` and `archetype` |
| A leaderboard with friends | Use the `leaderboard-setup` skill |

Notes:

- `serve` and `widget` keep running. Start them in the background and tell the user how to stop them.
- If they plan to share the report or card, suggest `--anonymize` to hide project names.
- The cost figure is an estimate at API list prices. Subscription users don't pay it, so say that whenever you mention it.
- If no logs are found, they may use a custom config folder. Ask, then pass it with `--dir`.
