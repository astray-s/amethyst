#!/usr/bin/env python3
"""Generate tracked Android and web brand rasters from the canonical star gem."""

from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/gems/amethyst-star.png"
BACKGROUND = (11, 6, 20, 255)


def contained(source: Image.Image, size: int, scale: float) -> Image.Image:
    target = max(1, round(size * scale))
    copy = source.copy()
    copy.thumbnail((target, target), Image.Resampling.LANCZOS)
    return copy


def crop_transparent(source: Image.Image) -> Image.Image:
    cleaned_alpha = source.getchannel("A").point(lambda alpha: 0 if alpha < 16 else alpha)
    source.putalpha(cleaned_alpha)
    visible_alpha = cleaned_alpha.point(lambda alpha: 255 if alpha else 0)
    bounds = visible_alpha.getbbox()
    return source.crop(bounds) if bounds else source


def place_center(canvas: Image.Image, image: Image.Image) -> None:
    canvas.alpha_composite(
        image,
        ((canvas.width - image.width) // 2, (canvas.height - image.height) // 2),
    )


def branded_square(source: Image.Image, size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), BACKGROUND)
    glow_source = contained(source, size, 0.70)
    glow_alpha = glow_source.getchannel("A").filter(
        ImageFilter.GaussianBlur(max(2, size // 22))
    )
    glow = Image.new("RGBA", glow_source.size, (132, 76, 255, 0))
    glow.putalpha(glow_alpha.point(lambda alpha: min(105, alpha)))
    place_center(canvas, glow)
    place_center(canvas, contained(source, size, 0.68))
    return canvas


def adaptive_foreground(source: Image.Image, size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    place_center(canvas, contained(source, size, 0.58))
    return canvas


def branded_splash(source: Image.Image, width: int, height: int) -> Image.Image:
    canvas = Image.new("RGBA", (width, height), BACKGROUND)
    gem = contained(source, min(width, height), 0.50)
    glow_mask = Image.new("L", (width, height), 0)
    glow_mask.paste(
        gem.getchannel("A"),
        ((width - gem.width) // 2, (height - gem.height) // 2),
    )
    glow_alpha = glow_mask.filter(
        ImageFilter.GaussianBlur(max(4, min(width, height) // 18))
    )
    glow = Image.new("RGBA", (width, height), (132, 76, 255, 0))
    glow.putalpha(glow_alpha.point(lambda alpha: min(95, alpha)))
    canvas.alpha_composite(glow)
    place_center(canvas, gem)
    return canvas.convert("RGB")


def main() -> None:
    source = crop_transparent(Image.open(SOURCE).convert("RGBA"))

    density_sizes = {
        "mdpi": (48, 108),
        "hdpi": (72, 162),
        "xhdpi": (96, 216),
        "xxhdpi": (144, 324),
        "xxxhdpi": (192, 432),
    }
    resource_root = ROOT / "android/app/src/main/res"

    for density, (legacy_size, foreground_size) in density_sizes.items():
        directory = resource_root / f"mipmap-{density}"
        branded_square(source, legacy_size).save(directory / "ic_launcher.png")
        branded_square(source, legacy_size).save(directory / "ic_launcher_round.png")
        adaptive_foreground(source, foreground_size).save(
            directory / "ic_launcher_foreground.png"
        )

    for splash_path in resource_root.glob("drawable*/splash.png"):
        with Image.open(splash_path) as current:
            branded_splash(source, current.width, current.height).save(
                splash_path, quality=95
            )

    branded_square(source, 512).save(ROOT / "public/app-icon.png")


if __name__ == "__main__":
    main()
