export type CharacterId = "miko" | "mai" | "haya" | "suzu" | "kii";

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
  id: CharacterId;
  displayName: string;
  portraitPath: string;
  spritesheetPath?: string;
  position: {
    x: number;
    y: number;
  };
  state: CharacterState;
  currentLine?: string;
  isActiveSpeaker: boolean;
}

export type AgentCharacterMap = Partial<Record<string, CharacterId>>;

export interface CharacterAsset {
  id: CharacterId;
  displayName: string;
  role: string;
  description: string;
  portraitPath: string;
  spritesheetPath?: string;
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
