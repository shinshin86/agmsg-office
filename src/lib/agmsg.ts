import type {
  AgentCharacterMap,
  AgmsgEntry,
  CharacterId,
  RawAgmsgRecord,
} from "../types";

export const FALLBACK_CHARACTER_ID: CharacterId = "kii";
export const HOST_CHARACTER_ID: CharacterId = "miko";
export const ACTOR_CHARACTER_IDS: CharacterId[] = [
  "mai",
  "haya",
  "suzu",
  "kii",
];

export function normalizeAgmsg(raw: RawAgmsgRecord): AgmsgEntry {
  return {
    id: String(raw.id),
    team: raw.team,
    fromAgent: raw.from_agent,
    toAgent: raw.to_agent,
    body: raw.body,
    createdAt: toIsoString(raw.created_at),
    readAt: raw.read_at ? toIsoString(raw.read_at) : undefined,
    raw,
  };
}

export function normalizeAgmsgRecords(
  rawRecords: RawAgmsgRecord[],
): AgmsgEntry[] {
  return rawRecords.map(normalizeAgmsg).sort(compareAgmsgEntries);
}

export function createAgentCharacterMap(
  entries: AgmsgEntry[],
): AgentCharacterMap {
  const agentMap: AgentCharacterMap = {};
  const firstSeenAgents = collectAgentNames(entries);

  for (const [index, agentName] of firstSeenAgents.entries()) {
    agentMap[agentName] =
      index < ACTOR_CHARACTER_IDS.length
        ? ACTOR_CHARACTER_IDS[index]
        : ACTOR_CHARACTER_IDS[
            stableHash(agentName) % ACTOR_CHARACTER_IDS.length
          ];
  }

  return agentMap;
}

export function resolveCharacterId(
  agentName: string,
  agentMap: AgentCharacterMap,
): CharacterId {
  return agentMap[agentName] ?? FALLBACK_CHARACTER_ID;
}

export function isControlMessage(body: string): boolean {
  return body.trimStart().startsWith("ctrl:");
}

export function formatClock(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function compareAgmsgEntries(left: AgmsgEntry, right: AgmsgEntry): number {
  const leftId = Number(left.id);
  const rightId = Number(right.id);
  if (Number.isFinite(leftId) && Number.isFinite(rightId)) {
    return leftId - rightId;
  }
  return left.id.localeCompare(right.id, undefined, { numeric: true });
}

function toIsoString(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}

function collectAgentNames(entries: AgmsgEntry[]): string[] {
  const names = new Set<string>();
  for (const entry of entries) {
    if (isControlMessage(entry.body)) continue;
    names.add(entry.fromAgent);
    names.add(entry.toAgent);
  }
  return [...names];
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
