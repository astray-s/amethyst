# Security model

Amethyst is a personal focus tool, not a device-management or parental-control system. Its blocking behavior depends on Android facilities that the device owner can revoke or bypass.

## Assets worth protecting

- app-usage history and derived focus scores;
- selected blocked apps and schedules;
- device-interaction timestamps used for local score estimates;
- notification content;
- release signing material;
- the integrity of rule and timer state.

## Trust boundaries

### Web interface to native bridge

The WebView is not allowed to assume a native action succeeded. Native calls should validate inputs and return explicit states for success, denial, unavailability, and failure.

### App to Android system services

Usage Access, Accessibility Services, package visibility, notifications, and boot receivers are controlled by Android and the user. Permission state can change at any time.

### Local data to backup and device transfer

Android backup and device-transfer restore are disabled for Amethyst. Reset and
uninstall are the supported ways to remove its private local state.

### Build system to release artifact

Debug APKs and CI artifacts are not trusted releases. The release script
requires a clean tagged commit, matching package and Android versions, and a
private signing key stored outside the repository. APK checksums and signing
certificate fingerprints are public identifiers; the key file and passwords
must remain private.

## Current protections

- Android services and receivers intended for internal use are not exported.
- Android backup is disabled.
- Native rule and timer inputs are validated and focus durations are bounded below 24 hours.
- Android settings, system packages, and Amethyst itself are excluded from blocking.
- Release builds fail closed when private signing is unavailable.
- CI uses frozen npm installs and runs lint, tests, builds, and Android lint.
- CodeQL and dependency review inspect incoming changes.
- SBOM generation records JavaScript and Android dependency information.

These controls reduce risk but do not replace device testing or outside review.

## Known gaps

- Release publication and signing-key rotation are manual.
- The device-based score has no completed long-term calibration study.
- There is no crash reporting or telemetry, so user-reported failures may be harder to diagnose.
- A full-day soak, reboot pass, storage-corruption pass, and wider device matrix remain outstanding.
- Accessibility blocking is user-revocable and is not tamper-resistant.

## Logging and crash reports

Do not log installed-app lists, usage events, score inputs, active block rules, or stable device identifiers. If crash reporting is added, it should be opt-in where required, strip sensitive fields, document retention, and provide a way to disable collection.

## Security review checklist

For permission, storage, bridge, or background-service changes:

1. Identify the data and privilege involved.
2. Define the misuse case.
3. Validate every input crossing the bridge.
4. Test denial, revocation, and malformed input.
5. Check exported components and intent filters.
6. Confirm logs contain no sensitive payload.
7. Update the privacy and permission documentation.
