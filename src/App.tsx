import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CharacterActor } from "./components/CharacterActor";
import {
  HOST_CHARACTER_ID,
  createAgentCharacterMap,
  formatClock,
  isControlMessage,
  normalizeAgmsgRecords,
  resolveCharacterId,
} from "./lib/agmsg";
import type {
  AgentCharacterMap,
  AgmsgEntry,
  AgmsgTeamSummary,
  AssetsManifest,
  CharacterAsset,
  CharacterId,
  CharacterState,
  RawAgmsgRecord,
  StageCharacter,
} from "./types";
import "./styles/app.css";

const ASSET_BASE = "/assets/";
const SAMPLE_LOG_URL = "/sample/agmsg-sample.json";

const DEFAULT_POSITIONS: Record<CharacterId, StageCharacter["position"]> = {
  miko: { x: 13, y: 66 },
  mai: { x: 24, y: 36 },
  haya: { x: 46, y: 55 },
  suzu: { x: 78, y: 34 },
  kii: { x: 70, y: 67 },
};

const REPLAY_DELAY_BASE_MS = 2600;

type AgmsgTeamsResponse = {
  teams: AgmsgTeamSummary[];
  error?: string;
  source?: "agmsg" | "sample";
  fallbackReason?: string;
};

type AgmsgHistoryResponse = {
  entries: RawAgmsgRecord[];
  error?: string;
  source?: "agmsg" | "sample";
  fallbackReason?: string;
};

type AgmsgHistoryResult = {
  entries: RawAgmsgRecord[];
  source: "agmsg" | "sample";
  fallbackReason?: string;
};

type LogSource = "agmsg" | "sample" | "import";

function App() {
  const [assetsManifest, setAssetsManifest] = useState<AssetsManifest | null>(
    null,
  );
  const [characterAssets, setCharacterAssets] = useState<CharacterAsset[]>([]);
  const [entries, setEntries] = useState<AgmsgEntry[]>([]);
  const [teams, setTeams] = useState<AgmsgTeamSummary[]>([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [logSource, setLogSource] = useState<LogSource>("sample");
  const [importedFileName, setImportedFileName] = useState("");
  const [logLoading, setLogLoading] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [playbackStatus, setPlaybackStatus] = useState<
    "idle" | "playing" | "paused"
  >("idle");
  const [activeEntryId, setActiveEntryId] = useState<string | undefined>();
  const [showCaption, setShowCaption] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [agmsgError, setAgmsgError] = useState("");
  const runIdRef = useRef(0);

  const agentMap = useMemo<AgentCharacterMap>(
    () => createAgentCharacterMap(entries),
    [entries],
  );
  const activeEntry = useMemo(
    () => entries.find((entry) => entry.id === activeEntryId),
    [activeEntryId, entries],
  );
  const activeEntryIsControl = activeEntry
    ? isControlMessage(activeEntry.body)
    : false;
  const activeCharacterId =
    activeEntry && !activeEntryIsControl
      ? resolveCharacterId(activeEntry.fromAgent, agentMap)
      : undefined;
  const targetCharacterId =
    activeEntry?.toAgent && !activeEntryIsControl
      ? resolveCharacterId(activeEntry.toAgent, agentMap)
      : undefined;
  const characters = useMemo(
    () =>
      createStageCharacters({
        agentMap,
        characterAssets,
        activeCharacterId,
        activeAgentName: activeEntryIsControl
          ? undefined
          : activeEntry?.fromAgent,
        activeLine: activeEntry?.body,
        isActiveSpeaker: playbackStatus === "playing",
        targetAgentName: activeEntryIsControl
          ? undefined
          : activeEntry?.toAgent,
        targetCharacterId,
      }),
    [
      agentMap,
      activeCharacterId,
      activeEntry?.fromAgent,
      activeEntry?.body,
      activeEntry?.toAgent,
      activeEntryIsControl,
      characterAssets,
      playbackStatus,
      targetCharacterId,
    ],
  );
  const officeBackground =
    assetsManifest?.backgrounds.find((item) => item.id === "office-main")
      ?.path ?? "";
  const deskProp =
    assetsManifest?.props.find((item) => item.id === "desk-island")?.path ?? "";

  const resetPlayback = useCallback(() => {
    runIdRef.current += 1;
    setPlaybackStatus("idle");
    setActiveEntryId(undefined);
  }, []);

  const loadSampleLog = useCallback(async () => {
    setLogLoading(true);
    resetPlayback();
    try {
      const rawRecords = await fetchSampleLog();
      setEntries(normalizeAgmsgRecords(rawRecords));
      setLogSource("sample");
      setSelectedTeam("");
      setImportedFileName("");
      setAgmsgError("");
    } catch (error) {
      setAgmsgError(error instanceof Error ? error.message : String(error));
    } finally {
      setLogLoading(false);
    }
  }, [resetPlayback]);

  const loadAgmsgTeam = useCallback(
    async (teamName: string) => {
      if (!teamName) return;

      setLogLoading(true);
      resetPlayback();
      try {
        const history = await fetchAgmsgHistory(teamName);
        setEntries(normalizeAgmsgRecords(history.entries));

        if (history.source === "sample") {
          setSelectedTeam("");
          setLogSource("sample");
          setImportedFileName("");
          setAgmsgError(
            `Using sample log: ${
              history.fallbackReason ?? "Local agmsg data is unavailable."
            }`,
          );
        } else {
          setSelectedTeam(teamName);
          setLogSource("agmsg");
          setImportedFileName("");
          setAgmsgError("");
        }
      } catch (error) {
        setAgmsgError(error instanceof Error ? error.message : String(error));
      } finally {
        setLogLoading(false);
      }
    },
    [resetPlayback],
  );

  const importJsonLog = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      if (!file) return;

      try {
        const rawRecords = parseImportedLog(await file.text());
        resetPlayback();
        setEntries(normalizeAgmsgRecords(rawRecords));
        setSelectedTeam("");
        setLogSource("import");
        setImportedFileName(file.name);
        setAgmsgError("");
      } catch (error) {
        setAgmsgError(
          error instanceof Error
            ? error.message
            : "Import failed. Choose a JSON file containing agmsg message records.",
        );
      }
    },
    [resetPlayback],
  );

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const assetResponse = await fetch(`${ASSET_BASE}assets.json`);
        if (!assetResponse.ok) {
          throw new Error("Failed to load assets.json");
        }

        const nextAssets = (await assetResponse.json()) as AssetsManifest;
        const characterResponse = await fetch(
          `${ASSET_BASE}${nextAssets.characters}`,
        );
        if (!characterResponse.ok) {
          throw new Error("Failed to load character assets");
        }

        const nextCharacters =
          (await characterResponse.json()) as CharacterAsset[];

        if (!active) return;
        setAssetsManifest(nextAssets);
        setCharacterAssets(nextCharacters);

        const rawRecords = await fetchSampleLog();
        if (!active) return;
        setEntries(normalizeAgmsgRecords(rawRecords));
        setLogSource("sample");
        setSelectedTeam("");
        setImportedFileName("");

        try {
          const nextTeams = await fetchAgmsgTeams();
          if (!active) return;
          setTeams(nextTeams);
          setAgmsgError("");
        } catch {
          if (!active) return;
          setTeams([]);
          setAgmsgError("");
        }
      } catch (error) {
        if (active) {
          setLoadError(error instanceof Error ? error.message : String(error));
        }
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, []);

  const stopReplay = useCallback(() => {
    resetPlayback();
  }, [resetPlayback]);

  const pauseReplay = useCallback(() => {
    runIdRef.current += 1;
    setPlaybackStatus("paused");
  }, []);

  const startReplay = useCallback(async () => {
    if (entries.length === 0) return;

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setPlaybackStatus("playing");

    for (const entry of entries) {
      if (runIdRef.current !== runId) return;
      setActiveEntryId(entry.id);
      await sleep(REPLAY_DELAY_BASE_MS / speed);
    }

    if (runIdRef.current === runId) {
      setPlaybackStatus("idle");
      setActiveEntryId(undefined);
    }
  }, [entries, speed]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>agmsg Office</h1>
          <p>Replay agent messages as a character stage.</p>
        </div>
      </header>

      <section className="workspace">
        <section className="stage-panel" aria-label="Agent stage">
          <div
            className="stage-background"
            style={{
              backgroundImage: officeBackground
                ? `url(${ASSET_BASE}${officeBackground})`
                : undefined,
            }}
          >
            {deskProp && (
              <img
                alt=""
                className="desk-prop desk-prop-left"
                src={`${ASSET_BASE}${deskProp}`}
              />
            )}
            {deskProp && (
              <img
                alt=""
                className="desk-prop desk-prop-right"
                src={`${ASSET_BASE}${deskProp}`}
              />
            )}
            {characters.map((character) => (
              <CharacterActor character={character} key={character.id} />
            ))}
          </div>
          <div className={`caption-bar${showCaption ? "" : " is-collapsed"}`}>
            <button
              aria-expanded={showCaption}
              className="caption-toggle"
              type="button"
              onClick={() => setShowCaption((value) => !value)}
            >
              <span>Current line</span>
              <span>{showCaption ? "Hide" : "Show"}</span>
            </button>
            <p className="caption-text" aria-hidden={!showCaption}>
              {activeEntry
                ? formatCaption(activeEntry)
                : "Replay text will appear here."}
            </p>
          </div>
        </section>

        <aside className="side-panel">
          <section className="controls-section">
            <h2>Source</h2>
            <label>
              Team
              <select
                disabled={logLoading}
                value={logSource === "agmsg" ? selectedTeam : ""}
                onChange={(event) => {
                  const teamName = event.target.value;
                  if (teamName) {
                    void loadAgmsgTeam(teamName);
                  } else {
                    void loadSampleLog();
                  }
                }}
              >
                <option value="">Sample log</option>
                {teams.map((team) => (
                  <option key={team.name} value={team.name}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="button-row">
              <button
                disabled={logLoading || !selectedTeam}
                type="button"
                onClick={() => void loadAgmsgTeam(selectedTeam)}
              >
                Reload
              </button>
              <button
                disabled={logLoading}
                type="button"
                onClick={() => void loadSampleLog()}
              >
                Sample
              </button>
            </div>
            <label className="file-input">
              Import JSON
              <input
                accept="application/json,.json"
                type="file"
                onChange={importJsonLog}
              />
            </label>
            <p className="meta-text">
              {formatSourceStatus({
                entriesCount: entries.length,
                importedFileName,
                loading: logLoading,
                logSource,
                selectedTeam,
              })}
            </p>
            {logSource === "agmsg" && teams.length > 0 && (
              <p className="meta-text">
                Agents:{" "}
                {teams
                  .find((team) => team.name === selectedTeam)
                  ?.agents.join(", ")
                  .trim() || "unknown"}
              </p>
            )}
            {agmsgError && <p className="error-text">{agmsgError}</p>}
          </section>

          <section className="controls-section">
            <h2>Playback</h2>
            <div className="button-row">
              <button
                disabled={playbackStatus === "playing"}
                type="button"
                onClick={() => void startReplay()}
              >
                Play
              </button>
              <button
                disabled={playbackStatus !== "playing"}
                type="button"
                onClick={pauseReplay}
              >
                Pause
              </button>
              <button type="button" onClick={stopReplay}>
                Stop
              </button>
            </div>
            <label>
              Speed
              <input
                max="2"
                min="0.5"
                step="0.25"
                type="range"
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
              />
              <span>{speed.toFixed(2)}x</span>
            </label>
          </section>

          <section className="log-list" aria-label="agmsg entries">
            <h2>{formatLogHeading(logSource, selectedTeam)}</h2>
            {loadError && <p className="error-text">{loadError}</p>}
            {entries.map((entry) => (
              <button
                className={`log-entry${
                  entry.id === activeEntryId ? " is-active" : ""
                }${isControlMessage(entry.body) ? " is-system" : ""}`}
                key={entry.id}
                type="button"
                onClick={() => setActiveEntryId(entry.id)}
              >
                <span className="log-meta">{formatLogMeta(entry)}</span>
                <span className="log-body">{entry.body}</span>
              </button>
            ))}
          </section>
        </aside>
      </section>
    </main>
  );
}

function createStageCharacters({
  agentMap,
  characterAssets,
  activeCharacterId,
  activeAgentName,
  activeLine,
  isActiveSpeaker,
  targetAgentName,
  targetCharacterId,
}: {
  agentMap: AgentCharacterMap;
  characterAssets: CharacterAsset[];
  activeCharacterId?: CharacterId;
  activeAgentName?: string;
  activeLine?: string;
  isActiveSpeaker: boolean;
  targetAgentName?: string;
  targetCharacterId?: CharacterId;
}): StageCharacter[] {
  const primaryAgentByCharacter = createPrimaryAgentByCharacter(agentMap);

  return characterAssets.map((asset) => {
    let state: CharacterState = "idle";
    let currentLine: string | undefined;
    let displayName =
      asset.id === HOST_CHARACTER_ID
        ? asset.displayName
        : (primaryAgentByCharacter[asset.id] ?? asset.displayName);

    if (asset.id === activeCharacterId) {
      state = "speaking";
      currentLine = activeLine;
      displayName = activeAgentName ?? displayName;
    } else if (asset.id === targetCharacterId) {
      state = "waiting";
      displayName = targetAgentName ?? displayName;
    }

    return {
      id: asset.id,
      displayName,
      portraitPath: asset.portraitPath,
      spritesheetPath: asset.spritesheetPath,
      position: DEFAULT_POSITIONS[asset.id],
      state,
      currentLine,
      isActiveSpeaker: asset.id === activeCharacterId && isActiveSpeaker,
    };
  });
}

function createPrimaryAgentByCharacter(
  agentMap: AgentCharacterMap,
): Partial<Record<CharacterId, string>> {
  const primaryAgentByCharacter: Partial<Record<CharacterId, string>> = {};
  for (const [agentName, characterId] of Object.entries(agentMap)) {
    if (!characterId || primaryAgentByCharacter[characterId]) continue;
    primaryAgentByCharacter[characterId] = agentName;
  }
  return primaryAgentByCharacter;
}

function formatCaption(entry: AgmsgEntry): string {
  if (isControlMessage(entry.body)) {
    return `System note: ${entry.body}`;
  }
  return `${entry.fromAgent} -> ${entry.toAgent}: ${entry.body}`;
}

function formatLogMeta(entry: AgmsgEntry): string {
  const time = formatClock(entry.createdAt);
  if (isControlMessage(entry.body)) {
    return `${time} · System`;
  }
  return `${time} · ${entry.fromAgent} -> ${entry.toAgent}`;
}

function formatLogHeading(logSource: LogSource, selectedTeam: string): string {
  if (logSource === "agmsg") return selectedTeam;
  if (logSource === "import") return "imported file";
  return "agmsg sample";
}

function formatSourceStatus({
  entriesCount,
  importedFileName,
  loading,
  logSource,
  selectedTeam,
}: {
  entriesCount: number;
  importedFileName: string;
  loading: boolean;
  logSource: LogSource;
  selectedTeam: string;
}): string {
  if (loading) return "Loading log...";
  if (logSource === "agmsg") {
    return `Live agmsg: ${selectedTeam} (${entriesCount} entries)`;
  }
  if (logSource === "import") {
    const fileLabel = importedFileName || "imported file";
    return `Imported file: ${fileLabel} (${entriesCount} entries)`;
  }
  return `Sample log (${entriesCount} entries)`;
}

function parseImportedLog(value: string): RawAgmsgRecord[] {
  let payload: unknown;
  try {
    payload = JSON.parse(value);
  } catch {
    throw new Error("Import failed. The selected file is not valid JSON.");
  }

  if (!Array.isArray(payload)) {
    throw new Error("Import failed. The JSON file must contain an array.");
  }

  for (const [index, record] of payload.entries()) {
    if (!isRawAgmsgRecord(record)) {
      throw new Error(
        `Import failed. Record ${index + 1} must include id, team, from_agent, to_agent, body, created_at, and optional read_at.`,
      );
    }
  }

  return payload;
}

function isRawAgmsgRecord(value: unknown): value is RawAgmsgRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<RawAgmsgRecord>;
  const hasValidId =
    typeof record.id === "number" || typeof record.id === "string";
  const hasValidReadAt =
    record.read_at === undefined ||
    record.read_at === null ||
    typeof record.read_at === "string";

  return (
    hasValidId &&
    typeof record.team === "string" &&
    typeof record.from_agent === "string" &&
    typeof record.to_agent === "string" &&
    typeof record.body === "string" &&
    typeof record.created_at === "string" &&
    hasValidReadAt
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchAgmsgTeams(): Promise<AgmsgTeamSummary[]> {
  const response = await fetch("/api/agmsg/teams");
  if (!response.ok) {
    throw new Error("Local agmsg API is not available.");
  }

  const payload = (await response.json()) as AgmsgTeamsResponse;
  if (payload.error) {
    throw new Error(payload.error);
  }

  return payload.teams ?? [];
}

async function fetchAgmsgHistory(
  teamName: string,
): Promise<AgmsgHistoryResult> {
  const response = await fetch(
    `/api/agmsg/history?team=${encodeURIComponent(teamName)}&limit=80`,
  );
  if (!response.ok) {
    throw new Error(`Failed to load agmsg history for ${teamName}.`);
  }

  const payload = (await response.json()) as AgmsgHistoryResponse;
  if (payload.error) {
    throw new Error(payload.error);
  }

  return {
    entries: payload.entries,
    source: payload.source ?? "agmsg",
    fallbackReason: payload.fallbackReason,
  };
}

async function fetchSampleLog(): Promise<RawAgmsgRecord[]> {
  const response = await fetch(SAMPLE_LOG_URL);
  if (!response.ok) {
    throw new Error("Failed to load sample agmsg log");
  }
  return (await response.json()) as RawAgmsgRecord[];
}

export default App;
