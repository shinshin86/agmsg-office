# agmsg Office Details

[← Back to README](../README.md)

A deeper reference for the controls, data, characters, and architecture. For an
overview and quick start, see the [README](../README.md).

## Using the app

The controls live in the side panel:

- **Source**: choose what to play (Sample, or any local `agmsg` team in dev mode).
  Selecting a source loads it; it does not auto-play.
- **Playback**: **Start** / **Stop** (a toggle), **Pause**, and a **Speed** slider.
- **Advanced** (collapsed by default): **Import JSON**, **Reload current team**, and a
  **Show date** toggle for the log timestamps.
- **Language**: an `EN` / `日本語` toggle in the header, auto-detected from the browser
  and remembered across visits.
- **Theater**: a toggle in the caption bar that hides the side panel and expands the
  stage to full width. Toggle it again to exit.
- **Current line**: the caption bar shows the active message. It is collapsible and
  fixed-height so the stage does not jump while playing.

## How it works

The app is a small pipeline from raw log records to an animated stage:

1. **Load**: a log source provides raw records in the `agmsg` message-table shape
   (see [Log format](#log-format)). Sources are the bundled sample, the local `agmsg`
   dev API, or an imported JSON file.
2. **Normalize**: `src/lib/agmsg.ts` converts raw records to internal entries
   (`from_agent` becomes `fromAgent`, and so on) and sorts them by the numeric `id`,
   which is agmsg's authoritative ordering. This is the single place log shape is
   handled.
3. **Assign characters**: distinct agent names are mapped to actor characters in
   first-seen order. When a log has more agents than actor sprites, the extras share a
   sprite via a stable hash of the name, so the same agent always gets the same
   character. The real agent name is always shown on the nameplate and bubble. The
   host ("Boss") is reserved and never represents an agent.
4. **Replay**: a timer steps through the entries (the Speed control changes the
   interval). For each entry, the sending agent's character starts speaking with a
   bubble, the receiving agent is marked waiting, and the matching log row is
   highlighted and scrolled into view.
5. **Host narration**: before the first entry the host announces an intro, and after
   the last entry an outro. Rows whose body starts with `ctrl:` (agmsg control
   messages such as `ctrl:despawn`) are not speech. They render as a muted system
   note, and the host narrates them. For `ctrl:despawn` it names the agent that left,
   which is the recipient.
6. **Render**: `src/components/CharacterActor.tsx` draws each character from a
   spritesheet with idle, walk, and gesture motion. Only the characters used by the
   current log appear (plus the host), and they animate in when a log loads.
   While idle, each character putters around its own desk following its own
   motion personality defined in `src/lib/motionPersonality.ts`: a movement
   pattern (pacing edge to edge, busy little hops, or random wandering), walk
   speed, pause rhythm, and a signature gesture (waving, reviewing, jumping,
   or waiting) all differ per character, but everyone stays within a fixed
   range of their home spot so the stage stays tidy. Custom characters get a
   personality derived deterministically from their id, so an uploaded
   character always moves the same way.

All of the above is client-side React state. The only server-side code is the
optional dev API in `vite.config.ts`, which runs only during `npm run dev`.

## Supplying logs

agmsg Office accepts logs in the `agmsg` message-table JSON shape, from three places.

### 1. Bundled sample

A demo log ships with the app and loads on start. English and Japanese versions:

```text
public/sample/agmsg-sample.json
public/sample/agmsg-sample.ja.json
```

Pick **Sample** in the Source dropdown to return to it; the language toggle swaps
which one is shown.

### 2. Local agmsg (dev mode)

During `npm run dev`, the Vite dev server exposes a read-only helper API:

```text
GET /api/agmsg/teams
GET /api/agmsg/history?team=<team>&limit=80
```

It lists the teams under `~/.agents/skills/agmsg/teams` and reads history through the
installed `agmsg` scripts. Pick a team from the Source dropdown to replay your real
conversations. If the scripts or data are unavailable, it falls back to the bundled
sample. This middleware is dev-only and never ships in the production build.

On Windows, the dev API runs those `.sh` scripts through Bash. Git for Windows is
detected automatically in its default install locations. If Bash is installed
elsewhere, set `AGMSG_BASH` to the full path of `bash.exe` before starting the dev
server.

### 3. Manual JSON import

Use **Import JSON** (in **Advanced**) to load a local `.json` file. It should be an
array of records in the shape below.

`agmsg` stores messages in SQLite and has no built-in JSON export, but the table maps
directly to this shape, so you can dump a compatible file with `sqlite3`:

```bash
sqlite3 ~/.agents/skills/agmsg/db/messages.db \
  "SELECT json_group_array(json_object(
     'id',id,'team',team,'from_agent',from_agent,'to_agent',to_agent,
     'body',body,'created_at',created_at,'read_at',read_at))
   FROM messages WHERE team='YOUR_TEAM' ORDER BY id;"
```

Save the output as a `.json` file, then import it in the browser.

## Log format

Each record mirrors the `agmsg` `messages` table:

```jsonc
{
  "id": 1,                                // integer, the authoritative ordering
  "team": "product-studio",
  "from_agent": "lead",                   // sender
  "to_agent": "dev",                      // recipient (always present)
  "body": "Please check the latest build.",
  "created_at": "2026-06-24T00:00:00Z",   // ISO 8601 UTC
  "read_at": null                         // ISO 8601 UTC, or null if unread
}
```

A row whose `body` starts with `ctrl:` (such as `ctrl:despawn`) is an agmsg control
message and is shown as a system note rather than character speech.

## Characters

The host is **Boss** (the Miko character). She is always on stage, hosts the replay,
and never represents an agent. The actor sprites are **Mai, Haya, Suzu, Kii, Rin,
Nao, Mio, and Sora** (eight characters, one per distinct agent).

Agents fill the actor slots in first-seen order. With more than eight distinct
agents, the extras share an actor sprite via a stable name hash; the real agent name
always shows on the nameplate and bubble, so it stays clear who is speaking. `agmsg`
teams have no hard size limit, so this keeps any team viewable.

Each character also has its own **motion personality** (`src/lib/motionPersonality.ts`)
used while idle on stage. Everyone stays within a fixed radius of their own desk,
and the individuality shows in how they behave there: Boss and Sora pace their
areas end to end, Haya and Rin hop around busily and jump a lot, Suzu is nearly
a statue sunk into long reviews, Kii waves at coworkers constantly, Mio patiently
waits, and so on. Each character leans heavily on its own signature gesture, so
the cast reads differently at a glance. Custom characters get a personality
derived from a hash of their id — including a movement pattern and a signature
gesture — so every uploaded character moves in its own consistent way.

## Project structure

```text
src/
  main.tsx                    # entry point
  App.tsx                     # app shell: stage, controls, log panel, replay engine
  components/CharacterActor.tsx  # character sprite, motion, and speech bubble
  lib/agmsg.ts                # log normalization + agent-to-character mapping + formatting
  lib/motionPersonality.ts    # per-character ambient motion personalities
  lib/i18n.ts                 # UI strings (en/ja) and language/date helpers
  types.ts                    # shared types
  styles/app.css              # styles (light, simple theme)
public/
  assets/                     # characters, backgrounds, props, and assets.json manifest
  sample/                     # bundled demo logs (en + ja)
vite.config.ts                # Vite config + the dev-only local agmsg API
scripts/generate-portrait-spritesheets.py  # builds spritesheets from portraits
```

## Assets

Character spritesheets live at `public/assets/characters/<id>/spritesheet.webp` and
follow an 8×9 atlas:

| Row | State |
| --- | --- |
| 0 | idle |
| 1 | running-right |
| 2 | running-left |
| 3 | waving |
| 4 | jumping |
| 5 | failed |
| 6 | waiting |
| 7 | running |
| 8 | review |

Each actor spritesheet is generated from a single transparent full-body portrait
(`portrait.png`). Regenerate the eight actor spritesheets with the command below (the
host/Boss spritesheet is supplied separately):

```bash
npm run assets:generate-sprites
```
