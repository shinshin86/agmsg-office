import type {
  AgentCharacterMap,
  AgmsgEntry,
  RawAgmsgRecord,
  SlotId,
} from "../types";

export const FALLBACK_SLOT_ID: SlotId = "actor-4";
export const ACTOR_SLOT_IDS: SlotId[] = [
  "actor-1",
  "actor-2",
  "actor-3",
  "actor-4",
  "actor-5",
  "actor-6",
  "actor-7",
  "actor-8",
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
      index < ACTOR_SLOT_IDS.length
        ? ACTOR_SLOT_IDS[index]
        : ACTOR_SLOT_IDS[stableHash(agentName) % ACTOR_SLOT_IDS.length];
  }

  return agentMap;
}

export function resolveSlotId(
  agentName: string,
  agentMap: AgentCharacterMap,
): SlotId {
  return agentMap[agentName] ?? FALLBACK_SLOT_ID;
}

export function isControlMessage(body: string): boolean {
  return body.trimStart().startsWith("ctrl:");
}

export function formatClock(value: string, locale = "en-US"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
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
