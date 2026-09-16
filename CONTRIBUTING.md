# Contributing to Amethyst

Thanks for taking the time to improve Amethyst. The most useful contributions are small enough to review carefully and honest about what was tested.

## Before you begin

Please read:

- the [Code of Conduct](CODE_OF_CONDUCT.md);
- the [architecture guide](docs/ARCHITECTURE.md);
- the [security model](docs/SECURITY_MODEL.md);
- the [Android permissions guide](docs/ANDROID_PERMISSIONS.md) for native work.

For a bug or feature proposal, search existing issues before opening a new one. Security problems belong in the private reporting path described in [SECURITY.md](SECURITY.md).

## Development setup

Use Node.js 24 and install exactly from the lockfile:

```bash
git clone https://github.com/astray-s/amethyst.git
cd amethyst
npm ci
```

For Android work, also install JDK 21 and Android SDK API 36.

Common commands:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the browser development server |
| `npm run lint` | Run the JavaScript and TypeScript linter |
| `npm test` | Run unit and component tests once |
| `npm run test:e2e` | Run Playwright browser tests |
| `npm run build` | Type-check and build the web bundle |

Run the Android checks with:

```bash
npm run build
npx cap sync android
cd android
./gradlew testDebugUnitTest lintDebug assembleDebug
```

Capacitor sync may update generated Android web assets. Review the resulting changes and do not mix unrelated generated output into a pull request.

## Branch naming

Use a short prefix that reflects the type of change, followed by a slug:

| Prefix | When to use |
| --- | --- |
| `feat/` | New user-facing feature |
| `fix/` | Bug fix |
| `docs/` | Documentation only |
| `refactor/` | Code change that is not a fix or feature |
| `test/` | Adding or fixing tests |
| `chore/` | Build, CI, tooling, dependency updates |
| `security/` | Security hardening, permission changes |

Example: `feat/focus-session-timer`, `fix/block-overlay-dismiss`, `docs/android-permissions`.

## Commit message format

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <short summary>

<optional body — explain the why, not the what>

<optional footer — breaking changes, issue refs>
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `security`, `perf`, `ci`

**Examples:**

```
feat(focus): add 25-minute Pomodoro preset
fix(blocking): prevent overlay dismiss via back gesture during session
docs(scoring): clarify device-based sleep estimate
security(android): restrict exported intent filters to package
```

Rules:
- Summary line ≤ 72 characters, lowercase after the colon, no trailing period
- Use the body to explain *why*, not *what* — the diff shows the what
- Reference issues with `Closes #123` or `Fixes #456` in the footer
- Mark breaking changes: `BREAKING CHANGE: <description>` in the footer

## Pull requests

Keep each pull request focused. Explain:

- what changed and why;
- which commands you ran;
- what you did not test;
- screenshots or a recording for visible interface changes;
- device and Android version for native behavior;
- any new data collection, permission, network request, exported component, or background behavior.

Please do not describe a browser mock as proof that native blocking, usage access, scheduling, or scoring works.

Open your PR against `main`. Squash or tidy commits before requesting review if the history is noisy.

## Tests and quality

New logic should normally have tests. Bug fixes should include a regression test when the failure can be reproduced reliably.

CI is the baseline, not the full definition of done. Permission changes, Accessibility Service changes, and blocking behavior need testing on a real Android device.

## Code style

The project uses [oxlint](https://oxc.rs/docs/guide/usage/linter.html) for linting and [TypeScript strict mode](https://www.typescriptlang.org/tsconfig#strict). CI enforces both.

- Run `npm run lint` before pushing
- Run `npm run build` to catch TypeScript errors
- Avoid `any` types; prefer explicit type annotations on public-facing interfaces
- Keep components small and focused; put shared logic in `src/state/` or `src/native/`

## Issue reporting

Search existing issues before filing. Use the structured issue templates — they keep reports actionable:

- **[Bug report](https://github.com/astray-s/amethyst/issues/new?template=bug_report.yml)** — reproducible behavior that is not working as intended
- **[Feature request](https://github.com/astray-s/amethyst/issues/new?template=feature_request.yml)** — focused improvement proposals

For security vulnerabilities, **do not open a public issue** — follow [SECURITY.md](SECURITY.md) instead.

## Licensing contributions

By submitting a contribution, you agree that code and documentation you contribute may be distributed under Apache-2.0.

Only submit artwork you created or have the right to contribute. New original artwork should be recorded in [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md) and contributed under CC BY 4.0. Third-party assets need a compatible license, source link, author, and required attribution.

## Commit hygiene

Write clear commit messages, avoid drive-by formatting, and never commit credentials, signing keys, private usage data, generated reports containing personal paths, or local Android configuration files.
