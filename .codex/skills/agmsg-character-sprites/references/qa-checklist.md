# QA Checklist

Reject a row if any of these appear:

- wrong character identity
- changed hair, face, outfit, or major palette
- wrong row action
- missing, blank, or duplicate-looking required frames
- visible guide marks, borders, labels, text, or frame numbers
- shadows, floor patches, dust, speed lines, wave marks, motion arcs, punctuation, icons, bubbles, or detached effects
- clipped body parts
- unstable scale or baseline that causes playback popping
- right/left row facing the wrong direction
- inert idle that looks fully static
- non-directional `running` that becomes a traveling sprint

Accept only after checking:

- contact sheet row by row
- row GIF previews for motion and timing
- `qa/review.json`
- `final/validation.json`
- final installed file under `public/assets/characters/<id>/spritesheet.webp`

Known repair patterns:

- Nao-like mint/teal damage: switch chroma key to `#FF00FF`.
- Sora-like identity drift after many generations: regenerate the row with target-only identity constraints and explicit negative constraints for the wrong character.
- Detached waiting marks: regenerate `waiting` with "draw only character poses; no motion marks or detached effects".
