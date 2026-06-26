# agmsg Office

agmsg Office replays `agmsg` agent-to-agent message logs as characters talking on
a stage. It runs fully in the browser with no production server and no API key.

## Quick Start

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run build
npm run lint
```

## Supplying Logs

agmsg Office accepts logs in the `agmsg` message-table JSON shape. You can load
data in three ways.

### 1. Bundled Sample

The app includes a public sample log at:

```text
public/sample/agmsg-sample.json
```

Use the **Sample** button to return to it at any time.

### 2. Local agmsg During Development

During `npm run dev`, the Vite dev server exposes a local helper API:

```text
GET /api/agmsg/teams
GET /api/agmsg/history?team=<team>&limit=80
```

The helper calls the installed `agmsg` scripts and reads local
`~/.agents/skills/agmsg` data through those scripts. If local data or scripts are
unavailable, it falls back to the bundled sample log.

### 3. Manual JSON Import

Use **Import JSON** in the Source panel to load a local `.json` file. The file
must contain an array of records with this shape:

```text
id, team, from_agent, to_agent, body, created_at, read_at
```

`agmsg` stores messages in SQLite and does not provide a built-in JSON export.
You can dump compatible JSON with `sqlite3`:

```bash
sqlite3 ~/.agents/skills/agmsg/db/messages.db "SELECT json_group_array(json_object('id',id,'team',team,'from_agent',from_agent,'to_agent',to_agent,'body',body,'created_at',created_at,'read_at',read_at)) FROM messages WHERE team='YOUR_TEAM' ORDER BY id;"
```

Save the output as a `.json` file, then import it in the browser.

## Log Format

Each record follows the current `agmsg` message table:

```ts
{
  "id": 1,
  "team": "product-studio",
  "from_agent": "lead",
  "to_agent": "dev",
  "body": "Please check the latest build.",
  "created_at": "2026-06-24T00:00:00Z",
  "read_at": null
}
```

Rows whose `body` starts with `ctrl:` are shown as muted system notes instead of
character speech.

## Characters

Miko is the always-idle host. Mai, Haya, Suzu, and Kii are the actor sprites.
Agents are assigned to actor sprites in first-seen order. When a log contains
more than four distinct agents, extra agents share sprites through a stable name
hash. The real agent name always appears on the nameplate and in the speech
bubble, so shared sprites remain clear.

## Assets

Character spritesheets live under:

```text
public/assets/characters/<id>/spritesheet.webp
```

The spritesheet rows follow this 8x9 atlas order:

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

Regenerate portrait-derived spritesheets with:

```bash
npm run assets:generate-sprites
```

## Credits

Miko character courtesy of Miko (AITuberOnAir):
https://miko.aituberonair.com/

## License

MIT
