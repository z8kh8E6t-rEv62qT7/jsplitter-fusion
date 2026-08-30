#!/usr/bin/env python3
"""Generate the transparent Material Icons sprite used by TransportControls."""

from __future__ import annotations

import argparse
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ModuleNotFoundError as error:
    raise SystemExit("Pillow is required: python -m pip install Pillow") from error


CELL_SIZE = 96
FONT_SIZE = 64
DRAW_ORIGIN = (15, 12)
FOREGROUND = (31, 31, 31, 255)
ICONS = (
    ("stop", 0xE047),
    ("play_arrow", 0xE037),
    ("pause", 0xE034),
    ("arrow_back_ios", 0xE5E0),
    ("arrow_forward_ios", 0xE5E1),
    ("shuffle", 0xE043),
    ("folder", 0xE2C7),
    ("repeat_one", 0xE041),
    ("volume_up", 0xE050),
    ("volume_off", 0xE04F),
)
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "assets" / "transport-icons.png"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--font",
        required=True,
        type=Path,
        help="path to MaterialIconsRound-Regular.otf",
    )
    return parser.parse_args()


def generate(font_path: Path) -> None:
    if not font_path.is_file():
        raise SystemExit(f"Font file not found: {font_path}")

    font = ImageFont.truetype(str(font_path), FONT_SIZE)
    image = Image.new("RGBA", (CELL_SIZE * len(ICONS), CELL_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    for index, (name, codepoint) in enumerate(ICONS):
        character = chr(codepoint)
        if font.getmask(character).getbbox() is None:
            raise SystemExit(f"Glyph {name} (U+{codepoint:04X}) is missing from {font_path}")
        draw.text(
            (index * CELL_SIZE + DRAW_ORIGIN[0], DRAW_ORIGIN[1]),
            character,
            font=font,
            fill=FOREGROUND,
        )

    image.save(OUTPUT_PATH, format="PNG", optimize=True)
    print(f"Generated {OUTPUT_PATH} ({image.width}x{image.height})")


if __name__ == "__main__":
    generate(parse_args().font)
