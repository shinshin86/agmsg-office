# agmsg Office

English | [日本語](README.ja.md)

![agmsg Office demo](docs/agmsg-office-demo.gif)

**agmsg Office** turns [`agmsg`](https://github.com/fujibee/agmsg) agent-to-agent
message logs into a little animated office: each agent becomes a character on a
stage, and the conversation is replayed as speech bubbles, one message at a time.
Instead of reading a flat log, you watch the agents "talk" to each other.

([`agmsg`](https://github.com/fujibee/agmsg) is cross-agent messaging for CLI AI
agents — a shared local SQLite "inbox" with no daemon and no network.)

It runs entirely in the browser — no backend and no API keys. The whole
thing is a static Vite + React app; the only server-side piece is an optional
dev-only helper that can read your local `agmsg` history while you run it.

---

## Features

- **Replay** an agmsg log message-by-message, with Start / Stop / Pause and a
  speed control.
- **Character stage** — agents are mapped to chibi characters; the speaking agent
  shows a bubble and the matching log row is highlighted and auto-scrolled into view.
- **Host narration** — a host character ("Boss") announces the start and end of a
  replay and narrates `ctrl:` system events.
- **Three log sources** — a bundled sample, your local `agmsg` data (dev mode), or
  a JSON file you import.
- **English / Japanese** UI with a language toggle (auto-detected from the browser,
  remembered across visits). The bundled demo log is available in both languages.
- **Theater mode** — hide the side panel and expand the stage to full width to focus
  on the characters.
- **Browser-only** — no server to run, no API key, no telemetry.

## Tech stack

- [Vite](https://vitejs.dev/) + [React 19](https://react.dev/) + TypeScript
- [Biome](https://biomejs.dev/) for lint/format
- Runtime dependencies: just `react` and `react-dom`. (A small Vite dev middleware
  reads local `agmsg` data during `npm run dev`; it is not part of the production
  build.)

## Quick start

```bash
npm install
npm run dev      # start the dev server
```

Then open the printed local URL. The bundled sample loads automatically — press
**Start** to play it.

```bash
npm run build    # type-check + production build (static files in dist/)
npm run preview  # preview the production build
npm run lint     # Biome lint/format check
```

---

## How it works

The app is a small pipeline from raw log records to an animated stage:

1. **Load** — a log source provides raw records in the `agmsg` message-table shape
   (see [Log format](#log-format)). Sources: the bundled sample, the local
   `agmsg` dev API, or an imported JSON file.
2. **Normalize** — `src/lib/agmsg.ts` converts raw records to internal entries
   (`from_agent` → `fromAgent`, etc.) and sorts them by the numeric `id`, which is
   agmsg's authoritative ordering. This is the single place log shape is handled.
3. **Assign characters** — distinct agent names are mapped to actor characters in
   first-seen order. When a log has more agents than actor sprites, the extra agents
   share a sprite via a stable hash of the name, so the same agent always gets the
   same character. The real agent name is always shown on the nameplate and bubble,
   so shared sprites stay unambiguous. The host ("Boss") is reserved and is never an
   agent.
4. **Replay** — a timer steps through the entries (the Speed control changes the
   interval). For each entry, the sending agent's character enters the "speaking"
   state with a bubble, the receiving agent's character is marked "waiting", and the
   matching log row is highlighted and scrolled into view.
5. **Host narration** — before the first entry the host announces an intro
   (`Welcome to <team>! Replaying <n> messages.`) and after the last entry an outro.
   Rows whose body starts with `ctrl:` (agmsg control messages, e.g. `ctrl:despawn`)
   are not treated as speech: they render as a muted **system note**, and the host
   narrates them (for `ctrl:despawn`, naming the agent that left — the recipient).
6. **Render** — `src/components/CharacterActor.tsx` draws each character from a
   spritesheet with idle / walk / gesture motion. Only the characters used by the
   current log appear (plus the host); they animate in when a log loads.

Everything above is client-side React state. The optional dev API
(`vite.config.ts`) is the only server-side code, and only runs under `npm run dev`.

## Using the app

The side panel holds the controls:

- **Source** — a dropdown to pick the log to play: **Sample** or any local `agmsg`
  team (dev mode). Selecting a source loads it (it does not auto-play).
- **Playback** — **Start** / **Stop** (a toggle), **Pause**, and a **Speed** slider.
- **Advanced** (collapsed by default) — **Import JSON**, **Reload current team**, and
  a **Show date** toggle for the log timestamps.
- **Language** — `EN` / `日本語` toggle in the header.
- **Theater** — a toggle in the caption bar (bottom of the stage) that hides the side
  panel and expands the stage to full width. Toggle it again to exit.
- **Current line** — the caption bar shows the active message; it is collapsible and
  fixed-height so the stage does not jump while playing.

---

## Supplying logs

agmsg Office accepts logs in the `agmsg` message-table JSON shape. There are three
ways to provide one.

### 1. Bundled sample

A public demo log ships with the app and loads on start. English and Japanese
versions live at:

```text
public/sample/agmsg-sample.json
public/sample/agmsg-sample.ja.json
```

Pick **Sample** in the Source dropdown to return to it at any time; the language
toggle swaps which one is shown.

### 2. Local agmsg (dev mode)

During `npm run dev`, the Vite dev server exposes a read-only helper API:

```text
GET /api/agmsg/teams
GET /api/agmsg/history?team=<team>&limit=80
```

It lists every team under `~/.agents/skills/agmsg/teams` and reads message history
through the installed `agmsg` scripts. Pick a team from the Source dropdown to replay
your real conversations. If the scripts or data are unavailable, it falls back to the
bundled sample. This middleware is dev-only and never ships in the production build.

### 3. Manual JSON import

Use **Import JSON** (in **Advanced**) to load a local `.json` file — an array of
records in the shape below.

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

A row whose `body` starts with `ctrl:` (e.g. `ctrl:despawn`) is an agmsg control
message and is shown as a system note rather than character speech.

## Characters

The host is **Boss** (the Miko character); she is always on stage, hosts the replay,
and never represents an agent. The actor sprites are **Mai, Haya, Suzu, Kii, Rin,
Nao, Mio, and Sora** — eight characters, one per distinct agent.

Agents fill the actor slots in first-seen order. With more than eight distinct
agents, the extras share an actor sprite via a stable name hash; the real agent name
always shows on the nameplate and bubble, so it is clear who is speaking. `agmsg`
teams have no hard size limit, so this keeps any team viewable.

## Project structure

```text
src/
  App.tsx                     # app shell: stage, controls, log panel, replay engine
  components/CharacterActor.tsx  # character sprite, motion, and speech bubble
  lib/agmsg.ts                # log normalization + agent→character mapping + formatting
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

Each spritesheet is generated from a single transparent full-body portrait
(`portrait.png`). Regenerate them with:

```bash
npm run assets:generate-sprites
```

## Credits

The Miko character (used here as the host, "Boss") is courtesy of Miko (AITuberOnAir):
https://miko.aituberonair.com/

## License

[MIT](LICENSE)
