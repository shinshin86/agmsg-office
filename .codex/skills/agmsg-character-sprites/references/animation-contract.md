# Animation Contract

The agmsg Office app reads `public/assets/characters/<id>/spritesheet.webp` as a fixed atlas:

- Size: `1536 x 1872`
- Grid: `8 columns x 9 rows`
- Cell: `192 x 208`
- Padding/gap: zero
- Format: `WEBP`, `RGBA`, transparent background
- Placement: centered in each cell, stable scale and baseline matching Miko/Mai

Rows:

| Row | State | Frames | Required content |
| --- | --- | --- | --- |
| 0 | `idle` | 6 | Front idle, breathing/blink/tiny bob |
| 1 | `running-right` | 8 | Right-facing run cycle with real leg motion |
| 2 | `running-left` | 8 | Left-facing run cycle; mirror row 1 when safe |
| 3 | `waving` | 4 | Hand wave only, no wave marks |
| 4 | `jumping` | 5 | Anticipation, lift, peak, descent, settle |
| 5 | `failed` | 8 | Slumped/deflated/sad loop |
| 6 | `waiting` | 6 | Expectant approval/help pose, distinct from idle |
| 7 | `running` | 6 | Front-facing active-task bounce, not directional travel |
| 8 | `review` | 6 | Thoughtful review pose, no props unless already part of identity |

Only columns `0..frames-1` are used. Trailing cells must be transparent.

The app contract is mirrored in `src/components/CharacterActor.tsx` under `SPRITE_ROWS`.
