# BIT (Browser Interactions Testing)

Playwright-based end-to-end tests for the Bitwarden browser extension's content-script-injected experiences: autofill, inline menu, and notification bar. Tests run against real MV3 builds loaded as unpacked extensions in Chromium, using static HTML form patterns hosted by a local [test-the-web](https://github.com/bitwarden/test-the-web) site.

## Key Concepts

- **Test Pages** (`PageTest`) — Declarative objects in the `testPages` array defining a URL, input selectors, expected fill values, and skip/behavior flags. This array is the single source of truth for all static test scenarios.
- **Page Ciphers** (`PageCipher`) — Vault items seeded for each test page. Must stay **1:1** with `testPages`.
- **Inline Menu** — The extension's overlay UI (`button.html`/`menu.html`) injected into page iframes when an input is focused.
- **Notification Bar** — The extension's `notification/bar.html` iframe injected after form submission to prompt saving or updating credentials.
- **Message Autofill** — A "blind" autofill triggered via `chrome.tabs.sendMessage` without user interaction with the inline menu.
- **skipTests** — Per-page mechanism to mark known failures with a ticket number (e.g., `PM-8693`). **Never use `test.skip()` in spec files.**
- **onlyTest** — Debug flag on a `PageTest` entry; when set and debug mode is active, only that page runs.

## Architecture

- `pretest` compiles `tests/` (TS) into `tests-out/` (JS)
- Playwright launches Chromium with `--load-extension`
- `fixtures.browser.ts` logs into vault, exposes context
- 3 static specs: autofill-forms, inline-menu, notifications — all loop over `testPages` via `getPagesToTest()`
- `doAutofill()` triggers fill via `chrome.tabs.sendMessage`
- Static test site (test-the-web) served locally

## Key Principles

1. **Data-driven tests**: All test behavior is defined in the `testPages` and `pageCiphers` arrays. Spec files contain no page-specific logic.
2. **Single worker**: Tests run with `workers: 1` due to MV3 extension constraints (one extension instance per browser context).
3. **Chromium only**: No Firefox/WebKit support.

## Adding a New Test Page

1. Create the HTML page in [test-the-web](https://github.com/bitwarden/test-the-web)
2. Add a `testPages` entry in `constants/test-pages.ts` — see existing entries for shape
3. Add a matching `pageCiphers` entry in `constants/vault-ciphers.ts` — URLs and field values must match
4. Re-seed the vault: `npm run seed:vault:ciphers`
5. Run tests to verify: `npm run test:static:debug`

## Patterns

- **Iframe inputs**: Use an async `selector` function returning `page.frameLocator(...).locator(...)`. Add `preFillActions` for setup like dialog acceptance. See the `iframe-login` entry in `constants/test-pages.ts`.
- **Multi-step forms**: Link inputs with `multiStepNextInputKey` to press Enter between steps. See the `hidden-login` entry in `constants/test-pages.ts`.
- **Known failures**: Always use `skipTests` on the `PageTest` entry with a ticket number comment. Never use `test.skip()` in spec files.
- **Expected non-fill**: Use `shouldNotAutofill`, `shouldNotHaveInlineMenu`, `shouldNotTriggerNewNotification` flags to express **expected behavior**, not failures.
- **`defaultGotoOptions` and `defaultWaitForOptions`**: Always use these from `constants/settings.ts` instead of custom timeouts.

## Running Tests

```bash
# First-time setup (requires Docker)
cp .env.example .env          # then populate values
nvm install                   # or manually use node 23.11.x
npm run setup:all             # clones clients, generates certs, creates account, seeds vault

# Build the extension under test
npm run build:extension       # MV3 dev build
npm run build:extension:prod  # MV3 prod build

# All static tests
npm run test:static           # headed
npm run test:static:debug     # with Playwright inspector
npm run test:static:headless  # headless (currently broken with MV3)

# Individual test suites
npm run test:static:autofill
npm run test:static:inline-menu
npm run test:static:notification

# Single spec file
npm run pretest && NODE_EXTRA_CA_CERTS=ssl.crt npx playwright test tests/static/autofill-forms.spec.ts

# Public (live site) tests
npm run test:public:debug

# Accessibility tests
npm run test:a11y:browser
npm run test:a11y:web

# Utilities
npm run prettier:fix          # format all files
npm run typecheck             # typecheck scripts/ and tests/
npm run setup:vault           # create account + seed vault
npm run seed:vault:ciphers    # seed vault only (account must exist)
```

## Test Environment

- **Docker Compose**: Runs `ghcr.io/bitwarden/lite` (self-hosted unified) + MariaDB 12
- **SSL**: Self-signed certs generated via `npm run setup:ssl`, must be trusted in system keychain. `NODE_EXTRA_CA_CERTS=ssl.crt` is required for all test commands (baked into npm scripts).
- **Feature flags**: `flags.json` at project root, synced from remote vault config via `npm run setup:flags`
- **Test site**: Cloned from `bitwarden/test-the-web`, served locally via `npm run start:test-site`
- **Bitwarden CLI**: `@bitwarden/cli` installed globally, used for vault seeding via `bw serve`

## Debug Helpers

- Set `onlyTest: true` on a `testPages` entry to run only that page (debug mode only)
- Set `START_FROM_TEST_URL=<url>` env var to skip pages before the specified URL
- Use `npm run test:static:debug` for Playwright inspector
- Screenshots saved to `screenshots/` per input fill attempt
- Videos saved to `tests-out/videos/` (disable with `DISABLE_VIDEO=true`)

## Security Rules

1. **No real credentials in test data**: All vault passwords are fake (e.g., `"fakeBasicFormPassword"`). Prefix test credential values with `fake`.
2. **No secrets in source**: Crypto material, master password hashes, and API keys live only in `.env` (gitignored). Generated by `npm run setup:crypto` — never set manually.
3. **Zero-knowledge invariant**: Account creation in `create-account.ts` sends a pre-hashed master password and encrypted key material — never the plaintext password — to the server API.
4. **Downloads disabled**: The browser fixture sets `acceptDownloads: false`.

## Do / Don't

- **DO** keep `testPages` and `pageCiphers` arrays in sync (1:1 correspondence)
- **DO** use `preFillActions` for setup steps needed before interacting with an input
- **DO** use async locator functions in `selector` for inputs inside iframes or shadow DOM
- **DON'T** add page-specific test logic in spec files — all behavior belongs in `testPages` data
- **DON'T** hardcode extension IDs or URLs — use `extensionId` from the fixture
- **DON'T** use parallel workers — MV3 requires `workers: 1`
- **DON'T** commit `.env` or crypto values
