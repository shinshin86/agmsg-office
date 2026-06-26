export type Language = "en" | "ja";

type Params = Record<string, number | string>;

export const LANGUAGE_STORAGE_KEY = "agmsg-office:lang";

export const STRINGS = {
  en: {
    advanced: "Advanced",
    agentsPrefix: "Agents:",
    captionCurrentLine: "Current line",
    captionPlaceholder: "Replay text will appear here.",
    controlDespawn: "Looks like an agent just stepped out.",
    controlGeneric: "A system event came through: {command}.",
    errorImportInvalidJson:
      "Import failed. The selected file is not valid JSON.",
    errorImportInvalidRecord:
      "Import failed. Record {index} must include id, team, from_agent, to_agent, body, created_at, and optional read_at.",
    errorImportNotArray: "Import failed. The JSON file must contain an array.",
    errorImportRead:
      "Import failed. Choose a JSON file containing agmsg message records.",
    errorLoadAgmsgHistory: "Failed to load agmsg history for {team}.",
    errorLoadAssets: "Failed to load assets.json",
    errorLoadCharacters: "Failed to load character assets",
    errorLoadSample: "Failed to load sample agmsg log",
    errorLocalApi: "Local agmsg API is not available.",
    errorLocalUnavailable: "Local agmsg data is unavailable.",
    errorNoTeams: "No agmsg teams were found. Using sample log.",
    errorUsingSample: "Using sample log: {reason}",
    hide: "Hide",
    importedFileFallback: "imported file",
    importJson: "Import JSON",
    language: "Language",
    logListLabel: "agmsg entries",
    teamFallback: "this team",
    logHeadingImport: "imported file",
    logHeadingSample: "agmsg sample",
    metaSystem: "System",
    narrationIntro: "Welcome to {team}! Replaying {count} messages.",
    narrationOutro: "That is the end of the log. Thanks for watching!",
    playback: "Playback",
    reloadCurrentTeam: "Reload current team",
    show: "Show",
    source: "Source",
    sourceImportedStatus: "Imported file: {name} ({count} entries)",
    sourceLiveStatus: "Live agmsg: {team} ({count} entries)",
    sourceLoading: "Loading log...",
    sourceSampleOption: "Sample",
    sourceSampleStatus: "Sample log ({count} entries)",
    speed: "Speed",
    start: "Start",
    stop: "Stop",
    pause: "Pause",
    systemNotePrefix: "System note:",
    stageLabel: "Agent stage",
    topbarSubtitle: "Replay agent messages as a character stage.",
    unknown: "unknown",
  },
  ja: {
    advanced: "詳細",
    agentsPrefix: "エージェント:",
    captionCurrentLine: "現在の行",
    captionPlaceholder: "再生テキストがここに表示されます。",
    controlDespawn: "エージェントが退出したようです。",
    controlGeneric: "システムイベントを受信しました: {command}。",
    errorImportInvalidJson:
      "インポートに失敗しました。選択したファイルは有効な JSON ではありません。",
    errorImportInvalidRecord:
      "インポートに失敗しました。{index} 件目には id、team、from_agent、to_agent、body、created_at、および任意の read_at が必要です。",
    errorImportNotArray:
      "インポートに失敗しました。JSON ファイルは配列である必要があります。",
    errorImportRead:
      "インポートに失敗しました。agmsg メッセージレコードを含む JSON ファイルを選択してください。",
    errorLoadAgmsgHistory: "{team} の agmsg 履歴を読み込めませんでした。",
    errorLoadAssets: "assets.json を読み込めませんでした",
    errorLoadCharacters: "キャラクターアセットを読み込めませんでした",
    errorLoadSample: "サンプル agmsg ログを読み込めませんでした",
    errorLocalApi: "ローカル agmsg API を利用できません。",
    errorLocalUnavailable: "ローカル agmsg データを利用できません。",
    errorNoTeams: "agmsg チームが見つかりません。サンプルログを使用します。",
    errorUsingSample: "サンプルログを使用中: {reason}",
    hide: "非表示",
    importedFileFallback: "インポートしたファイル",
    importJson: "JSON をインポート",
    language: "言語",
    logListLabel: "agmsg エントリ",
    teamFallback: "このチーム",
    logHeadingImport: "インポートしたファイル",
    logHeadingSample: "agmsg サンプル",
    metaSystem: "システム",
    narrationIntro: "{team} へようこそ。{count} 件のメッセージを再生します。",
    narrationOutro: "ログの最後です。ご覧いただきありがとうございました。",
    playback: "再生",
    reloadCurrentTeam: "現在のチームを再読み込み",
    show: "表示",
    source: "ソース",
    sourceImportedStatus: "インポート: {name} ({count} 件)",
    sourceLiveStatus: "Live agmsg: {team} ({count} 件)",
    sourceLoading: "ログを読み込み中...",
    sourceSampleOption: "サンプル",
    sourceSampleStatus: "サンプルログ ({count} 件)",
    speed: "速度",
    start: "開始",
    stop: "停止",
    pause: "一時停止",
    systemNotePrefix: "システムメモ:",
    stageLabel: "エージェントステージ",
    topbarSubtitle:
      "エージェントのメッセージをキャラクターステージとして再生します。",
    unknown: "不明",
  },
} as const;

export type I18nKey = keyof typeof STRINGS.en;

export function detectLanguage(): Language {
  const storedLanguage = readStoredLanguage();
  if (storedLanguage) return storedLanguage;

  if (
    typeof navigator !== "undefined" &&
    navigator.language.toLowerCase().startsWith("ja")
  ) {
    return "ja";
  }
  return "en";
}

export function saveLanguage(language: Language) {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Ignore storage failures; the in-memory choice still applies.
  }
}

export function t(
  language: Language,
  key: I18nKey,
  params: Params = {},
): string {
  let value: string = STRINGS[language][key];
  for (const [name, replacement] of Object.entries(params)) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
}

function readStoredLanguage(): Language | undefined {
  try {
    const value = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return value === "en" || value === "ja" ? value : undefined;
  } catch {
    return undefined;
  }
}
