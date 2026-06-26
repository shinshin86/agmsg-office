#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
CHARACTER_ROOT = ROOT / "public" / "assets" / "characters"

CELL_WIDTH = 192
CELL_HEIGHT = 208
COLUMNS = 8
ROWS = 9
TARGET_HEIGHT = 178

CHARACTERS = ("mai", "haya", "suzu", "kii")


def alpha_bbox(image: Image.Image):
    alpha = image.getchannel("A").point(lambda value: 255 if value > 24 else 0)
    return alpha.getbbox()


def load_subject(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    bbox = alpha_bbox(image)
    if bbox:
        image = image.crop(bbox)
    ratio = TARGET_HEIGHT / image.height
    next_size = (round(image.width * ratio), TARGET_HEIGHT)
    return image.resize(next_size, Image.Resampling.LANCZOS)


def place_cell(subject: Image.Image, y_offset: int = 0) -> Image.Image:
    cell = Image.new("RGBA", (CELL_WIDTH, CELL_HEIGHT), (0, 0, 0, 0))
    x = (CELL_WIDTH - subject.width) // 2
    y = CELL_HEIGHT - subject.height - 12 + y_offset
    cell.alpha_composite(subject, (x, y))
    return cell


def compose_walk_subject(
    subject: Image.Image,
    *,
    frame: int,
    direction: int,
) -> tuple[Image.Image, int]:
    phase = frame % 8
    x_shift = [-5, -3, 0, 4, 5, 3, 0, -4][phase] * direction
    bob = [2, 0, -3, -1, 2, 0, -3, -1][phase]
    lean = [-3, -2, 0, 2, 3, 2, 0, -2][phase] * direction
    scale_x = [1.02, 1.01, 0.99, 1.0, 1.02, 1.01, 0.99, 1.0][phase]
    scale_y = [0.99, 1.01, 1.03, 1.01, 0.99, 1.01, 1.03, 1.01][phase]

    image = subject.resize(
        (round(subject.width * scale_x), round(subject.height * scale_y)),
        Image.Resampling.LANCZOS,
    )
    image = image.rotate(lean, resample=Image.Resampling.BICUBIC, expand=True)

    canvas = Image.new(
        "RGBA",
        (subject.width + 42, subject.height + 24),
        (0, 0, 0, 0),
    )
    image_x = (canvas.width - image.width) // 2 + x_shift
    image_y = max(0, bob)
    draw = ImageDraw.Draw(canvas, "RGBA")
    foot_y = canvas.height - 18 + image_y
    shadow_x = canvas.width // 2 + x_shift // 2
    draw.ellipse(
        (shadow_x - 24, foot_y - 4, shadow_x + 24, foot_y + 5),
        fill=(0, 0, 0, 42),
    )
    canvas.alpha_composite(image, (image_x, image_y))
    return canvas, bob


def transform_subject(
    subject: Image.Image,
    *,
    frame: int,
    row: int,
    flip: bool = False,
) -> tuple[Image.Image, int]:
    image = subject
    y_offset = 0

    if flip:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)

    if row == 0:  # idle
        y_offset = -abs((frame % 4) - 1) // 2
    elif row in (1, 2, 7):  # running
        direction = -1 if row == 2 else 1
        image, y_offset = compose_walk_subject(image, frame=frame, direction=direction)
    elif row == 3:  # waving
        angle = -6 if frame % 2 == 0 else 6
        image = image.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
        y_offset = -1
    elif row == 4:  # jumping
        y_offset = [-2, -15, -28, -15, -2, -2, -2, -2][frame]
        image = image.rotate(
            [-3, 0, 4, 0, -3, -3, -3, -3][frame],
            resample=Image.Resampling.BICUBIC,
            expand=True,
        )
    elif row == 5:  # failed
        image = image.rotate(
            [-6, 6, -5, 5, -3, 3, -2, 2][frame],
            resample=Image.Resampling.BICUBIC,
            expand=True,
        )
        image = ImageEnhance.Color(image).enhance(0.72)
        y_offset = 4
    elif row == 6:  # waiting
        y_offset = 1 if frame % 2 == 0 else 0
    elif row == 8:  # review
        angle = [-3, -1, 0, 1, 3, 1, 0, -1][frame]
        image = image.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
        y_offset = -1

    return image, y_offset


def generate(character_id: str) -> None:
    portrait = CHARACTER_ROOT / character_id / "portrait.png"
    out = CHARACTER_ROOT / character_id / "spritesheet.webp"
    subject = load_subject(portrait)
    atlas = Image.new(
        "RGBA",
        (CELL_WIDTH * COLUMNS, CELL_HEIGHT * ROWS),
        (0, 0, 0, 0),
    )

    for row in range(ROWS):
        for frame in range(COLUMNS):
            flip = row == 2
            image, y_offset = transform_subject(
                subject,
                frame=frame,
                row=row,
                flip=flip,
            )
            cell = place_cell(image, y_offset)
            atlas.alpha_composite(cell, (frame * CELL_WIDTH, row * CELL_HEIGHT))

    atlas.save(out, "WEBP", lossless=True, quality=100)
    print(f"Wrote {out.relative_to(ROOT)}")


def main() -> None:
    for character_id in CHARACTERS:
        generate(character_id)


if __name__ == "__main__":
    main()
