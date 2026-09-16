# Security policy

Amethyst handles signals that can reveal personal routines, including app usage and focus activity. Security reports are welcome, even while the project is pre-release.

## Supported versions

| Version | Security updates |
| --- | --- |
| Latest `0.x` release | Yes |
| Current `main` branch | Yes |
| Development builds and old commits | No |

## Report a vulnerability

Please use GitHub private vulnerability reporting if it is enabled for this repository. Otherwise, contact a maintainer privately through the contact method listed on their GitHub profile.

Do not open a public issue for:

- a way to bypass or escape an active block;
- exposure or corruption of usage, score, or focus data;
- an exported Android component that should be private;
- a permission or intent flow that can be abused;
- leaked signing material, tokens, or personal data;
- a vulnerable dependency with a practical exploit in Amethyst.

Include the affected commit, Android version and device when relevant, reproduction steps, impact, and any suggested mitigation. Please avoid accessing data that is not yours.

## What happens next

Maintainers will reproduce the issue, assess its reach, and coordinate a fix and disclosure. Public detail may be delayed until users have a reasonable chance to update.

## Current security limits

Release APKs are signed with a maintainer key stored outside the repository, and
the release script refuses dirty, untagged, unsigned, or version-mismatched
builds. A focused source, sanitized Git-history, workflow-log, and APK secret
scan was completed on September 15, 2026.

That review is not a guarantee that the app is vulnerability-free. Release
publication is still manual, there is no key-rotation process, and browser tests
do not validate native Android enforcement. Read
[docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md) for the current boundaries and
known gaps.
