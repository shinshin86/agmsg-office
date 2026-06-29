export type CharacterId =
  | "miko"
  | "mai"
  | "haya"
  | "suzu"
  | "kii"
  | "rin"
  | "nao"
  | "mio"
  | "sora";

export type CharacterRef = string;

export type SlotId =
  | "host"
  | "actor-1"
  | "actor-2"
  | "actor-3"
  | "actor-4"
  | "actor-5"
  | "actor-6"
  | "actor-7"
  | "actor-8";

export type CharacterState =
  | "idle"
  | "speaking"
  | "thinking"
  | "waiting"
  | "error";

export interface RawAgmsgRecord {
  id: number | string;
  team: string;
  from_agent: string;
  to_agent: string;
  body: string;
  created_at: string;
  read_at?: string | null;
}

export interface AgmsgTeamSummary {
  name: string;
  agents: string[];
}

export interface AgmsgEntry {
  id: string;
  team: string;
  fromAgent: string;
  toAgent: string;
  body: string;
  createdAt: string;
  readAt?: string;
  raw: RawAgmsgRecord;
}

export interface StageCharacter {
  id: SlotId;
  characterId: CharacterRef;
  displayName: string;
  portraitPath?: string;
  spritesheetPath?: string;
  richMotion: boolean;
  position: {
    x: number;
    y: number;
  };
  state: CharacterState;
  currentLine?: string;
  isActiveSpeaker: boolean;
  entranceDelayMs: number;
}

export type AgentCharacterMap = Partial<Record<string, SlotId>>;

export interface CharacterAsset {
  id: CharacterRef;
  displayName: string;
  role: string;
  description: string;
  portraitPath?: string;
  spritesheetPath?: string;
  richMotion?: boolean;
}

export interface CharacterConfig {
  casting: Partial<Record<SlotId, CharacterRef>>;
  renames: Partial<Record<CharacterRef, string>>;
}

export interface AssetsManifest {
  characters: string;
  backgrounds: Array<{
    id: string;
    displayName: string;
    description: string;
    path: string;
  }>;
  props: Array<{
    id: string;
    displayName: string;
    description: string;
    path: string;
  }>;
}
