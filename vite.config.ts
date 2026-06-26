import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname);
const SAMPLE_LOG_PATH = join(PROJECT_ROOT, "public/sample/agmsg-sample.json");
const AGMSG_SCRIPT_DIR = join(
  process.env.HOME ?? "",
  ".agents/skills/agmsg/scripts",
);
const AGMSG_TEAMS_DIR = join(
  process.env.HOME ?? "",
  ".agents/skills/agmsg/teams",
);
const SCRIPT_TIMEOUT_MS = 5000;
const FALLBACK_REASON = "Local agmsg data is unavailable.";

interface RawAgmsgRecord {
  id: number | string;
  team: string;
  from_agent: string;
  to_agent: string;
  body: string;
  created_at: string;
  read_at?: string | null;
}

export default defineConfig({
  plugins: [react(), agmsgDevApiPlugin()],
});

function agmsgDevApiPlugin(): Plugin {
  return {
    name: "agmsg-office-dev-api",
    configureServer(server) {
      server.middlewares.use("/api/agmsg/teams", (_req, res) => {
        void handleTeamsRequest(res);
      });
      server.middlewares.use("/api/agmsg/history", (req, res) => {
        void handleHistoryRequest(req, res);
      });
    },
  };
}

async function handleTeamsRequest(res: ServerResponse) {
  try {
    const teamNames = await readAgmsgTeamNames();
    const teams = await Promise.all(
      teamNames.map(async (teamName) => ({
        name: teamName,
        agents: parseTeamAgents(await runAgmsgScript("team.sh", [teamName])),
      })),
    );

    sendJson(res, {
      source: "agmsg",
      teams,
    });
  } catch {
    sendFallbackTeams(res);
  }
}

async function readAgmsgTeamNames(): Promise<string[]> {
  const entries = await readdir(AGMSG_TEAMS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function handleHistoryRequest(req: IncomingMessage, res: ServerResponse) {
  try {
    const url = new URL(req.url ?? "", "http://localhost");
    const team = url.searchParams.get("team")?.trim();
    const limit = normalizeLimit(url.searchParams.get("limit"));
    if (!team) {
      await sendFallbackHistory(res);
      return;
    }

    const output = await runAgmsgScript("history.sh", [
      team,
      "",
      String(limit),
    ]);
    sendJson(res, {
      source: "agmsg",
      team,
      entries: parseHistory(output, team),
    });
  } catch {
    await sendFallbackHistory(res);
  }
}

function runAgmsgScript(scriptName: string, args: string[]): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    execFile(
      join(AGMSG_SCRIPT_DIR, scriptName),
      args,
      { timeout: SCRIPT_TIMEOUT_MS },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(stderr.trim() || error.message || `${scriptName} failed`),
          );
          return;
        }
        resolvePromise(stdout);
      },
    );
  });
}

function parseTeamAgents(output: string): string[] {
  return output
    .split("\n")
    .map((line) => line.match(/^\s{2}(.+?)\s+\(/)?.[1])
    .filter((agentName): agentName is string => Boolean(agentName));
}

function parseHistory(output: string, team: string): RawAgmsgRecord[] {
  if (/No message history|No messages/.test(output)) return [];

  const entries = output
    .split("\n")
    .map((line, index) => {
      const match = line.match(/^\s*([●○]) \[([^\]]+)\] (.*?) → (.*?): (.*)$/);
      if (!match) return undefined;

      const [, status, createdAt, fromAgent, toAgent, body] = match;
      return {
        id: index + 1,
        team,
        from_agent: fromAgent,
        to_agent: toAgent,
        body: body.replace(/\\n/g, "\n").replace(/\\t/g, "\t"),
        created_at: createdAt,
        read_at: status === "○" ? createdAt : null,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  if (entries.length === 0 && output.trim()) {
    throw new Error("Unable to parse agmsg history output.");
  }

  return entries;
}

function normalizeLimit(value: string | null): number {
  const limit = Number(value);
  if (!Number.isFinite(limit)) return 80;
  return Math.min(Math.max(Math.floor(limit), 1), 200);
}

function sendJson(res: ServerResponse, payload: unknown, statusCode = 200) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readSampleEntries(): Promise<RawAgmsgRecord[]> {
  const raw = await readFile(SAMPLE_LOG_PATH, "utf8");
  const payload = JSON.parse(raw);
  if (!Array.isArray(payload)) {
    throw new Error("Sample log must be an array.");
  }
  return payload as RawAgmsgRecord[];
}

function sendFallbackTeams(res: ServerResponse) {
  sendJson(res, {
    source: "sample",
    fallbackReason: FALLBACK_REASON,
    teams: [],
  });
}

async function sendFallbackHistory(res: ServerResponse) {
  try {
    sendJson(res, {
      source: "sample",
      fallbackReason: FALLBACK_REASON,
      team: "sample",
      entries: await readSampleEntries(),
    });
  } catch {
    sendJson(
      res,
      {
        error: "Bundled sample log is unavailable.",
        source: "sample",
        entries: [],
      },
      500,
    );
  }
}
