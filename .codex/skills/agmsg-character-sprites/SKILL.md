---
name: agmsg-character-sprites
description: Generate, repair, validate, and QA agmsg Office character spritesheets from character portraits. Use when adding or replacing character spritesheet.webp files under public/assets/characters, matching the Miko/Mai 8x9 animated atlas contract, or producing real multi-pose rows for idle, running, waving, jumping, failed, waiting, active, and review states.
---

# AGMSG Character Sprites

## Environment Contract

Use this skill only in Codex App or another Codex environment that can use the built-in `$imagegen` flow with local image references. This workflow depends on:

- Codex App Image Gen for visual generation.
- The installed `$hatch-pet` skill for deterministic atlas assembly. Treat it as required.
- `uv run --with pillow python ...` for Python/Pillow scripts.
- Local access to this repository's `public/assets/characters` files.

This is a Codex agent skill, not a standalone CLI. If the repo-local skill is not auto-discovered, invoke it by path or copy `.codex/skills/agmsg-character-sprites` into `${CODEX_HOME:-$HOME/.codex}/skills`.

Before starting, check that `${CODEX_HOME:-$HOME/.codex}/skills/hatch-pet/SKILL.md` exists. If it is missing, stop and tell the user to install `$hatch-pet` first, for example with `$skill-installer hatch-pet`, then restart Codex so the skill is discovered. Do not continue with ad-hoc replacement scripts; the hatch-pet pipeline is what keeps atlas geometry, transparency, and QA stable.

## Canonical Inputs

- Golden layout/style sample: `public/assets/characters/miko/spritesheet.webp`
- Approved pipeline/style sample: `public/assets/characters/mai/spritesheet.webp`
- Character identity source: `public/assets/characters/<id>/portrait.png`
- Character text source: `public/assets/characters/characters.json`
- Runtime contract: `src/components/CharacterActor.tsx`

Read `references/animation-contract.md` before changing layout assumptions. Read `references/workflow.md` before starting a generation or repair run.

## Workflow

1. Confirm `$hatch-pet` is installed and tell the user how to install it if missing.
2. Prepare one hatch-pet run per character under `/private/tmp/agmsg-sprite-runs/<id>`.
3. Generate a canonical base from the portrait, matching Miko/Mai style and simplifying props that would destabilize animation.
4. Generate row strips for `idle`, `running-right`, `waving`, `jumping`, `failed`, `waiting`, `running`, and `review`.
5. Derive `running-left` from `running-right` with hatch-pet's framewise mirror script when no readable text or direction-sensitive identity mark would break.
6. Process with hatch-pet scripts using `uv run --with pillow python`.
7. Inspect `qa/contact-sheet.png` and row GIF previews; regenerate only failing rows.
8. Replace `public/assets/characters/<id>/spritesheet.webp` only after validation and visual QA pass.

Never generate the final 1536x1872 atlas directly with Image Gen. Generate row strips, then let deterministic scripts perform extraction, transparency cleanup, composition, and validation.

## Use in agmsg Office

For user-created characters, the validated `spritesheet.webp` is intended to be uploaded through the app rather than installed by editing JSON manually:

1. Finish QA and validation for `RUN_DIR/final/spritesheet.webp`.
2. Start agmsg Office with `npm run dev`.
3. Open the Casting panel, choose a slot, and select "Replace character".
4. Upload the generated `spritesheet.webp`; optionally upload `portrait.png`.
5. The dev server writes `public/assets/characters/custom/` and updates the custom manifest automatically.

## Generation Rules

- Attach or visibly inspect the character portrait and canonical base before row generation.
- Keep prompts short, row-specific, and identity-locked.
- Preserve face, hair, color palette, outfit silhouette, and key accessories.
- Avoid new props unless already essential to the character identity.
- Use flat chroma background only. Use `#00FF00` by default; switch to `#FF00FF` for green/mint/teal characters such as Nao.
- Forbid shadows, floor patches, guide marks, labels, text, motion marks, detached effects, speed lines, dust, bubbles, punctuation, and checkerboards.
- Treat any identity drift as a failing row even when script validation passes.

## QA Rules

Use `references/qa-checklist.md` during visual review. Required script-level acceptance:

- `1536x1872`
- `WEBP`
- `RGBA`
- 8 columns x 9 rows
- 192x208 cells
- transparent RGB residue is 0 for newly generated sheets
- all used cells non-empty
- unused trailing cells transparent
- hatch-pet inspection has no errors

Run the bundled validator for project-level checks:

```bash
uv run --with pillow python .codex/skills/agmsg-character-sprites/scripts/validate-character-spritesheets.py public/assets/characters
```

## Important Repairs

- If one row is wrong, regenerate that row only.
- If `running-left` is wrong because the character has direction-sensitive marks, generate it normally instead of mirroring.
- If Nao-like colors are damaged by green chroma removal, regenerate and process that character with `#FF00FF`.
- If a row includes another character's identity, discard the row and regenerate with the target character's canonical base shown/attached and with negative identity constraints.
