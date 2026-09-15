# Amethyst homepage brand system

**Status:** Locked  
**Approved reference:** [homepage-approved-2026-09-15.png](reference/homepage-approved-2026-09-15.png)
**Scope:** The homepage only. This is the sole visual source of truth for Amethyst brand decisions.

## Source order

Use these in order when extending the product:

1. The approved homepage screenshot above.
2. [`src/screens/HomeScreen.brand.css`](../../src/screens/HomeScreen.brand.css).
3. [`homepage-brand-tokens.css`](homepage-brand-tokens.css).
4. This guide.

Do not derive Amethyst's brand from another screen, an older screenshot, obsolete stylesheets,
or unused artwork. If the homepage needs to change, update this guide,
the frozen screenshot, and the token file in the same change.

## The visual idea

Amethyst is a quiet black cave illuminated by a single iridescent floating stone. The cave
creates depth, but the gem is the focal object. The score and its three dimensions emerge
from the cave through one controlled fade to black; the lower UI remains calm, dark, and
legible.

The interface should feel cinematic and restrained rather than decorative:

- Black is the foundation, not an empty default.
- Rock, mist, and light are atmospheric framing, never a competing scene.
- The gem is singular, large, and centered over the natural rock shelf.
- White, lilac, and pink-lavender are glow accents for milestones, scores, and key icons.
- Cards are near-black with a faint violet reflection and a thin quiet border.

## Locked palette

| Role | Value | Use |
| --- | --- | --- |
| Cave black | `#050506` | Primary background and score field |
| Deep surface | `#08080a` | Card depth |
| Surface | `#0d0d10` | Card foreground |
| Main text | `#f7f5f9` | Primary labels |
| Muted text | `#aaa6b0` | Secondary labels |
| Lilac | `#c6a5f7` | Subtle accents |
| Violet | `#a976e8` | Active accents |
| Ice-lilac | `#b8cffa` | Small cool highlight only |
| Score gradient | `#f5eaff → #cfacff → #c09cec` | Scores, pill labels, icon accents, and outline rings |

The score gradient is white/lilac/pink-lavender. Do not replace its endpoint with light
blue or cyan. Do not use orange lighting or broad rainbow gradients.

## Composition rules

### Cave and gem

- Use the raised natural shelf in
  [`public/assets/amethyst-cave-backdrop.jpg`](../../public/assets/amethyst-cave-backdrop.jpg).
- Use the original cluster gem in
  [`public/gems/amethyst-cluster.png`](../../public/gems/amethyst-cluster.png).
- Keep the gem intact: no crop, mask, pedestal, or alternate base.
- Let the gem float just above the natural shelf with a soft white/lilac/pink-lavender halo.
- Preserve a smooth cave-to-black fade behind the score. Avoid a visible photo horizon or
  stacked gradient bands.

### Score and dimensions

- The score is the first textual priority after the gem.
- Score, Sleep, Focus, and Rest use the same white/lilac/pink-lavender glow language.
- Metric pills are transparent inside with a thin glowing gradient outline; do not fill
  them with colored glass.
- Keep one connector line and arch between the score and the three metric pills.

### Cards and controls

- Card interiors use near-black surfaces with a subtle violet reflection, not bright glass.
- Use thin low-contrast borders and soft inset highlights.
- Reserve stronger glow for meaningful markers: the score, metric icons, gems, active-rule
  flower, and diamond reward indicators.
- Maintain rounded card corners, but do not make every element into a pill or use heavy
  shadows.

### Typography

- Use the existing system stack: `Inter, Roboto, -apple-system, BlinkMacSystemFont,
  "Segoe UI", sans-serif`.
- Large score numbers are compact, high-contrast, and softly luminous.
- Supporting labels use clean mixed case or restrained uppercase tracking; no ornamental
  display type.

## What to avoid

- Cyan or light-blue endpoints in the main glow gradient.
- Orange spotlights or warm cave lighting.
- Pedestals, plinths, platforms, stands, discs, or object-shaped shadows in the cave.
- A cave image that cuts abruptly into a separate black panel.
- A small or cropped gem, or a gem treated as background decoration.
- Multiple unrelated background systems competing on one screen.
- Bright purple glass cards, generic neon gradients, or excessive bloom.

## Canonical assets and implementation

| Purpose | Canonical source |
| --- | --- |
| Visual approval | [`reference/homepage-approved-2026-09-15.png`](reference/homepage-approved-2026-09-15.png) |
| Runtime composition | [`src/screens/HomeScreen.brand.css`](../../src/screens/HomeScreen.brand.css) |
| Gem | [`public/gems/amethyst-cluster.png`](../../public/gems/amethyst-cluster.png) |
| Cave | [`public/assets/amethyst-cave-backdrop.jpg`](../../public/assets/amethyst-cave-backdrop.jpg) |
| Reusable token reference | [`homepage-brand-tokens.css`](homepage-brand-tokens.css) |
