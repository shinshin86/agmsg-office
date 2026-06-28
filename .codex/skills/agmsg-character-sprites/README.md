# agmsg Character Sprites

This repo-local skill generates and validates agmsg Office character spritesheets.

## App Upload Flow

1. Generate and QA a character atlas with this skill.
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
