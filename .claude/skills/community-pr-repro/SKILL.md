---
name: community-pr-repro
description: Use when a community PR or bug report on bitwarden/clients concerns an autofill bug - "repro this PR", "verify community PR 23906", "turn this bug report into a BIT test". Reproduces the bug as a test-the-web pattern page plus a failing BIT entry on main, then (given a PR) builds it and confirms the same entry passes.
---

## Checklist

Complete the items below in order, saying which one you are on as you start it.

- [ ] 1. Read the PR or issue and write the repro brief
- [ ] 2. Start the environment and build `main`
- [ ] 3. Find or add the pattern page and reproduce the bug by hand
- [ ] 4. Add the BIT entry and confirm it fails on `main`
- [ ] 5. Build the PR and confirm the entry passes (skip without a PR)
- [ ] 6. Write the verification report and log learnings

## Inputs

Ask for anything missing before starting.

| Input                                                     | Example                                   | Required                                                                 |
| --------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------ |
| Community PR or bug report (issue) on `bitwarden/clients` | `23906` or `#23905`                       | One of the two                                                           |
| Tracker ticket for the bug                                | `PM-45163` (community PR titles carry it) | Yes - BIT's known-failure skips need it; ask if the PR or issue has none |

## Scope

Turns a community autofill report into end-to-end proof: the bug reproduces on `main`, a BIT test catches it, and (given a PR) the PR's build makes that test pass. The reviewer then spends their time on the contributor's code, not on reproducing the bug.

**One run = one PR or issue.** Pick a bug BIT can assert: a wrong or missing fill, or an inline menu that must not appear at all. A menu showing the wrong cipher type (card instead of identity) needs a type-aware assertion BIT doesn't have yet. A bug no BIT spec asserts today (for example inline menu _position_) needs a new scenario spec - stop at Step 1 and say so. With an issue and no PR, stop after Step 4: the failing entry is the deliverable.

## Prerequisites

Before Step 1, actively verify the teammate's environment is ready. Don't assume — a teammate running this skill for the first time, or on a new machine, may be missing pieces.

1. Run `npm run flightcheck` from `$BIT`. Address every failure before continuing. For common failures the fix maps cleanly to a setup script documented in `$BIT/.claude/CLAUDE.md`:
    - Extension not built → `npm run build:extension`
    - Docker not running → `docker compose up -d --wait`
    - Vault not reachable → check docker status, restart if needed
    - Test site not serveable → `npm run setup:test-site`, then `npm run start:test-site`
    - Missing `.env` vars → `npm run setup:install`, `npm run setup:crypto`, `npm run setup:flags` (which one depends on what's missing)
    - Vault account missing → `npm run setup:vault`

    Run the fix after confirming with the user. For anything destructive (re-seeding the vault, regenerating crypto material, deleting state) or ambiguous (port conflicts, container SHA mismatches, unusual error output), present the diagnosis and the proposed fix to the user and wait for them to decide — don't just run it.

2. Confirm the items flightcheck can't see:
    - `$BIT` is exported in the user's shell. Ask them to run `echo $BIT` and confirm it prints their checkout path.
    - `$BIT/.playwright-mcp-config.json` and `$BIT/.mcp.json` exist. If either is missing, point them to [references/.playwright-mcp-config.example.json](references/.playwright-mcp-config.example.json) and [references/.mcp.example.json](references/.mcp.example.json) — they copy to `$BIT`, replace `<YOUR_BIT_ROOT>` with their absolute BIT path, and restart Claude Code (MCP config is read only at startup).

Do not proceed to Step 1 until flightcheck is clean and both shell/MCP items are confirmed.

The bullets below are the self-serve reference for teammates who want to understand the setup before invoking the skill:

- BIT root (`$BIT`): your local clone of `bitwarden/browser-interactions-testing`. Export it in your shell so later commands work: `export BIT=/absolute/path/to/your/browser-interactions-testing` (add the line to `~/.zshrc` or `~/.bashrc` to persist across terminals). Confirm first-time setup (`npm run setup:all`) is complete before starting.
- `$BIT/clients` - clients checkout BIT builds the extension from (`npm run setup:extension`).
- `$BIT/test-site` - test-the-web checkout BIT serves pages from (`npm run setup:test-site`).
- Playwright MCP: configured at `$BIT/.playwright-mcp-config.json` (wired in `$BIT/.mcp.json`). Chromium launches with `--load-extension` and `--disable-extensions-except` pointed at `$BIT/clients/apps/browser/build`, and `contextOptions.recordVideo` writes to `$BIT/repro/_pending-videos/`. If this config is ever rewritten, restart Claude Code before Step 1 - MCP config is read only at startup. If the files don't exist yet, copy [references/.playwright-mcp-config.example.json](references/.playwright-mcp-config.example.json) to `$BIT/.playwright-mcp-config.json` (replacing `<YOUR_BIT_ROOT>` with your absolute BIT path) and [references/.mcp.example.json](references/.mcp.example.json) to `$BIT/.mcp.json`, then restart Claude Code.
- Branches: direct branches on both repos (`bitwarden/test-the-web` and `bitwarden/browser-interactions-testing`); PRs reviewed by a Bitwarden maintainer. Create one branch in `$BIT/test-site` and one in `$BIT` before Step 3.
- Read `$BIT/.claude/CLAUDE.md`. It owns the rules for `testPages`, `pageCiphers`, `skipTests`, and what never goes in spec files. Don't restate or override it.
- Read [references/learnings.md](references/learnings.md) and apply known fixes first time.

## Step 1 - Read the PR or issue and write the repro brief

```bash
gh pr view <PR> --repo bitwarden/clients --json title,body,files,headRefName,isCrossRepository
gh issue view <ISSUE> --repo bitwarden/clients
```

Map the bug to the BIT test that would catch it. The run command picked here is used in Steps 4 and 5:

| Bug shape                                                    | `TestNames` key                                                                                            | Run command                        |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Blind/keyboard autofill fills wrong or nothing               | `MessageAutofill`                                                                                          | `npm run test:static:autofill`     |
| Inline menu selection fills wrong or nothing                 | `InlineMenuAutofill`                                                                                       | `npm run test:static:inline-menu`  |
| No inline menu should appear on a field, for any cipher type | `InlineMenuAutofill` + `shouldNotHaveInlineMenu` on the **first** input (checks that no menu frame exists) | `npm run test:static:inline-menu`  |
| Save/update notification missing or wrong                    | `NewCredentialsNotification` / `PasswordUpdateNotification`                                                | `npm run test:static:notification` |
| Popup click or page-load fill                                | `PopupAutofill` / `PageLoadAutofill`                                                                       | `npm run test:static:triggers`     |
| Anything else                                                | none - stop, needs a new scenario spec                                                                     | -                                  |

For a bug that depends on page state changing after the extension reads the form (for example `<select>` options rebuilt, or fields inserted), the brief names: the starting DOM, how the first collection completes (the content script collects about 750 ms after load; focus can re-collect), the exact change, and the fill trigger. Trace whether fill-time collection reuses the cached fields or rebuilds them. Without this, the test can pass on `main` and miss the bug.

Write the brief to `$BIT/repro/<id>/brief.md` (local scratch: add `repro/` to `.git/info/exclude` once) using the brief template in [references/templates.md](references/templates.md). Mark behavior on `main` as predicted until Step 3 reproduces it.

## Checkpoint 1 - Brief

```
Repro brief written to `repro/<id>/brief.md`. Please review:
- Is the expected vs actual behavior right?
- Is <TestNames key> / <run command> the test that should catch this?
- Does `<existing page>` already show the bug, or is a new pattern page needed?
Let me know when I should continue.
```

## Step 2 - Start the environment and build `main`

```bash
cd $BIT
docker compose up -d --wait
npm run start:test-site            # leave running in its own terminal
(cd clients && git checkout main && git pull)
npm run build:extension            # writes clients/apps/browser/build
npm run flightcheck
```

Produce: `flightcheck` clean, and the build's `manifest.json` timestamp is from this run.

## Step 3 - Find or add the pattern page and reproduce the bug by hand

1. If the report names a live site, look at it first with Playwright MCP to see the real form structure: observe only - no login, no form submit, no real credentials. Save the MCP video to `repro/<id>/site.webm`. If the site requires authentication to reach the form (e.g. a billing page behind an account login), skip this step and note why in the brief - the PR or issue description should describe the form well enough to build the pattern page from.
2. If the brief named an existing page that shows the bug, use it and skip to item 5.
3. Otherwise create `test-site/client/docs/forms/<category>/<slug>.md`, copying a sibling's frontmatter (`slug`, `title`, `sidebar_label`, `sidebar_position`, `description`). It serves at `/forms/<category>/<slug>`. Abstract the real-world case, no site-specific code, never change an existing pattern's behavior.
4. Rebuild and restart the test-site server so it serves the new page:
    - Rebuild the static site: `(cd test-site && npm run build)`
    - Switch to the terminal that's running `npm run start:test-site` (started in Step 2) and press `Ctrl+C` to stop it
    - Rerun `npm run start:test-site` in that terminal so it picks up the new build
5. Reproduce with Playwright MCP against the `main` build. The MCP config records every Playwright context for its full lifetime (`contextOptions.recordVideo`), so a careless session captures all the setup fumbling. Split the work in two passes so the saved video shows only the repro:

    **Setup pass (recording discarded).** Navigate the popup, unlock with `VAULT_EMAIL`/`VAULT_PASSWORD` from `.env`, verify the test page serves the new pattern, figure out any tab-id or selector details, and resolve every unknown. Then `browser_close` and delete everything in `repro/_pending-videos/` — that pass's video is throwaway.

    **Repro pass (recording kept).** Relaunch the browser. The vault re-locks on every Playwright restart (Bitwarden's default), so one unlock inside the recorded session is unavoidable — do it immediately, then navigate straight to the test page and run only the interactions the brief names, back to back. One `browser_snapshot` per step, not before and after. Close the browser to flush the video, then move it to `repro/<id>/manual-main.webm`. A clean video should be seconds, not minutes.

## Checkpoint 2 - Bug reproduced

```
Using pattern page `/forms/<category>/<slug>` (<new / existing>). On `main`, <trigger> produced <actual> (expected <expected>).
- Does this match the bug that was reported?
- Is the page a fair abstraction of the real-world case?
Let me know when I should continue.
```

Do not write the BIT entry until the bug reproduces by hand.

## Step 4 - Add the BIT entry and confirm it fails on `main`

Follow "Adding a New Test Page" in `$BIT/.claude/CLAUDE.md`, with these additions:

1. Search `constants/test-pages.ts` and `constants/vault-ciphers.ts` for the page URL. If it is already registered, update that pair in place - a second entry seeds a duplicate vault item. Otherwise **append** a `testPages` entry and a matching `pageCiphers` entry, last in each array. Appending keeps seeding safe; inserting mid-array shifts item names and needs `npm run seed:vault:ciphers:refresh`.
2. Set `autofillCommand` for card or identity pages. Express expected values as what a correct fill produces.
3. Put the brief's setup sequence, if any, in the **first** input's `preFillActions` - specs run only that one before filling. Specs catch a pre-fill error and only log `There was a prefill error`, so check the output for it.
4. Every static spec loops over `testPages`. For each `TestNames` key other than the target, decide whether it applies to this page; add the ones that don't to `skipTests` with a reason comment, mirroring a similar existing entry (e.g. the identity entries).
5. Seed and run only the new entry with the run command from Step 1:

```bash
npm run seed:vault:ciphers
START_FROM_TEST_URL="<full page url>" <run command>
```

`START_FROM_TEST_URL` must equal the entry's `url` exactly (`PAGES_HOST` + port + path). It runs that entry and every later one, so the entry must be last; a mismatch runs every page. Confirm the output names only your page.

BIT records each run to `tests-out/videos/`, and the next run's `pretest` deletes it. Copy the videos to `repro/<id>/main/` before running anything else.

Produce: a failure on your page whose message names the field and value the brief predicted. A failure for any other reason (timeout, selector, login) is a harness problem - fix it, don't proceed.

## Checkpoint 3 - Failing for the right reason

```
New entry fails on `main`: <assertion message>. Skips added for: <keys + reasons>.
- Is this the bug, not a harness problem?
- Are the expected values what a correct fill should produce?
Let me know when I should continue.
```

## Step 5 - Build the PR and confirm the entry passes

Skip this step when there is no PR.

```bash
(cd clients && gh pr checkout <PR> && npm ci)
npm run build:extension
START_FROM_TEST_URL="<full page url>" <run command>
(cd clients && git checkout main && npm ci)
```

`npm ci` in `clients/` is required after switching to the PR branch (and again after switching back to `main`): the PR's lockfile may differ from `main`'s, and building with the wrong `node_modules` fails with cross-module TypeScript errors. `npm ci` is deterministic — it installs exactly what the lockfile says without mutating it.

Build locally. Fork PRs leave `build-browser.yml` at `action_required` until a maintainer approves the run, and internal PR builds can fail, so a downloadable artifact is the exception. Copy `tests-out/videos/` to `repro/<id>/pr/` after the run.

Produce: the same entry passes, and the output shows your page ran. If it still fails, the PR does not fix the case as reproduced - record that and go to Step 6.

## Step 6 - Write the verification report and log learnings

1. Fill the report template in [references/templates.md](references/templates.md) at `repro/<id>/report.md`.
2. Until the fix merges, the BIT entry also skips the target key: `skipTests: [TestNames.<Key>]` with `// @TODO <ticket>`, per BIT's known-failures rule. While skipped, the entry is not regression coverage. Name in the report who removes the skip once the fix reaches `main`, and confirm the BIT run goes green without it.
3. Report destination: local file only at `repro/<id>/report.md`. Do not post it anywhere automatically; share the path at Checkpoint 4.
4. Append anything that cost a retry to [references/learnings.md](references/learnings.md).

## Checkpoint 4 - Report

```
Report written to `repro/<id>/report.md`. Result: <PASS on PR / still FAILS on PR / baseline only>.
- Anything to add before it goes to <destination>?
- Should the page and BIT entry be opened as PRs now?
```

## Out of scope for one run

- Batches - one PR or issue per run.
- Bugs no existing spec asserts (inline menu position, timing, performance) - need a new scenario spec first.
- Judging the contributor's code quality or security - a human review still owns that.
- Running the full static suite for regressions - BIT's CI runs it against the PR once a maintainer approves the build.
