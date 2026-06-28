import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname);
const SAMPLE_LOG_PATH = join(PROJECT_ROOT, "public/sample/agmsg-sample.json");
const CUSTOM_CHARACTER_ROOT = join(
  PROJECT_ROOT,
  "public/assets/characters/custom",
);
const CUSTOM_CHARACTER_MANIFEST_PATH = join(
  CUSTOM_CHARACTER_ROOT,
  "characters.json",
);
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
const MAX_REQUEST_BYTES = 8_500_000;
const MAX_SPRITESHEET_BYTES = 3 * 1024 * 1024;
const MAX_PORTRAIT_BYTES = 2 * 1024 * 1024;
const SPRITESHEET_WIDTH = 1536;
const SPRITESHEET_HEIGHT = 1872;
const BUILTIN_CHARACTER_IDS = new Set([
  "miko",
  "mai",
  "haya",
  "suzu",
  "kii",
  "rin",
  "nao",
  "mio",
  "sora",
]);

interface RawAgmsgRecord {
  id: number | string;
  team: string;
  from_agent: string;
  to_agent: string;
  body: string;
  created_at: string;
  read_at?: string | null;
}

interface CharacterAsset {
  id: string;
  displayName: string;
  role: string;
  description: string;
  portraitPath?: string;
  spritesheetPath?: string;
  richMotion?: boolean;
}

interface UploadedFilePayload {
  name: string;
  mimeType: string;
  dataBase64: string;
}

interface CharacterUploadPayload {
  displayName: string;
  role?: string;
  spritesheet: UploadedFilePayload;
  portrait?: UploadedFilePayload;
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
      server.middlewares.use("/api/characters", (req, res) => {
        void handleCharacterRequest(req, res);
      });
    },
  };
}

async function handleCharacterRequest(
  req: IncomingMessage,
  res: ServerResponse,
) {
  if (!isLocalhostRequest(req)) {
    sendJson(res, { error: "Character writes are localhost only." }, 403);
    return;
  }

  try {
    if (req.method === "POST" && isApiRootPath(req.url)) {
      await handleCreateCharacter(req, res);
      return;
    }

    if (req.method === "DELETE") {
      await handleDeleteCharacter(req, res);
      return;
    }

    sendJson(res, { error: "Unsupported character API request." }, 405);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, { error: message }, errorStatusCode(error));
  }
}

async function handleCreateCharacter(
  req: IncomingMessage,
  res: ServerResponse,
) {
  if (!req.headers["content-type"]?.startsWith("application/json")) {
    sendJson(res, { error: "Expected application/json." }, 415);
    return;
  }

  const payload = parseCharacterUploadPayload(
    parseJsonBody(await readRequestBody(req, MAX_REQUEST_BYTES)),
  );
  const displayName = payload.displayName.trim();
  const role = payload.role?.trim() || "Stage actor";
  const spritesheet = decodeUploadedFile(
    payload.spritesheet,
    MAX_SPRITESHEET_BYTES,
  );
  validateWebpUpload(spritesheet, true);

  const portrait = payload.portrait
    ? decodeUploadedFile(payload.portrait, MAX_PORTRAIT_BYTES)
    : undefined;
  if (portrait) {
    validatePngUpload(portrait);
  }

  await mkdir(CUSTOM_CHARACTER_ROOT, { recursive: true });
  const manifest = await readCustomCharacterManifest();
  const id = createCustomCharacterId(displayName, manifest);
  const characterDir = resolveInsideCustomRoot(id);
  await mkdir(characterDir, { recursive: true });

  await writeFile(join(characterDir, "spritesheet.webp"), spritesheet.buffer);
  if (portrait) {
    await writeFile(join(characterDir, "portrait.png"), portrait.buffer);
  }

  const character: CharacterAsset = {
    id,
    displayName,
    role,
    description: "Custom character uploaded through agmsg Office.",
    ...(portrait ? { portraitPath: `custom/${id}/portrait.png` } : {}),
    spritesheetPath: `custom/${id}/spritesheet.webp`,
    richMotion: true,
  };

  await writeCustomCharacterManifest(upsertCharacter(manifest, character));
  sendJson(res, character, 201);
}

async function handleDeleteCharacter(
  req: IncomingMessage,
  res: ServerResponse,
) {
  const url = new URL(req.url ?? "", "http://localhost");
  const id = decodeURIComponent(url.pathname.replace(/^\/+/, "")).trim();
  if (!isSafeCustomCharacterId(id) || BUILTIN_CHARACTER_IDS.has(id)) {
    sendJson(res, { error: "Invalid custom character id." }, 400);
    return;
  }

  const characterDir = resolveInsideCustomRoot(id);
  await rm(characterDir, { recursive: true, force: true });
  const manifest = await readCustomCharacterManifest();
  await writeCustomCharacterManifest(
    manifest.filter((character) => character.id !== id),
  );
  sendJson(res, { ok: true, id });
}

function isLocalhostRequest(req: IncomingMessage): boolean {
  const address = req.socket.remoteAddress;
  return (
    address === "127.0.0.1" ||
    address === "::1" ||
    address === "::ffff:127.0.0.1"
  );
}

function isApiRootPath(value: string | undefined): boolean {
  const url = new URL(value ?? "", "http://localhost");
  return url.pathname === "/" || url.pathname === "";
}

function readRequestBody(
  req: IncomingMessage,
  maxBytes: number,
): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    req.on("data", (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        reject(createHttpError("Request body is too large.", 413));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolvePromise(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function parseCharacterUploadPayload(value: unknown): CharacterUploadPayload {
  if (!isRecord(value)) {
    throw createHttpError("Invalid upload payload.", 400);
  }

  const { displayName, role, spritesheet, portrait } = value;
  if (typeof displayName !== "string" || !displayName.trim()) {
    throw createHttpError("displayName is required.", 400);
  }
  if (role !== undefined && typeof role !== "string") {
    throw createHttpError("role must be a string.", 400);
  }
  if (!isUploadedFilePayload(spritesheet)) {
    throw createHttpError("spritesheet is required.", 400);
  }
  if (portrait !== undefined && !isUploadedFilePayload(portrait)) {
    throw createHttpError("portrait must be a file payload.", 400);
  }

  return {
    displayName,
    role,
    spritesheet,
    portrait,
  };
}

function parseJsonBody(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw createHttpError("Request body must be valid JSON.", 400);
  }
}

function isUploadedFilePayload(value: unknown): value is UploadedFilePayload {
  if (!isRecord(value)) return false;
  return (
    typeof value.name === "string" &&
    typeof value.mimeType === "string" &&
    typeof value.dataBase64 === "string"
  );
}

function decodeUploadedFile(
  file: UploadedFilePayload,
  maxBytes: number,
): UploadedFilePayload & { buffer: Buffer } {
  const buffer = Buffer.from(file.dataBase64, "base64");
  if (buffer.length === 0) {
    throw createHttpError(`${file.name} is empty.`, 400);
  }
  if (buffer.length > maxBytes) {
    throw createHttpError(`${file.name} is too large.`, 413);
  }
  return { ...file, buffer };
}

function validateWebpUpload(
  file: UploadedFilePayload & { buffer: Buffer },
  requireAtlasSize: boolean,
) {
  if (!file.name.toLowerCase().endsWith(".webp")) {
    throw createHttpError("Spritesheet must be a .webp file.", 400);
  }
  if (file.mimeType !== "image/webp") {
    throw createHttpError("Spritesheet MIME type must be image/webp.", 400);
  }
  if (!isWebp(file.buffer)) {
    throw createHttpError("Spritesheet is not a valid WEBP file.", 400);
  }

  const size = readWebpSize(file.buffer);
  if (requireAtlasSize && !size) {
    throw createHttpError("Unable to read spritesheet dimensions.", 400);
  }
  if (
    requireAtlasSize &&
    size &&
    (size.width !== SPRITESHEET_WIDTH || size.height !== SPRITESHEET_HEIGHT)
  ) {
    throw createHttpError(
      `Spritesheet must be ${SPRITESHEET_WIDTH}x${SPRITESHEET_HEIGHT}.`,
      400,
    );
  }
}

function validatePngUpload(file: UploadedFilePayload & { buffer: Buffer }) {
  if (!file.name.toLowerCase().endsWith(".png")) {
    throw createHttpError("Portrait must be a .png file.", 400);
  }
  if (file.mimeType !== "image/png") {
    throw createHttpError("Portrait MIME type must be image/png.", 400);
  }
  if (!isPng(file.buffer)) {
    throw createHttpError("Portrait is not a valid PNG file.", 400);
  }
}

function isWebp(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  );
}

function isPng(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

function readWebpSize(
  buffer: Buffer,
): { width: number; height: number } | undefined {
  if (!isWebp(buffer)) return undefined;

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    if (dataOffset + chunkSize > buffer.length) return undefined;

    if (chunkType === "VP8X" && chunkSize >= 10) {
      return {
        width: 1 + readUInt24LE(buffer, dataOffset + 4),
        height: 1 + readUInt24LE(buffer, dataOffset + 7),
      };
    }

    if (chunkType === "VP8 " && chunkSize >= 10) {
      if (
        buffer[dataOffset + 3] !== 0x9d ||
        buffer[dataOffset + 4] !== 0x01 ||
        buffer[dataOffset + 5] !== 0x2a
      ) {
        return undefined;
      }
      return {
        width: buffer.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: buffer.readUInt16LE(dataOffset + 8) & 0x3fff,
      };
    }

    if (chunkType === "VP8L" && chunkSize >= 5 && buffer[dataOffset] === 0x2f) {
      const byte1 = buffer[dataOffset + 1];
      const byte2 = buffer[dataOffset + 2];
      const byte3 = buffer[dataOffset + 3];
      const byte4 = buffer[dataOffset + 4];
      return {
        width: 1 + (((byte2 & 0x3f) << 8) | byte1),
        height: 1 + (((byte4 & 0x0f) << 10) | (byte3 << 2) | (byte2 >> 6)),
      };
    }

    offset = dataOffset + chunkSize + (chunkSize % 2);
  }

  return undefined;
}

function readUInt24LE(buffer: Buffer, offset: number): number {
  return (
    buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16)
  );
}

async function readCustomCharacterManifest(): Promise<CharacterAsset[]> {
  try {
    const raw = await readFile(CUSTOM_CHARACTER_MANIFEST_PATH, "utf8");
    const payload: unknown = JSON.parse(raw);
    if (!Array.isArray(payload)) return [];
    return payload.filter(isCharacterAsset);
  } catch {
    return [];
  }
}

async function writeCustomCharacterManifest(characters: CharacterAsset[]) {
  await mkdir(CUSTOM_CHARACTER_ROOT, { recursive: true });
  const tempPath = join(
    CUSTOM_CHARACTER_ROOT,
    `.characters-${process.pid}-${Date.now()}.tmp`,
  );
  await writeFile(tempPath, `${JSON.stringify(characters, null, 2)}\n`, "utf8");
  await rename(tempPath, CUSTOM_CHARACTER_MANIFEST_PATH);
}

function isCharacterAsset(value: unknown): value is CharacterAsset {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.displayName === "string" &&
    typeof value.role === "string" &&
    typeof value.description === "string" &&
    (value.portraitPath === undefined ||
      typeof value.portraitPath === "string") &&
    (value.spritesheetPath === undefined ||
      typeof value.spritesheetPath === "string") &&
    (value.richMotion === undefined || typeof value.richMotion === "boolean")
  );
}

function upsertCharacter(
  characters: CharacterAsset[],
  nextCharacter: CharacterAsset,
): CharacterAsset[] {
  return [
    ...characters.filter((character) => character.id !== nextCharacter.id),
    nextCharacter,
  ];
}

function createCustomCharacterId(
  displayName: string,
  characters: CharacterAsset[],
): string {
  const existingIds = new Set(characters.map((character) => character.id));
  const baseSlug = slugify(displayName) || "character";

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = randomBytes(3).toString("hex");
    const id = `custom-${baseSlug}-${suffix}`.slice(0, 64);
    if (!existingIds.has(id) && !BUILTIN_CHARACTER_IDS.has(id)) return id;
  }

  throw createHttpError("Unable to allocate a custom character id.", 500);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function resolveInsideCustomRoot(id: string): string {
  const targetPath = resolve(CUSTOM_CHARACTER_ROOT, id);
  const rootWithSeparator = `${resolve(CUSTOM_CHARACTER_ROOT)}${sep}`;
  if (!targetPath.startsWith(rootWithSeparator)) {
    throw createHttpError("Invalid custom character path.", 400);
  }
  return targetPath;
}

function isSafeCustomCharacterId(value: string): boolean {
  return /^custom-[a-z0-9][a-z0-9-]{0,63}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createHttpError(message: string, statusCode: number): Error {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
}

function errorStatusCode(error: unknown): number {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }
  return 500;
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
