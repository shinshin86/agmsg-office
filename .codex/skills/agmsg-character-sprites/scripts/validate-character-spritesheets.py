#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

from PIL import Image


ROWS = [
    ("idle", 6),
    ("running-right", 8),
    ("running-left", 8),
    ("waving", 4),
    ("jumping", 5),
    ("failed", 8),
    ("waiting", 6),
    ("running", 6),
    ("review", 6),
]


def alpha_count(image):
    return sum(1 for value in image.getchannel("A").getdata() if value)


def transparent_residue(image):
    return sum(1 for r, g, b, a in image.getdata() if a == 0 and (r or g or b))


def validate_sheet(path):
    errors = []
    warnings = []
    with Image.open(path) as source:
        image = source.convert("RGBA")
        if source.format != "WEBP":
            errors.append(f"format is {source.format}, expected WEBP")
        if image.size != (1536, 1872):
            errors.append(f"size is {image.size}, expected (1536, 1872)")
        if image.mode != "RGBA":
            errors.append(f"mode is {image.mode}, expected RGBA")

        residue = transparent_residue(image)
        is_legacy_miko = path.parent.name == "miko"
        if residue and is_legacy_miko:
            warnings.append(f"legacy Miko transparent RGB residue pixels: {residue}")
        elif residue:
            errors.append(f"transparent RGB residue pixels: {residue}")

        for row_index, (state, frame_count) in enumerate(ROWS):
            for col in range(8):
                cell = image.crop((col * 192, row_index * 208, (col + 1) * 192, (row_index + 1) * 208))
                count = alpha_count(cell)
                if col < frame_count and count == 0:
                    errors.append(f"{state} row {row_index} col {col} is empty")
                if col >= frame_count and count != 0:
                    errors.append(f"{state} row {row_index} trailing col {col} is not transparent")

    return {
        "file": str(path),
        "ok": not errors,
        "errors": errors,
        "warnings": warnings,
    }


def main():
    parser = argparse.ArgumentParser(description="Validate agmsg Office character spritesheets.")
    parser.add_argument("characters_dir", type=Path)
    parser.add_argument("--json-out", type=Path)
    args = parser.parse_args()

    results = []
    for sheet in sorted(args.characters_dir.glob("*/spritesheet.webp")):
        results.append(validate_sheet(sheet))

    output = {
        "ok": all(result["ok"] for result in results),
        "count": len(results),
        "results": results,
    }

    text = json.dumps(output, indent=2)
    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(text)
    print(text)
    raise SystemExit(0 if output["ok"] else 1)


if __name__ == "__main__":
    main()
