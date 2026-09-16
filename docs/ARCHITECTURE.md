# Architecture

Amethyst is a hybrid Android app. A React interface runs inside Capacitor, while native Java plugins handle capabilities that a browser cannot provide.

## Runtime shape

```text
React and TypeScript UI
        |
        | typed native bridge with browser fallbacks
        v
Capacitor Android shell
        |
        +-- usage statistics
        +-- installed-app catalog
        +-- blocking and schedule services
        +-- notifications and boot restoration
        +-- device-based score signals
```

The browser build is a development surface. It can validate navigation, state transitions, rendering, and fallback behavior, but it does not validate Android permissions or enforcement.

## Main areas

| Area | Responsibility |
| --- | --- |
| `src/components` | Reusable interface pieces |
| `src/pages` | Route-level screens and flows |
| `src/state` | Client-side application state |
| `src/native` | Capacitor plugin contracts and browser fallbacks |
| `src/data` | Catalogs and static product data |
| `android/app/src/main` | Android activities, services, receivers, and native plugins |
| `public` | Artwork and static web assets |
| `tests` and colocated test files | Unit, component, and browser coverage |

## Data flow

The interface should ask the native layer for sensitive Android state rather than reaching around the bridge. Native responses should be narrow, typed, and explicit about unavailable permissions.

Persist only what the product needs. Usage and focus data can reveal habits even when it contains no message content. New storage should document:

- the fields stored;
- where they live;
- retention and deletion behavior;
- whether Android backup can copy them;
- whether any data leaves the device.

## Native capability rules

Each native capability should have:

1. a small TypeScript contract;
2. an Android implementation;
3. a safe browser fallback;
4. unit tests for pure logic;
5. real-device acceptance steps;
6. permission and policy documentation.

An unavailable permission is a normal state. The UI should explain what is missing and offer a direct next step without repeatedly prompting.

## Known architectural debt

- Device-based score thresholds need broader long-term calibration.
- Blocking behavior depends on privileged user-granted Android capabilities and is not tamper-proof.
- Release publication and signing-key rotation are still manual.
- There is intentionally no production telemetry; any future diagnostics need a new privacy review.

These are release gates, not reasons to hide behavior behind optimistic UI.
