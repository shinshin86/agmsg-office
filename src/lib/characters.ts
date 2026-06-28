import type {
  CharacterAsset,
  CharacterConfig,
  CharacterRef,
  SlotId,
  StageCharacter,
} from "../types";

export const CHARACTER_CONFIG_STORAGE_KEY = "agmsg-office:character-config";
export const CUSTOM_CHARACTERS_PATH = "characters/custom/characters.json";

export const SLOT_IDS: SlotId[] = [
  "host",
  "actor-1",
  "actor-2",
  "actor-3",
  "actor-4",
  "actor-5",
  "actor-6",
  "actor-7",
  "actor-8",
];

export const DEFAULT_CASTING: Record<SlotId, CharacterRef> = {
  host: "miko",
  "actor-1": "mai",
  "actor-2": "haya",
  "actor-3": "suzu",
  "actor-4": "kii",
  "actor-5": "rin",
  "actor-6": "nao",
  "actor-7": "mio",
  "actor-8": "sora",
};

export const DEFAULT_SLOT_POSITIONS: Record<
  SlotId,
  StageCharacter["position"]
> = {
  host: { x: 13, y: 66 },
  "actor-1": { x: 24, y: 36 },
  "actor-2": { x: 46, y: 55 },
  "actor-3": { x: 78, y: 34 },
  "actor-4": { x: 70, y: 67 },
  "actor-5": { x: 42, y: 70 },
  "actor-6": { x: 60, y: 41 },
  "actor-7": { x: 35, y: 45 },
  "actor-8": { x: 60, y: 68 },
};

const BUILTIN_RICH_MOTION_IDS = new Set<CharacterRef>([
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

export function readCharacterConfig(): CharacterConfig {
  try {
    const storedValue = localStorage.getItem(CHARACTER_CONFIG_STORAGE_KEY);
    if (!storedValue) return createEmptyCharacterConfig();

    const parsedValue: unknown = JSON.parse(storedValue);
    if (!isRecord(parsedValue)) return createEmptyCharacterConfig();

    return {
      casting: readCasting(parsedValue.casting),
      renames: readRenames(parsedValue.renames),
    };
  } catch {
    return createEmptyCharacterConfig();
  }
}

export function saveCharacterConfig(config: CharacterConfig) {
  try {
    const nextConfig = normalizeCharacterConfig(config);
    if (
      Object.keys(nextConfig.casting).length === 0 &&
      Object.keys(nextConfig.renames).length === 0
    ) {
      localStorage.removeItem(CHARACTER_CONFIG_STORAGE_KEY);
      return;
    }
    localStorage.setItem(
      CHARACTER_CONFIG_STORAGE_KEY,
      JSON.stringify(nextConfig),
    );
  } catch {
    // Ignore storage failures; the in-memory casting still applies.
  }
}

export function normalizeCharacterConfig(
  config: CharacterConfig,
): CharacterConfig {
  return {
    casting: readCasting(config.casting),
    renames: readRenames(config.renames),
  };
}

export function getResolvedCharacterId(
  slotId: SlotId,
  config: CharacterConfig,
  characterAssets: CharacterAsset[],
): CharacterRef {
  const characterById = createCharacterById(characterAssets);
  const configuredId = config.casting[slotId];
  if (configuredId && characterById.has(configuredId)) {
    return configuredId;
  }
  return DEFAULT_CASTING[slotId];
}

export function getCharacterDisplayName(
  character: CharacterAsset,
  config: CharacterConfig,
): string {
  const rename = config.renames[character.id];
  if (typeof rename === "string" && rename.trim()) return rename.trim();
  return character.displayName;
}

export function isCastingOverride(
  slotId: SlotId,
  characterId: CharacterRef,
): boolean {
  return characterId !== DEFAULT_CASTING[slotId];
}

export function isCastingFallback(
  slotId: SlotId,
  config: CharacterConfig,
  characterAssets: CharacterAsset[],
): boolean {
  const configuredId = config.casting[slotId];
  if (!configuredId) return false;
  return !createCharacterById(characterAssets).has(configuredId);
}

export function mergeCharacterAssets(
  builtinCharacters: CharacterAsset[],
  customCharacters: CharacterAsset[],
): CharacterAsset[] {
  const builtinIds = new Set(
    builtinCharacters.map((character) => character.id),
  );
  const customIds = new Set<CharacterRef>();
  const acceptedCustomCharacters: CharacterAsset[] = [];

  for (const character of customCharacters) {
    if (builtinIds.has(character.id)) {
      console.warn(
        `Ignoring custom character "${character.id}" because it conflicts with a built-in character id.`,
      );
      continue;
    }
    if (customIds.has(character.id)) {
      console.warn(
        `Ignoring duplicate custom character "${character.id}" in custom characters manifest.`,
      );
      continue;
    }
    customIds.add(character.id);
    acceptedCustomCharacters.push(character);
  }

  return [...builtinCharacters, ...acceptedCustomCharacters];
}

export function normalizeCharacterAsset(
  character: CharacterAsset,
): CharacterAsset {
  const isBuiltinCharacter = Object.values(DEFAULT_CASTING).includes(
    character.id,
  );

  return {
    ...character,
    richMotion:
      character.richMotion ??
      (isBuiltinCharacter ? BUILTIN_RICH_MOTION_IDS.has(character.id) : true),
  };
}

export function createCharacterById(characterAssets: CharacterAsset[]) {
  return new Map(characterAssets.map((character) => [character.id, character]));
}

export function createEmptyCharacterConfig(): CharacterConfig {
  return {
    casting: {},
    renames: {},
  };
}

function readCasting(value: unknown): CharacterConfig["casting"] {
  if (!isRecord(value)) return {};

  const casting: CharacterConfig["casting"] = {};
  for (const [slotId, characterId] of Object.entries(value)) {
    if (!isSlotId(slotId) || typeof characterId !== "string") continue;
    if (!characterId.trim()) continue;
    if (characterId === DEFAULT_CASTING[slotId]) continue;
    casting[slotId] = characterId;
  }
  return casting;
}

function readRenames(value: unknown): CharacterConfig["renames"] {
  if (!isRecord(value)) return {};

  const renames: CharacterConfig["renames"] = {};
  for (const [characterId, displayName] of Object.entries(value)) {
    if (!characterId.trim() || typeof displayName !== "string") continue;
    if (!displayName.trim()) continue;
    renames[characterId] = displayName;
  }
  return renames;
}

function isSlotId(value: string): value is SlotId {
  return SLOT_IDS.includes(value as SlotId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
