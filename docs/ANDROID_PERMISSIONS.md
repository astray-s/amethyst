# Android permissions and policy

Amethyst asks Android for capabilities that can expose personal routines or affect how other apps are used. Every capability needs a clear user benefit, a timely explanation, and a working off switch.

This document is engineering guidance, not legal advice or a guarantee of safe behavior on every device.

## Current declarations

| Capability | Why the app may need it | Release concern |
| --- | --- | --- |
| Internet | Load web content inside the Capacitor shell and support future network features | Document every production endpoint and avoid sending usage data by default |
| Usage Access | Read aggregate app usage for screen-time views and rules | User must grant access in system settings; data handling needs a privacy disclosure |
| Accessibility Service | Observe foreground-app changes and present the blocking flow | High scrutiny; requires prominent disclosure, narrow behavior, and real-device testing |
| Notifications | Notify about active or scheduled focus behavior | Request only when a notification feature needs it |
| Launcher/browser package queries | Discover launchable apps for rule selection and four supported Chromium browsers | Keep the query list narrow and review additions |
| Receive boot completed | Restore schedules after restart | Work must stay predictable and avoid hidden background behavior |
| Exact alarms | Start and end enabled rules at the intended minute when Android grants special access | Fall back to inexact alarms and show the current precision |

## Release gates

Before any public sideload release:

1. Confirm the narrow launcher/browser queries still cover the supported device matrix.
2. Write the in-app prominent disclosure for Accessibility Service use.
3. Confirm that the Accessibility Service performs only user-requested focus behavior.
4. Keep the plain-language privacy notice aligned with the shipped code.
5. Verify permission denial, revocation, and re-grant flows.
6. Test on supported Android versions and at least one restrictive battery-management device.
7. Record deletion, backup, retention, and export behavior for usage and score data.
8. Re-run the manifest, exported-component, log, and network review against the final APK.

## Accessibility Service principles

- Never enable it silently.
- Never claim that a permission is ready until Android confirms it.
- Give the user a direct route to the correct system settings page.
- Keep the service disabled when no user-created rule needs it.
- Read only foreground package changes and known supported-browser address-bar view IDs; do not inspect messages, passwords, or unrelated screen content.
- Make escape and emergency behavior deliberate and testable.

## Device-based scoring

Amethyst derives its Sleep, Focus, Rest, and overall scores from Usage Access
signals already used by the screen-time experience. The Sleep dimension estimates
an overnight device-free window; it must never be described as measured sleep or
as a health insight.

Scoring changes should:

- use only granted, locally available signals;
- exclude missing inputs instead of inserting defaults;
- keep the formula version explicit;
- explain measured versus derived values in the interface;
- test denied, partial, and stale-data states;
- avoid adding another sensitive permission solely to fill a score field.

## Testing matrix

Native permission changes should cover:

- first launch with no access;
- grant and return to the app;
- denial and repeated denial;
- revocation while the app is open;
- revocation while a schedule is active;
- device restart;
- app update with existing local data;
- uninstall and reinstall;
- offline use.
