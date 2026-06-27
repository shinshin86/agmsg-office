# Workflow

## Prepare

First verify that hatch-pet is installed:

```bash
test -f "${CODEX_HOME:-$HOME/.codex}/skills/hatch-pet/SKILL.md"
```

If this fails, stop and tell the user:

```text
This workflow requires the $hatch-pet skill. Please install it with `$skill-installer hatch-pet`, then restart Codex so the new skill is available.
```

Do not continue by recreating hatch-pet behavior manually. Its scripts are required for deterministic layout, chroma extraction, row inspection, atlas composition, validation, contact sheets, and GIF previews.

Use one run folder per character:

```bash
SKILL_DIR="${CODEX_HOME:-$HOME/.codex}/skills/hatch-pet"
uv run --with pillow python "$SKILL_DIR/scripts/prepare_pet_run.py" \
  --pet-name "<DisplayName>" \
  --pet-id "<id>" \
  --description "<characters.json description>" \
  --reference "$PWD/public/assets/characters/<id>/portrait.png" \
  --output-dir "/private/tmp/agmsg-sprite-runs/<id>" \
  --pet-notes "<identity notes>. Match Miko/Mai style, line weight, lighting, scale, baseline, and 192x208 readability." \
  --style-preset auto \
  --style-notes "Non-pixel chibi character sprites, same style and quality as Miko and approved Mai spritesheets; transparent final atlas; no shadows or props unless present in portrait." \
  --chroma-key "#00FF00" \
  --force
```

Use `#FF00FF` for green, mint, seafoam, or teal-heavy characters.

## Generate Images

Generate with `$imagegen`, not a local image script.

Required visual jobs:

1. base
2. idle
3. running-right
4. waving
5. jumping
6. failed
7. waiting
8. running
9. review

Derive `running-left` only after visually accepting `running-right`:

```bash
uv run --with pillow python "$SKILL_DIR/scripts/derive_running_left_from_running_right.py" \
  --run-dir "/private/tmp/agmsg-sprite-runs/<id>" \
  --confirm-appropriate-mirror \
  --decision-note "<why mirroring is safe>"
```

## Record Generated Outputs

After each selected output, copy it to the run's `decoded/<job>.png`, then mark the corresponding `imagegen-jobs.json` job complete. For `base`, also copy it to `references/canonical-base.png`.

Do not delete generated image originals unless explicitly asked by the user.

## Process

Run hatch-pet deterministic scripts with `uv`:

```bash
uv run --with pillow python "$SKILL_DIR/scripts/extract_strip_frames.py" \
  --decoded-dir "$RUN_DIR/decoded" \
  --output-dir "$RUN_DIR/frames" \
  --states all \
  --method auto

uv run --with pillow python "$SKILL_DIR/scripts/inspect_frames.py" \
  --frames-root "$RUN_DIR/frames" \
  --json-out "$RUN_DIR/qa/review.json" \
  --require-components

uv run --with pillow python "$SKILL_DIR/scripts/compose_atlas.py" \
  --frames-root "$RUN_DIR/frames" \
  --output "$RUN_DIR/final/spritesheet.png" \
  --webp-output "$RUN_DIR/final/spritesheet.webp"

uv run --with pillow python "$SKILL_DIR/scripts/validate_atlas.py" \
  "$RUN_DIR/final/spritesheet.webp" \
  --json-out "$RUN_DIR/final/validation.json"

uv run --with pillow python "$SKILL_DIR/scripts/make_contact_sheet.py" \
  "$RUN_DIR/final/spritesheet.webp" \
  --output "$RUN_DIR/qa/contact-sheet.png"

uv run --with pillow python "$SKILL_DIR/scripts/render_animation_previews.py" \
  --frames-root "$RUN_DIR/frames" \
  --output-dir "$RUN_DIR/qa/previews"
```

If extraction creates baseline or scale popping but source strips are stable, rerun extraction with `--method stable-slots` and inspect with `--allow-stable-slots`.

## Install Result

Copy the final validated WebP into:

```bash
cp "$RUN_DIR/final/spritesheet.webp" "public/assets/characters/<id>/spritesheet.webp"
```

Then run:

```bash
uv run --with pillow python .codex/skills/agmsg-character-sprites/scripts/validate-character-spritesheets.py public/assets/characters
npm run build
```
