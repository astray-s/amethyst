# Changelog

All notable changes to Amethyst will be recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The project intends to use [Semantic Versioning](https://semver.org/) once public releases begin.

## [Unreleased]

## [0.1.0] - 2026-09-15

### Added

- Timed focus sessions, recurring schedules, and Accessibility-based app blocking.
- Daily screen-time views and device-only Sleep, Focus, Rest, and Amethyst scores.
- App groups, per-app rules, permission onboarding, local export, and reset.
- CI for browser tests, Android tests, lint, builds, dependency review, CodeQL, and SBOM generation.
- A guarded signed-release script that builds only from a clean matching version tag.
- Six original high-resolution collectible gems and gem-based Android launcher and splash artwork.

### Fixed

- Normalized Android usage events into one bounded total per calendar day.
- Rebuilt the 14-day profile graph so every day remains visible and the scale follows daily values.
- Filled score detail rows from real local history instead of leaving empty bars.
- Protected Android settings, system packages, and Amethyst itself from blocking rules.
- Bounded focus timers below 24 hours and hardened malformed native bridge inputs.
- Isolated browser tests from unrelated local development servers and completed the Android dependency inventory before SBOM upload.

### Security

- Disabled Android backup and restricted internal Android components from external launch.
- Added emergency-stop, timer-boundary, protected-package, and release-signing tests.
- Removed release fallback to the Android debug key.
- Replaced undocumented visual assets and recorded the source and generation path for every distributed artwork file.

### Known limitations

- Device-based score thresholds still need broader long-term calibration.
- A full-day device soak and a wider Android device matrix are still outstanding.
- Release publication is manual, and there is no signing-key rotation process yet.
