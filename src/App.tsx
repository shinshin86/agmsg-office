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
import {
  type I18nKey,
  type Language,
  detectLanguage,
  detectShowDate,
  saveLanguage,
  saveShowDate,
  t as translateString,
} from "./lib/i18n";
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
const SAMPLE_LOG_URLS: Record<Language, string> = {
  en: "/sample/agmsg-sample.json",
  ja: "/sample/agmsg-sample.ja.json",
};

const DEFAULT_POSITIONS: Record<CharacterId, StageCharacter["position"]> = {
  miko: { x: 13, y: 66 },
  mai: { x: 24, y: 36 },
  haya: { x: 46, y: 55 },
  suzu: { x: 78, y: 34 },
  kii: { x: 70, y: 67 },
  nao: { x: 60, y: 41 },
  mio: { x: 35, y: 45 },
  rin: { x: 42, y: 70 },
  sora: { x: 60, y: 68 },
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
type Translate = (
  key: I18nKey,
  params?: Record<string, number | string>,
) => string;

function App() {
  const [language, setLanguageState] = useState<Language>(() =>
    detectLanguage(),
  );
  const [showDate, setShowDate] = useState(() => detectShowDate());
  const [theaterMode, setTheaterMode] = useState(false);
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
  const [hostAnnouncement, setHostAnnouncement] = useState<
    string | undefined
  >();
  const [showCaption, setShowCaption] = useState(true);
  const [showAdvancedSource, setShowAdvancedSource] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [agmsgError, setAgmsgError] = useState("");
  const [castKey, setCastKey] = useState(0);
  const runIdRef = useRef(0);
  const initialLanguageRef = useRef(language);
  const activeLogEntryRef = useRef<HTMLButtonElement | null>(null);
  const t = useCallback(
    (key: I18nKey, params?: Record<string, number | string>) =>
      translateString(language, key, params),
    [language],
  );

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
  const hostLine =
    hostAnnouncement ??
    getControlNarration(activeEntry?.body, t, activeEntry?.toAgent);
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
        hostLine,
      }),
    [
      agentMap,
      activeCharacterId,
      activeEntry?.fromAgent,
      activeEntry?.body,
      activeEntry?.toAgent,
      activeEntryIsControl,
      characterAssets,
      hostLine,
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
    setHostAnnouncement(undefined);
  }, []);

  const loadSampleLog = useCallback(
    async (nextLanguage = language) => {
      setLogLoading(true);
      resetPlayback();
      try {
        const rawRecords = await fetchSampleLog(nextLanguage);
        setEntries(normalizeAgmsgRecords(rawRecords));
        setCastKey((value) => value + 1);
        setLogSource("sample");
        setSelectedTeam("");
        setImportedFileName("");
        setAgmsgError("");
      } catch (error) {
        setAgmsgError(error instanceof Error ? error.message : String(error));
      } finally {
        setLogLoading(false);
      }
    },
    [language, resetPlayback],
  );

  const loadAgmsgTeam = useCallback(
    async (teamName: string) => {
      if (!teamName) return;

      setLogLoading(true);
      resetPlayback();
      try {
        const history = await fetchAgmsgHistory(teamName, language);
        const rawRecords =
          history.source === "sample"
            ? await fetchSampleLog(language)
            : history.entries;
        setEntries(normalizeAgmsgRecords(rawRecords));
        setCastKey((value) => value + 1);

        if (history.source === "sample") {
          setSelectedTeam("");
          setLogSource("sample");
          setImportedFileName("");
          setAgmsgError(
            t("errorUsingSample", {
              reason: localizeFallbackReason(history.fallbackReason, language),
            }),
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
    [language, resetPlayback, t],
  );

  const importJsonLog = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      if (!file) return;

      try {
        const rawRecords = parseImportedLog(await file.text(), t);
        resetPlayback();
        setEntries(normalizeAgmsgRecords(rawRecords));
        setCastKey((value) => value + 1);
        setSelectedTeam("");
        setLogSource("import");
        setImportedFileName(file.name);
        setAgmsgError("");
      } catch (error) {
        setAgmsgError(
          error instanceof Error ? error.message : t("errorImportRead"),
        );
      }
    },
    [resetPlayback, t],
  );

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const assetResponse = await fetch(`${ASSET_BASE}assets.json`);
        if (!assetResponse.ok) {
          throw new Error(
            translateString(initialLanguageRef.current, "errorLoadAssets"),
          );
        }

        const nextAssets = (await assetResponse.json()) as AssetsManifest;
        const characterResponse = await fetch(
          `${ASSET_BASE}${nextAssets.characters}`,
        );
        if (!characterResponse.ok) {
          throw new Error(
            translateString(initialLanguageRef.current, "errorLoadCharacters"),
          );
        }

        const nextCharacters =
          (await characterResponse.json()) as CharacterAsset[];

        if (!active) return;
        setAssetsManifest(nextAssets);
        setCharacterAssets(nextCharacters);

        const rawRecords = await fetchSampleLog(initialLanguageRef.current);
        if (!active) return;
        setEntries(normalizeAgmsgRecords(rawRecords));
        setCastKey((value) => value + 1);
        setLogSource("sample");
        setSelectedTeam("");
        setImportedFileName("");

        try {
          const nextTeams = await fetchAgmsgTeams(initialLanguageRef.current);
          if (!active) return;
          setTeams(nextTeams);
          setAgmsgError(
            nextTeams.length === 0
              ? translateString(initialLanguageRef.current, "errorNoTeams")
              : "",
          );
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
    setHostAnnouncement(undefined);
  }, []);

  const setAppLanguage = useCallback(
    (nextLanguage: Language) => {
      if (nextLanguage === language) return;
      saveLanguage(nextLanguage);
      setLanguageState(nextLanguage);
      if (logSource === "sample") {
        void loadSampleLog(nextLanguage);
      }
    },
    [language, loadSampleLog, logSource],
  );

  const toggleShowDate = useCallback(() => {
    setShowDate((value) => {
      const nextValue = !value;
      saveShowDate(nextValue);
      return nextValue;
    });
  }, []);

  const startReplay = useCallback(async () => {
    if (entries.length === 0) return;

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setPlaybackStatus("playing");
    setActiveEntryId(undefined);

    const firstTeam = entries[0]?.team ?? t("teamFallback");
    setHostAnnouncement(
      t("narrationIntro", {
        team: firstTeam,
        count: entries.length,
      }),
    );
    await sleep(REPLAY_DELAY_BASE_MS / speed);
    if (runIdRef.current !== runId) return;

    for (const entry of entries) {
      if (runIdRef.current !== runId) return;
      setHostAnnouncement(undefined);
      setActiveEntryId(entry.id);
      await sleep(REPLAY_DELAY_BASE_MS / speed);
    }

    if (runIdRef.current === runId) {
      setActiveEntryId(undefined);
      setHostAnnouncement(t("narrationOutro"));
      await sleep(REPLAY_DELAY_BASE_MS / speed);
    }

    if (runIdRef.current === runId) {
      setPlaybackStatus("idle");
      setActiveEntryId(undefined);
      setHostAnnouncement(undefined);
    }
  }, [entries, speed, t]);

  useEffect(() => {
    if (!activeEntryId) return;
    activeLogEntryRef.current?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [activeEntryId]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>agmsg Office</h1>
          <p>{t("topbarSubtitle")}</p>
        </div>
        <div className="language-toggle" aria-label={t("language")}>
          <button
            className={language === "en" ? "is-active" : ""}
            type="button"
            onClick={() => setAppLanguage("en")}
          >
            EN
          </button>
          <button
            className={language === "ja" ? "is-active" : ""}
            type="button"
            onClick={() => setAppLanguage("ja")}
          >
            日本語
          </button>
        </div>
      </header>

      <section className={`workspace${theaterMode ? " is-theater" : ""}`}>
        <section className="stage-panel" aria-label={t("stageLabel")}>
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
              <CharacterActor
                character={character}
                key={`${castKey}-${character.id}`}
              />
            ))}
          </div>
          <div className={`caption-bar${showCaption ? "" : " is-collapsed"}`}>
            <div className="caption-controls">
              <button
                aria-expanded={showCaption}
                className="caption-toggle"
                type="button"
                onClick={() => setShowCaption((value) => !value)}
              >
                <span>{t("captionCurrentLine")}</span>
                <span>{showCaption ? t("hide") : t("show")}</span>
              </button>
              <button
                aria-pressed={theaterMode}
                className={`theater-toggle${theaterMode ? " is-active" : ""}`}
                type="button"
                onClick={() => setTheaterMode((value) => !value)}
              >
                {theaterMode ? t("theaterExit") : t("theater")}
              </button>
            </div>
            <p className="caption-text" aria-hidden={!showCaption}>
              {hostAnnouncement
                ? hostAnnouncement
                : activeEntry
                  ? formatCaption(activeEntry, t)
                  : t("captionPlaceholder")}
            </p>
          </div>
        </section>

        <aside className="side-panel">
          <section className="controls-section">
            <h2>{t("source")}</h2>
            <label>
              {t("source")}
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
                <option value="">{t("sourceSampleOption")}</option>
                {teams.map((team) => (
                  <option key={team.name} value={team.name}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="meta-text">
              {formatSourceStatus({
                entriesCount: entries.length,
                importedFileName,
                loading: logLoading,
                logSource,
                selectedTeam,
                t,
              })}
            </p>
            {logSource === "agmsg" && teams.length > 0 && (
              <p className="meta-text">
                {t("agentsPrefix")}{" "}
                {teams
                  .find((team) => team.name === selectedTeam)
                  ?.agents.join(", ")
                  .trim() || t("unknown")}
              </p>
            )}
            {agmsgError && <p className="error-text">{agmsgError}</p>}
          </section>

          <section className="controls-section">
            <h2>{t("playback")}</h2>
            <div className="playback-actions">
              <button
                className="primary-playback-button"
                type="button"
                onClick={
                  playbackStatus === "playing"
                    ? stopReplay
                    : () => void startReplay()
                }
              >
                {playbackStatus === "playing" ? t("stop") : t("start")}
              </button>
              <button
                disabled={playbackStatus !== "playing"}
                type="button"
                onClick={pauseReplay}
              >
                {t("pause")}
              </button>
            </div>
            <label>
              {t("speed")}
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

          <section className="controls-section">
            <button
              aria-expanded={showAdvancedSource}
              className="advanced-toggle"
              type="button"
              onClick={() => setShowAdvancedSource((value) => !value)}
            >
              <span>{t("advanced")}</span>
              <span>{showAdvancedSource ? t("hide") : t("show")}</span>
            </button>
            {showAdvancedSource && (
              <div className="advanced-content">
                <label className="toggle-row">
                  <input
                    checked={showDate}
                    type="checkbox"
                    onChange={toggleShowDate}
                  />
                  <span>{t("showDate")}</span>
                </label>
                <label className="file-input">
                  {t("importJson")}
                  <input
                    accept="application/json,.json"
                    type="file"
                    onChange={importJsonLog}
                  />
                </label>
                <button
                  disabled={
                    logLoading || logSource !== "agmsg" || !selectedTeam
                  }
                  type="button"
                  onClick={() => void loadAgmsgTeam(selectedTeam)}
                >
                  {t("reloadCurrentTeam")}
                </button>
              </div>
            )}
          </section>

          <section className="log-list" aria-label={t("logListLabel")}>
            <h2>{formatLogHeading(logSource, selectedTeam, t)}</h2>
            {loadError && <p className="error-text">{loadError}</p>}
            {entries.map((entry) => (
              <button
                className={`log-entry${
                  entry.id === activeEntryId ? " is-active" : ""
                }${isControlMessage(entry.body) ? " is-system" : ""}`}
                key={entry.id}
                ref={entry.id === activeEntryId ? activeLogEntryRef : null}
                type="button"
                onClick={() => setActiveEntryId(entry.id)}
              >
                <span className="log-entry-inner">
                  <span className="log-meta">
                    {formatLogMeta(entry, language, showDate, t)}
                  </span>
                  <span className="log-body">{entry.body}</span>
                </span>
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
  hostLine,
  isActiveSpeaker,
  targetAgentName,
  targetCharacterId,
}: {
  agentMap: AgentCharacterMap;
  characterAssets: CharacterAsset[];
  activeCharacterId?: CharacterId;
  activeAgentName?: string;
  activeLine?: string;
  hostLine?: string;
  isActiveSpeaker: boolean;
  targetAgentName?: string;
  targetCharacterId?: CharacterId;
}): StageCharacter[] {
  const primaryAgentByCharacter = createPrimaryAgentByCharacter(agentMap);
  const neededCharacterIds = new Set<CharacterId>([
    HOST_CHARACTER_ID,
    ...Object.values(agentMap).filter(
      (characterId): characterId is CharacterId => Boolean(characterId),
    ),
  ]);

  return characterAssets
    .filter((asset) => neededCharacterIds.has(asset.id))
    .map((asset, index) => {
      let state: CharacterState = "idle";
      let currentLine: string | undefined;
      let displayName =
        asset.id === HOST_CHARACTER_ID
          ? asset.role
          : (primaryAgentByCharacter[asset.id] ?? asset.displayName);

      if (hostLine && asset.id === HOST_CHARACTER_ID) {
        state = "speaking";
        currentLine = hostLine;
      } else if (asset.id === activeCharacterId) {
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
        isActiveSpeaker:
          (hostLine && asset.id === HOST_CHARACTER_ID) ||
          (asset.id === activeCharacterId && isActiveSpeaker),
        entranceDelayMs: index * 70,
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

function formatCaption(entry: AgmsgEntry, t: Translate): string {
  if (isControlMessage(entry.body)) {
    return `${t("systemNotePrefix")} ${entry.body}`;
  }
  return `${entry.fromAgent} -> ${entry.toAgent}: ${entry.body}`;
}

function getControlNarration(
  body: string | undefined,
  t: Translate,
  toAgent?: string,
): string | undefined {
  if (!body || !isControlMessage(body)) return undefined;

  const command = body.trimStart().slice("ctrl:".length).trim();
  if (command === "despawn") {
    // For ctrl:despawn the agent that leaves is the recipient (to_agent);
    // the sender is whoever ran the despawn.
    return t("controlDespawn", { agent: toAgent ?? t("unknown") });
  }

  return t("controlGeneric", { command: command || "unknown" });
}

function formatLogMeta(
  entry: AgmsgEntry,
  language: Language,
  showDate: boolean,
  t: Translate,
): string {
  const time = formatClock(entry.createdAt, {
    locale: language === "ja" ? "ja-JP" : "en-US",
    showDate,
  });
  if (isControlMessage(entry.body)) {
    return `${time} · ${t("metaSystem")}`;
  }
  return `${time} · ${entry.fromAgent} -> ${entry.toAgent}`;
}

function formatLogHeading(
  logSource: LogSource,
  selectedTeam: string,
  t: Translate,
): string {
  if (logSource === "agmsg") return selectedTeam;
  if (logSource === "import") return t("logHeadingImport");
  return t("logHeadingSample");
}

function formatSourceStatus({
  entriesCount,
  importedFileName,
  loading,
  logSource,
  selectedTeam,
  t,
}: {
  entriesCount: number;
  importedFileName: string;
  loading: boolean;
  logSource: LogSource;
  selectedTeam: string;
  t: Translate;
}): string {
  if (loading) return t("sourceLoading");
  if (logSource === "agmsg") {
    return t("sourceLiveStatus", { team: selectedTeam, count: entriesCount });
  }
  if (logSource === "import") {
    const fileLabel = importedFileName || t("importedFileFallback");
    return t("sourceImportedStatus", {
      name: fileLabel,
      count: entriesCount,
    });
  }
  return t("sourceSampleStatus", { count: entriesCount });
}

function parseImportedLog(value: string, t: Translate): RawAgmsgRecord[] {
  let payload: unknown;
  try {
    payload = JSON.parse(value);
  } catch {
    throw new Error(t("errorImportInvalidJson"));
  }

  if (!Array.isArray(payload)) {
    throw new Error(t("errorImportNotArray"));
  }

  for (const [index, record] of payload.entries()) {
    if (!isRawAgmsgRecord(record)) {
      throw new Error(t("errorImportInvalidRecord", { index: index + 1 }));
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

function localizeFallbackReason(
  reason: string | undefined,
  language: Language,
): string {
  if (!reason || reason === "Local agmsg data is unavailable.") {
    return translateString(language, "errorLocalUnavailable");
  }
  return reason;
}

async function fetchAgmsgTeams(
  language: Language,
): Promise<AgmsgTeamSummary[]> {
  const response = await fetch("/api/agmsg/teams");
  if (!response.ok) {
    throw new Error(translateString(language, "errorLocalApi"));
  }

  const payload = (await response.json()) as AgmsgTeamsResponse;
  if (payload.error) {
    throw new Error(payload.error);
  }

  return payload.teams ?? [];
}

async function fetchAgmsgHistory(
  teamName: string,
  language: Language,
): Promise<AgmsgHistoryResult> {
  const response = await fetch(
    `/api/agmsg/history?team=${encodeURIComponent(teamName)}&limit=80`,
  );
  if (!response.ok) {
    throw new Error(
      translateString(language, "errorLoadAgmsgHistory", { team: teamName }),
    );
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

async function fetchSampleLog(language: Language): Promise<RawAgmsgRecord[]> {
  const response = await fetch(SAMPLE_LOG_URLS[language]);
  if (!response.ok) {
    throw new Error(translateString(language, "errorLoadSample"));
  }
  return (await response.json()) as RawAgmsgRecord[];
}

export default App;
