# Privacy notice

This notice covers the current open-source Amethyst Android release. Amethyst is
a local-first focus app with no account, hosted backend, analytics SDK, or
advertising service.

## What the app reads

When the user grants the relevant Android access, Amethyst can read:

- installed application names, package names, and icons for rule selection;
- foreground app usage and usage events for screen-time views and device-based scores;
- permission status for usage access, Accessibility Services, notifications, and exact schedules.

The Accessibility Service observes foreground-app changes and, in Chrome, Samsung
Internet, Edge, and Brave, reads the known address-bar field to apply website
rules chosen by the user. It does not intentionally inspect message text,
passwords, or unrelated page content.

## What the app stores

The web layer stores local state in the app WebView, including:

- profile display values and streaks;
- focus presets, active sessions, and session history;
- selected apps, rules, and schedules;
- rewards, settings, permission indicators, and daily score snapshots.

The native Android layer uses private app preferences for rules, groups, timer
timestamps, schedule alarms, Gentle-pause usage, browser-host diagnostics, and a
bounded list of recent block attempts. Attempts can include a package name, app
label, and timestamp.

The Sleep score is a device-behavior estimate based on local evening and morning
interaction patterns. It is not a biological sleep measurement and does not use
health records. Daily score state can contain derived score values.

## Network use

The Android manifest declares Internet access because the interface runs in a
Capacitor WebView. The current release has no app-owned production API endpoint
or analytics client and does not intentionally transmit app usage, rules,
scores, focus history, or installed-app lists.

If networking, analytics, crash reporting, or account sync is added later, this
notice must be updated before release to name the provider, fields sent,
purpose, retention, and deletion path.

## Backup and deletion

Android backup is disabled. Reset clears the WebView's local state, native focus
preferences, pending Amethyst alarms, and Amethyst notifications.

The settings interface includes local export and reset behavior. Revoking Usage
Access stops future reads but does not automatically erase values already
derived and stored locally. Reset clears those local values. Uninstalling the
app removes its private app data.

## User control

Users can:

- understand each permission before leaving for Android settings;
- keep using unaffected parts of the app after denying access;
- revoke permissions through Android;
- clear local Amethyst data;
- export local data in a readable form;
- learn whether a value is measured, derived, missing, or mocked.

## Security and contact

Security problems should be reported privately using the process in
[`SECURITY.md`](../SECURITY.md). General privacy questions can be sent through
the maintainer contact shown on the GitHub repository.

This notice is versioned with the source. Check the notice included with the
release you install, because later versions may add or remove capabilities.
