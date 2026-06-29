# agmsg Character Sprites

English | [日本語](README.ja.md)

This repo-local skill generates and validates agmsg Office character spritesheets.

## Quick Start Prompt

`portrait.png` is a single portrait image of the character, used as the reference for its look. The skill reads it to keep the appearance consistent across every generated pose.

Attach (or point to) that `portrait.png`, then paste this prompt into Codex to kick off generation:

```text
Use $agmsg-character-sprites with the attached portrait to generate an agmsg Office character spritesheet, then run QA and validation and give me the final spritesheet.webp to upload.
```

Run this in Codex App (or a Codex environment with `$imagegen` and the `$hatch-pet` skill installed). The skill generates each pose, assembles them into one spritesheet, and validates its size and format. See `SKILL.md` and `references/workflow.md` for the full flow.

## App Upload Flow

1. Generate and QA a character spritesheet with this skill.
2. Use the final validated file: `RUN_DIR/final/spritesheet.webp`.
3. Start agmsg Office:

```bash
npm run dev
```

4. Open the Casting panel.
5. Choose a slot and click **Replace character**.
6. Upload the generated `spritesheet.webp`.
7. Optionally upload `portrait.png`.

The app dev server saves files under `public/assets/characters/custom/` and updates `custom/characters.json` automatically. Users should not hand-edit the JSON manifest.
