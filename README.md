# agmsg Office

English | [日本語](README.ja.md)

![agmsg Office demo](docs/agmsg-office-demo.gif)

**agmsg Office** replays [`agmsg`](https://github.com/fujibee/agmsg) agent-to-agent
message logs as characters talking on a stage — instead of reading a flat log, you
watch the agents take turns speaking. It runs entirely in the browser (a static
Vite + React app), with no backend and no API keys.

## Quick start

```bash
npm install
npm run dev
```

Open the printed URL — the bundled sample loads automatically, so press **Start** to
play it. Use `npm run build` for a production build and `npm run lint` to check
formatting.

## How it works

agmsg Office loads an agmsg log, normalizes it, assigns each agent a character, and
replays the messages one at a time: the speaking agent shows a speech bubble while
the matching log row is highlighted. A host character narrates the start, the end,
and any system events.

Logs come from one of three places: the **bundled sample** (the default), your
**local agmsg history** (in dev mode), or a **JSON file you import**.

## Learn more

See **[docs/details.md](docs/details.md)** for the controls, the log format, the
character roster, the project structure, and how the pieces fit together.

## Credits

The Miko character (used here as the host, "Boss") is courtesy of Miko (AITuberOnAir):
https://miko.aituberonair.com/

## License

[MIT](LICENSE)
