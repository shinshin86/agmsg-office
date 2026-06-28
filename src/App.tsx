import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CastingPanel } from "./components/CastingPanel";
import { CharacterActor } from "./components/CharacterActor";
import {
  createAgentCharacterMap,
  formatClock,
  isControlMessage,
  normalizeAgmsgRecords,
  resolveSlotId,
} from "./lib/agmsg";
import {
  CUSTOM_CHARACTERS_PATH,
  DEFAULT_CASTING,
  DEFAULT_SLOT_POSITIONS,
  SLOT_IDS,
  createCharacterById,
  getCharacterDisplayName,
  getResolvedCharacterId,
  mergeCharacterAssets,
  normalizeCharacterAsset,
  readCharacterConfig,
  saveCharacterConfig,
} from "./lib/characters";
import {
  type I18nKey,
  type Language,
  detectAmbientMotion,
  detectLanguage,
  detectShowDate,
  saveAmbientMotion,
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
  CharacterConfig,
  CharacterRef,
  CharacterState,
  RawAgmsgRecord,
  SlotId,
  StageCharacter,
} from "./types";
import "./styles/app.css";

const ASSET_BASE = "/assets/";
const SAMPLE_LOG_URLS: Record<Language, string> = {
  en: "/sample/agmsg-sample.json",
  ja: "/sample/agmsg-sample.ja.json",
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

interface CharacterAssetReconcileOptions {
  upsert?: CharacterAsset[];
  removeIds?: string[];
}

function App() {
  const [language, setLanguageState] = useState<Language>(() =>
    detectLanguage(),
  );
  const [showDate, setShowDate] = useState(() => detectShowDate());
  const [ambientMotion, setAmbientMotion] = useState(() =>
    detectAmbientMotion(),
  );
  const [theaterMode, setTheaterMode] = useState(false);
  const [assetsManifest, setAssetsManifest] = useState<AssetsManifest | null>(
    null,
  );
  const [characterAssets, setCharacterAssets] = useState<CharacterAsset[]>([]);
  const [characterConfig, setCharacterConfig] = useState<CharacterConfig>(() =>
    readCharacterConfig(),
  );
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
  const [showCastingPanel, setShowCastingPanel] = useState(false);
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
  const activeSlotId =
    activeEntry && !activeEntryIsControl
      ? resolveSlotId(activeEntry.fromAgent, agentMap)
      : undefined;
  const targetSlotId =
    activeEntry?.toAgent && !activeEntryIsControl
      ? resolveSlotId(activeEntry.toAgent, agentMap)
      : undefined;
  const hostLine =
    hostAnnouncement ??
    getControlNarration(activeEntry?.body, t, activeEntry?.toAgent);
  const characters = useMemo(
    () =>
      createStageCharacters({
        agentMap,
        characterAssets,
        characterConfig,
        activeSlotId,
        activeAgentName: activeEntryIsControl
          ? undefined
          : activeEntry?.fromAgent,
        activeLine: activeEntry?.body,
        isActiveSpeaker: playbackStatus === "playing",
        targetAgentName: activeEntryIsControl
          ? undefined
          : activeEntry?.toAgent,
        targetSlotId,
        hostLine,
      }),
    [
      agentMap,
      activeSlotId,
      activeEntry?.fromAgent,
      activeEntry?.body,
      activeEntry?.toAgent,
      activeEntryIsControl,
      characterAssets,
      characterConfig,
      hostLine,
      playbackStatus,
      targetSlotId,
    ],
  );
  const slotStageDisplayNames = useMemo(
    () =>
      Object.fromEntries(
        characters.map((character) => [character.id, character.displayName]),
      ) as Partial<Record<SlotId, string>>,
    [characters],
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

        const mergedCharacters = mergeCharacterAssets(
          (await characterResponse.json()) as CharacterAsset[],
          await fetchCustomCharacters(),
        ).map(normalizeCharacterAsset);

        if (!active) return;
        setAssetsManifest(nextAssets);
        setCharacterAssets(mergedCharacters);

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

  const toggleAmbientMotion = useCallback(() => {
    setAmbientMotion((value) => {
      const nextValue = !value;
      saveAmbientMotion(nextValue);
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

  const updateCharacterConfig = useCallback(
    (updater: (config: CharacterConfig) => CharacterConfig) => {
      setCharacterConfig((currentConfig) => {
        const nextConfig = updater(currentConfig);
        saveCharacterConfig(nextConfig);
        return nextConfig;
      });
    },
    [],
  );
  const refreshCharacterAssets = useCallback(
    async (
      cacheBust = false,
      reconcileOptions: CharacterAssetReconcileOptions = {},
    ) => {
      const nextCharacters = await fetchCharacterAssets(cacheBust);
      setCharacterAssets(
        reconcileCharacterAssets(nextCharacters, reconcileOptions),
      );
    },
    [],
  );
  const upsertCharacterAsset = useCallback(
    (character: CharacterAsset) => {
      setCharacterAssets((currentCharacters) =>
        reconcileCharacterAssets(currentCharacters, { upsert: [character] }),
      );
      void refreshCharacterAssets(true, { upsert: [character] });
    },
    [refreshCharacterAssets],
  );
  const removeCharacterAsset = useCallback(
    (characterId: string) => {
      setCharacterAssets((currentCharacters) =>
        reconcileCharacterAssets(currentCharacters, {
          removeIds: [characterId],
        }),
      );
      updateCharacterConfig((currentConfig) =>
        removeCharacterConfigReferences(currentConfig, characterId),
      );
      void refreshCharacterAssets(true, { removeIds: [characterId] });
    },
    [refreshCharacterAssets, updateCharacterConfig],
  );

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
                ambientMotion={ambientMotion}
                character={character}
                key={`${castKey}-${character.id}-${character.characterId}`}
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

          <CastingPanel
            characterAssets={characterAssets}
            characterConfig={characterConfig}
            expanded={showCastingPanel}
            isDevServer={import.meta.env.DEV}
            slotStageDisplayNames={slotStageDisplayNames}
            t={t}
            onCharacterDeleted={removeCharacterAsset}
            onCharacterUploaded={upsertCharacterAsset}
            onConfigChange={updateCharacterConfig}
            onToggle={() => setShowCastingPanel((value) => !value)}
          />

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
                <label className="toggle-row">
                  <input
                    checked={ambientMotion}
                    type="checkbox"
                    onChange={toggleAmbientMotion}
                  />
                  <span>{t("characterMotion")}</span>
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
  characterConfig,
  activeSlotId,
  activeAgentName,
  activeLine,
  hostLine,
  isActiveSpeaker,
  targetAgentName,
  targetSlotId,
}: {
  agentMap: AgentCharacterMap;
  characterAssets: CharacterAsset[];
  characterConfig: CharacterConfig;
  activeSlotId?: SlotId;
  activeAgentName?: string;
  activeLine?: string;
  hostLine?: string;
  isActiveSpeaker: boolean;
  targetAgentName?: string;
  targetSlotId?: SlotId;
}): StageCharacter[] {
  const characterById = createCharacterById(characterAssets);
  const primaryAgentBySlot = createPrimaryAgentBySlot(agentMap);
  const hostStageDisplayName =
    characterById.get(DEFAULT_CASTING.host)?.role ?? "Boss";
  const neededSlotIds = new Set<SlotId>([
    "host",
    ...Object.values(agentMap).filter((slotId): slotId is SlotId =>
      Boolean(slotId),
    ),
  ]);

  const stageCharacters: StageCharacter[] = [];

  for (const slotId of SLOT_IDS.filter((slotId) => neededSlotIds.has(slotId))) {
    const index = stageCharacters.length;
    const characterId = getResolvedCharacterId(
      slotId,
      characterConfig,
      characterAssets,
    );
    const fallbackCharacterId = DEFAULT_CASTING[slotId];
    const asset =
      characterById.get(characterId) ?? characterById.get(fallbackCharacterId);
    if (!asset) continue;

    const renamedDisplayName = characterConfig.renames[asset.id]?.trim();
    let state: CharacterState = "idle";
    let currentLine: string | undefined;
    let displayName =
      slotId === "host"
        ? hostStageDisplayName
        : (primaryAgentBySlot[slotId] ??
          getCharacterDisplayName(asset, characterConfig));

    if (hostLine && slotId === "host") {
      state = "speaking";
      currentLine = hostLine;
    } else if (slotId === activeSlotId) {
      state = "speaking";
      currentLine = activeLine;
      displayName = activeAgentName ?? displayName;
    } else if (slotId === targetSlotId) {
      state = "waiting";
      displayName = targetAgentName ?? displayName;
    }

    stageCharacters.push({
      id: slotId,
      characterId: asset.id,
      displayName: renamedDisplayName || displayName,
      portraitPath: asset.portraitPath,
      spritesheetPath: asset.spritesheetPath,
      richMotion: asset.richMotion ?? true,
      position: DEFAULT_SLOT_POSITIONS[slotId],
      state,
      currentLine,
      isActiveSpeaker:
        (hostLine && slotId === "host") ||
        (slotId === activeSlotId && isActiveSpeaker),
      entranceDelayMs: index * 70,
    });
  }

  return stageCharacters;
}

function createPrimaryAgentBySlot(
  agentMap: AgentCharacterMap,
): Partial<Record<SlotId, string>> {
  const primaryAgentBySlot: Partial<Record<SlotId, string>> = {};
  for (const [agentName, slotId] of Object.entries(agentMap)) {
    if (!slotId || primaryAgentBySlot[slotId]) continue;
    primaryAgentBySlot[slotId] = agentName;
  }
  return primaryAgentBySlot;
}

function reconcileCharacterAssets(
  characterAssets: CharacterAsset[],
  { removeIds = [], upsert = [] }: CharacterAssetReconcileOptions,
): CharacterAsset[] {
  const removedIds = new Set(removeIds);
  const characterById = new Map<CharacterRef, CharacterAsset>();

  for (const character of characterAssets) {
    if (!removedIds.has(character.id)) {
      characterById.set(character.id, character);
    }
  }

  for (const character of upsert) {
    if (!removedIds.has(character.id)) {
      characterById.set(character.id, normalizeCharacterAsset(character));
    }
  }

  return [...characterById.values()];
}

function removeCharacterConfigReferences(
  config: CharacterConfig,
  characterId: CharacterRef,
): CharacterConfig {
  const casting = { ...config.casting };
  const renames = { ...config.renames };

  for (const [slotId, configuredCharacterId] of Object.entries(casting)) {
    if (configuredCharacterId === characterId) {
      delete casting[slotId as SlotId];
    }
  }
  delete renames[characterId];

  return { casting, renames };
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
  const agents = isControlMessage(entry.body)
    ? t("metaSystem")
    : `${entry.fromAgent} -> ${entry.toAgent}`;
  if (!showDate) {
    return agents;
  }
  const time = formatClock(
    entry.createdAt,
    language === "ja" ? "ja-JP" : "en-US",
  );
  return `${time} · ${agents}`;
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

async function fetchCharacterAssets(
  cacheBust = false,
): Promise<CharacterAsset[]> {
  const assetsResponse = await fetch(`${ASSET_BASE}assets.json`);
  if (!assetsResponse.ok) {
    throw new Error(translateString("en", "errorLoadAssets"));
  }

  const assetsManifest = (await assetsResponse.json()) as AssetsManifest;
  const characterResponse = await fetch(
    `${ASSET_BASE}${assetsManifest.characters}`,
  );
  if (!characterResponse.ok) {
    throw new Error(translateString("en", "errorLoadCharacters"));
  }

  return mergeCharacterAssets(
    (await characterResponse.json()) as CharacterAsset[],
    await fetchCustomCharacters(cacheBust),
  ).map(normalizeCharacterAsset);
}

async function fetchCustomCharacters(
  cacheBust = false,
): Promise<CharacterAsset[]> {
  try {
    const query = cacheBust ? `?t=${Date.now()}` : "";
    const response = await fetch(
      `${ASSET_BASE}${CUSTOM_CHARACTERS_PATH}${query}`,
    );
    if (response.status === 404) return [];
    if (!response.ok) {
      console.warn("Failed to load custom character assets manifest.");
      return [];
    }

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) {
      console.warn(
        "Ignoring custom character assets manifest: expected array.",
      );
      return [];
    }

    return payload.filter(isCharacterAsset);
  } catch (error) {
    console.warn("Ignoring custom character assets manifest.", error);
    return [];
  }
}

function isCharacterAsset(value: unknown): value is CharacterAsset {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<CharacterAsset>;
  return (
    typeof record.id === "string" &&
    typeof record.displayName === "string" &&
    typeof record.role === "string" &&
    typeof record.description === "string" &&
    (record.portraitPath === undefined ||
      typeof record.portraitPath === "string") &&
    (record.spritesheetPath === undefined ||
      typeof record.spritesheetPath === "string") &&
    (record.richMotion === undefined || typeof record.richMotion === "boolean")
  );
}

export default App;
