import { useMemo, useState } from "react";
import {
  CHARACTER_CONFIG_STORAGE_KEY,
  DEFAULT_CASTING,
  SLOT_IDS,
  createCharacterById,
  getCharacterDisplayName,
  getResolvedCharacterId,
  isCastingFallback,
  isCastingOverride,
} from "../lib/characters";
import type { I18nKey } from "../lib/i18n";
import type {
  CharacterAsset,
  CharacterConfig,
  CharacterRef,
  SlotId,
} from "../types";
import { CharacterUploadModal } from "./CharacterUploadModal";

type Translate = (
  key: I18nKey,
  params?: Record<string, number | string>,
) => string;

interface CastingPanelProps {
  characterAssets: CharacterAsset[];
  characterConfig: CharacterConfig;
  expanded: boolean;
  isDevServer: boolean;
  slotStageDisplayNames: Partial<Record<SlotId, string>>;
  t: Translate;
  onCharacterDeleted: (characterId: CharacterRef) => void;
  onCharacterUploaded: (character: CharacterAsset) => void;
  onConfigChange: (
    updater: (config: CharacterConfig) => CharacterConfig,
  ) => void;
  onStageRefresh: () => void;
  onToggle: () => void;
}

export function CastingPanel({
  characterAssets,
  characterConfig,
  expanded,
  isDevServer,
  slotStageDisplayNames,
  t,
  onCharacterDeleted,
  onCharacterUploaded,
  onConfigChange,
  onStageRefresh,
  onToggle,
}: CastingPanelProps) {
  const [editingSlotId, setEditingSlotId] = useState<SlotId | undefined>();
  const characterById = useMemo(
    () => createCharacterById(characterAssets),
    [characterAssets],
  );
  const customCharacters = characterAssets.filter(isCustomCharacter);

  return (
    <section className="controls-section casting-section">
      <button
        aria-expanded={expanded}
        className="advanced-toggle"
        type="button"
        onClick={onToggle}
      >
        <span>{t("casting")}</span>
        <span>{expanded ? t("hide") : t("show")}</span>
      </button>

      {expanded && (
        <div className="casting-content">
          {!isDevServer && (
            <p className="notice-text">{t("castingDevOnlyNotice")}</p>
          )}

          <div className="casting-actions">
            <button type="button" onClick={() => onConfigChange(resetAll)}>
              {t("castingResetAll")}
            </button>
          </div>

          <div className="casting-list">
            {SLOT_IDS.map((slotId) => {
              const resolvedCharacterId = getResolvedCharacterId(
                slotId,
                characterConfig,
                characterAssets,
              );
              const selectedCharacter =
                characterById.get(resolvedCharacterId) ??
                characterById.get(DEFAULT_CASTING[slotId]);
              const fallback = isCastingFallback(
                slotId,
                characterConfig,
                characterAssets,
              );
              const override = isCastingOverride(slotId, resolvedCharacterId);
              const renameValue =
                selectedCharacter &&
                characterConfig.renames[selectedCharacter.id]
                  ? characterConfig.renames[selectedCharacter.id]
                  : "";
              const avatarName = selectedCharacter
                ? getCharacterDisplayName(selectedCharacter, characterConfig)
                : t("unknown");
              const stageDisplayName =
                slotStageDisplayNames[slotId] ?? t("unknown");

              return (
                <div className="casting-row" key={slotId}>
                  <div className="casting-row-main">
                    <CharacterThumb character={selectedCharacter} />
                    <div className="casting-row-title">
                      <div className="casting-row-header">
                        <strong>{slotId}</strong>
                        {override && (
                          <span className="status-badge">
                            {t("castingOverride")}
                          </span>
                        )}
                        {fallback && (
                          <span className="status-badge is-warning">
                            {t("castingFallback")}
                          </span>
                        )}
                      </div>
                      <span className="casting-row-line">
                        <span>{t("castingAvatar")}</span>
                        <strong>{avatarName}</strong>
                      </span>
                      <span className="casting-row-line">
                        <span>{t("castingStageDisplay")}</span>
                        <strong>{stageDisplayName}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="casting-row-controls">
                    <button
                      disabled={!isDevServer}
                      type="button"
                      onClick={() => setEditingSlotId(slotId)}
                    >
                      {t("castingReplaceCharacter")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onConfigChange((currentConfig) =>
                          resetSlot(
                            currentConfig,
                            slotId,
                            selectedCharacter?.id,
                          ),
                        )
                      }
                    >
                      {t("castingResetRow")}
                    </button>
                  </div>

                  <label>
                    {t("castingRename")}
                    <input
                      disabled={!selectedCharacter}
                      placeholder={stageDisplayName}
                      value={renameValue}
                      onChange={(event) => {
                        if (!selectedCharacter) return;
                        onConfigChange((currentConfig) =>
                          updateRename(
                            currentConfig,
                            selectedCharacter.id,
                            event.target.value,
                          ),
                        );
                      }}
                    />
                    <span className="casting-field-hint">
                      {t("castingRenameHint")}
                    </span>
                  </label>
                </div>
              );
            })}
          </div>

          <details className="casting-details">
            <summary>{t("castingConfigJson")}</summary>
            <p>
              {t("castingStorageNotice", { key: CHARACTER_CONFIG_STORAGE_KEY })}
            </p>
            <pre>{JSON.stringify(characterConfig, null, 2)}</pre>
          </details>
        </div>
      )}

      {editingSlotId && (
        <CharacterUploadModal
          characterConfig={characterConfig}
          customCharacters={customCharacters}
          slotId={editingSlotId}
          t={t}
          onChooseCharacter={(characterId) => {
            onConfigChange((currentConfig) =>
              updateCasting(currentConfig, editingSlotId, characterId),
            );
            onStageRefresh();
            setEditingSlotId(undefined);
          }}
          onClose={() => setEditingSlotId(undefined)}
          onDeleteCharacter={async (characterId) => {
            onCharacterDeleted(characterId);
          }}
          onUploadCharacter={async (character) => {
            onCharacterUploaded(character);
            onConfigChange((currentConfig) =>
              updateCasting(currentConfig, editingSlotId, character.id),
            );
            onStageRefresh();
            setEditingSlotId(undefined);
          }}
        />
      )}
    </section>
  );
}

export function CharacterThumb({
  character,
}: {
  character: CharacterAsset | undefined;
}) {
  if (!character) {
    return <span className="character-thumb" aria-hidden="true" />;
  }

  if (character.portraitPath) {
    return (
      <img
        alt=""
        className="character-thumb"
        src={`/assets/characters/${character.portraitPath}`}
      />
    );
  }

  if (character.spritesheetPath) {
    return (
      <span
        aria-hidden="true"
        className="character-thumb character-thumb-sprite"
        style={{
          backgroundImage: `url(/assets/characters/${character.spritesheetPath})`,
        }}
      />
    );
  }

  return <span className="character-thumb" aria-hidden="true" />;
}

function updateCasting(
  config: CharacterConfig,
  slotId: SlotId,
  characterId: CharacterRef,
): CharacterConfig {
  const casting = { ...config.casting };
  if (characterId === DEFAULT_CASTING[slotId]) {
    delete casting[slotId];
  } else {
    casting[slotId] = characterId;
  }
  return { ...config, casting };
}

function updateRename(
  config: CharacterConfig,
  characterId: CharacterRef,
  displayName: string,
): CharacterConfig {
  const renames = { ...config.renames };
  if (displayName.trim()) {
    renames[characterId] = displayName;
  } else {
    delete renames[characterId];
  }
  return { ...config, renames };
}

function resetSlot(
  config: CharacterConfig,
  slotId: SlotId,
  characterId: CharacterRef | undefined,
): CharacterConfig {
  const casting = { ...config.casting };
  const renames = { ...config.renames };
  delete casting[slotId];
  if (characterId) {
    delete renames[characterId];
  }
  return { casting, renames };
}

function resetAll(): CharacterConfig {
  return {
    casting: {},
    renames: {},
  };
}

function isCustomCharacter(character: CharacterAsset): boolean {
  return !Object.values(DEFAULT_CASTING).includes(character.id);
}
