# Asset provenance

This file records the origin and license of artwork distributed directly by Amethyst. Dependency licenses are tracked through their package metadata and generated software bills of materials.

## Original Amethyst artwork

| Files | Description | Attribution | License |
| --- | --- | --- | --- |
| `public/assets/amethyst-cave-backdrop.jpg` | Canonical cave backdrop with a raised natural shelf | Amethyst contributors, 2026 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `public/gems/amethyst-*.png` | Six original 1254×1254 milestone gems with transparent backgrounds | AI-assisted artwork directed by Amethyst contributors, September 15, 2026 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `public/app-icon.png` | Web icon derived from `amethyst-star.png` | Amethyst contributors, 2026 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `android/app/src/main/res/mipmap-*/ic_launcher*.png` | Android launcher artwork derived from `amethyst-star.png` | Amethyst contributors, 2026 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `android/app/src/main/res/drawable*/splash.png` | Android splash artwork derived from `amethyst-star.png` | Amethyst contributors, 2026 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

The six milestone gems were generated through OpenAI image generation using the
project maintainer's existing Codex access. No source image or third-party brand
asset was supplied to the generator. The complete prompt record is in
[`docs/brand/GEM_GENERATION.md`](docs/brand/GEM_GENERATION.md).

Launcher and splash variants are generated from the tracked star gem with
[`scripts/generate-brand-assets.py`](scripts/generate-brand-assets.py). The
script changes scale, background, and glow only; it does not introduce another
art source.

Suggested attribution:

> Amethyst artwork by Amethyst contributors, licensed under CC BY 4.0.

If you modify an asset, mark the work as changed and keep a link to this provenance record or the original project.

## Maintainer checklist for new assets

Before adding an image, font, icon set, sound, or animation:

1. Record its exact source and author.
2. Confirm that redistribution and modification are allowed.
3. Save the license and required attribution.
4. Note whether the asset was modified or generated.
5. Remove embedded personal or location metadata.
6. Keep working files or generation records where maintainers can audit them.

Do not add screenshots, brand kits, gems, fonts, or visual exports from another
product unless their license clearly permits this use. Visual similarity is not
proof of permission.

## Trademark note

Licensing an asset does not grant trademark rights. Do not use project artwork or naming in a way that implies an official partnership, endorsement, or store listing maintained by the Amethyst contributors.
