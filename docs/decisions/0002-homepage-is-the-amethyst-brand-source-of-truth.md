# ADR 0002: Use the approved homepage as Amethyst's only visual brand source

- Status: Accepted
- Date: 2026-09-05

## Context

The project contains earlier screens, experiments, unused assets, and inactive CSS that
express conflicting visual systems. They are not a reliable basis for future UI work.

The approved homepage resolves the intended direction: a black cave, a single floating
amethyst, a raised natural rock shelf, a white/lilac/pink-lavender glow system, and quiet
near-black product surfaces.

## Decision

The approved homepage reference in
[`docs/brand/reference/homepage-approved-2026-09-15.png`](../brand/reference/homepage-approved-2026-09-15.png)
is Amethyst's sole visual source of truth.

Future visual work must use the locked homepage assets, tokens, and rules in
[`docs/brand/AMETHYST_HOMEPAGE_BRAND_SYSTEM.md`](../brand/AMETHYST_HOMEPAGE_BRAND_SYSTEM.md).
Other screens, legacy stylesheets, prior references, and unused artwork must not establish
new color, lighting, material, spacing, or glow direction.

## Consequences

- New screens inherit the homepage's black-led hierarchy and restrained lilac glow system.
- The score gradient remains white/lilac/pink-lavender, without a cyan or light-blue endpoint.
- Cave artwork must have a natural raised shelf without pedestal imagery.
- A user-approved homepage revision requires updating the screenshot, brand guide, token file,
  and this decision if the governing rule changes.
