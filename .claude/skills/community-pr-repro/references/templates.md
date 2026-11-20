# Templates

## Repro brief (`repro/<id>/brief.md`)

```markdown
# Repro brief - clients#<PR or issue>

**PR:** <title> (<author>, fork: yes/no) · **Issue:** #<issue> · **Ticket:** <PM-xxxxx>
**Changed files:** <paths>

## Bug

- **Trigger:** <how the user fills: inline menu, keyboard shortcut, popup, page load>
- **Expected:** <what a correct fill does>
- **Predicted actual on main:** <based on the code; unverified until Step 3>
- **Conditions:** <browser, http(s), iframe/shadow DOM, async options, etc.>
- **Setup sequence before fill:** <ordered steps, e.g. 1. load page 2. trigger collection 3. change Country 4. fill - or "none">

## Test mapping

- **TestNames key:** <MessageAutofill | InlineMenuAutofill | ...>
- **Run command:** <npm run test:static:autofill>
- **Cipher type:** <login | card | identity>
- **Predicted BIT assertion:** <field, expected value, predicted actual value>
- **Evidence / open assumptions:** <file:line references; timing not yet verified>

## Pattern page

- **Reuse existing:** <url> - or - **New:** /forms/<category>/<slug>
- **Real-world case it abstracts:** <one line>
```

Example (clients#23906): trigger = identity autofill; expected = State `<select>` filled after Country change rebuilds its options; predicted actual on main = select left empty because cached `selectInfo.options` is stale; use `NY` to match BIT's seeded identity, or seed a new value; key = `MessageAutofill`; cipher = identity; setup sequence = load with the first country's options, wait ~750 ms for the first collection, focus a field, replace State's options in place (keep the `<select>` node), then fill (goes in the first input's `preFillActions`); new page = `/forms/identity/<slug>` with a State select repopulated on Country change.

## Verification report (`repro/<id>/report.md`)

```markdown
# Verification - clients#<PR>

**Result:** PASS on PR / STILL FAILS on PR / BASELINE ONLY (no PR) · **Date:** YYYY-MM-DD
**main build:** clients@<sha> · **PR build:** clients@<sha>

| Check              | main          | PR    |
| ------------------ | ------------- | ----- |
| Reproduced by hand | ✗ bug present | -     |
| BIT entry `<url>`  | ✗ <assertion> | ✓ / ✗ |

## Videos

- Live site (if any): `site.webm` · Manual repro on main: `manual-main.webm`
- BIT on main: `main/` · BIT on PR: `pr/`

## What was added

- Pattern page: `test-site/client/docs/forms/<category>/<slug>.md`
- BIT entry: `constants/test-pages.ts`, `constants/vault-ciphers.ts` (skip `<Key>` // @TODO <ticket> until merge)
- Skip removal: <who> removes it once the fix reaches main; BIT run green without it: <yes / pending>

## For the human reviewer

- <what the test does and doesn't cover>
- <anything in the diff the test can't speak to>
```
