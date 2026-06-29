import { useEffect, useMemo, useState } from "react";
import {
  deleteCustomCharacter,
  getInitialDisplayName,
  uploadCharacter,
  validatePortraitFile,
  validateSpritesheetFile,
} from "../lib/characterUpload";
import { getCharacterDisplayName } from "../lib/characters";
import type { I18nKey } from "../lib/i18n";
import type {
  CharacterAsset,
  CharacterConfig,
  CharacterRef,
  SlotId,
} from "../types";

type Translate = (
  key: I18nKey,
  params?: Record<string, number | string>,
) => string;

interface CharacterUploadModalProps {
  characterConfig: CharacterConfig;
  customCharacters: CharacterAsset[];
  slotId: SlotId;
  t: Translate;
  onChooseCharacter: (characterId: CharacterRef) => void;
  onClose: () => void;
  onDeleteCharacter: (characterId: CharacterRef) => Promise<void>;
  onUploadCharacter: (character: CharacterAsset) => Promise<void>;
}

type ModalMode = "library" | "upload";

const ASSET_READY_POLL_MS = 60;
const ASSET_READY_TIMEOUT_MS = 3000;

export function CharacterUploadModal({
  characterConfig,
  customCharacters,
  slotId,
  t,
  onChooseCharacter,
  onClose,
  onDeleteCharacter,
  onUploadCharacter,
}: CharacterUploadModalProps) {
  const [mode, setMode] = useState<ModalMode>("library");
  const [spritesheetFile, setSpritesheetFile] = useState<File | undefined>();
  const [portraitFile, setPortraitFile] = useState<File | undefined>();
  const [displayName, setDisplayName] = useState("");
  const [spritesheetUrl, setSpritesheetUrl] = useState("");
  const [portraitUrl, setPortraitUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const hasCustomCharacters = customCharacters.length > 0;
  const canSave = Boolean(spritesheetFile && displayName.trim() && !busy);

  useEffect(() => {
    if (!spritesheetFile) {
      setSpritesheetUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(spritesheetFile);
    setSpritesheetUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [spritesheetFile]);

  useEffect(() => {
    if (!portraitFile) {
      setPortraitUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(portraitFile);
    setPortraitUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [portraitFile]);

  const sortedCustomCharacters = useMemo(
    () =>
      [...customCharacters].sort((left, right) =>
        left.displayName.localeCompare(right.displayName),
      ),
    [customCharacters],
  );

  return (
    <div className="modal-backdrop" role="presentation">
      <dialog
        aria-labelledby="character-upload-title"
        className="character-modal"
        open
      >
        <div className="modal-header">
          <div>
            <h2 id="character-upload-title">{t("castingReplaceCharacter")}</h2>
            <p>{t("castingTargetSlot", { slot: slotId })}</p>
          </div>
          <button type="button" onClick={onClose}>
            {t("close")}
          </button>
        </div>

        <div className="segmented-control">
          <button
            className={mode === "library" ? "is-active" : ""}
            type="button"
            onClick={() => setMode("library")}
          >
            {t("myCharacters")}
          </button>
          <button
            className={mode === "upload" ? "is-active" : ""}
            type="button"
            onClick={() => setMode("upload")}
          >
            {t("uploadNewCharacter")}
          </button>
        </div>

        {mode === "library" ? (
          <div className="my-character-list">
            {!hasCustomCharacters && (
              <p className="meta-text">{t("myCharactersEmpty")}</p>
            )}
            {sortedCustomCharacters.map((character) => (
              <div className="my-character-row" key={character.id}>
                <CharacterThumb character={character} />
                <div>
                  <strong>
                    {getCharacterDisplayName(character, characterConfig)}
                  </strong>
                  <span>{character.role}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onChooseCharacter(character.id)}
                >
                  {t("choose")}
                </button>
                <button
                  disabled={busy}
                  type="button"
                  onClick={() => void handleDelete(character)}
                >
                  {t("delete")}
                </button>
              </div>
            ))}
            {error && <p className="error-text">{error}</p>}
          </div>
        ) : (
          <form
            className="upload-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSave();
            }}
          >
            <label
              className="drop-zone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files[0];
                if (file) void setSpritesheet(file);
              }}
            >
              <span>{t("spritesheetUpload")}</span>
              <input
                accept="image/webp,.webp"
                type="file"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (file) void setSpritesheet(file);
                }}
              />
            </label>

            {spritesheetUrl && (
              <div
                aria-label={t("spritesheetPreview")}
                className="sprite-preview"
                role="img"
                style={{ backgroundImage: `url(${spritesheetUrl})` }}
              />
            )}

            <label>
              {t("portraitUpload")}
              <input
                accept="image/png,.png"
                type="file"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (file) void setPortrait(file);
                }}
              />
            </label>

            {portraitUrl && (
              <img
                alt={t("portraitPreview")}
                className="portrait-preview"
                src={portraitUrl}
              />
            )}

            <label>
              {t("characterName")}
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>

            <p className="meta-text">{t("spritesheetSkillHint")}</p>
            {error && <p className="error-text">{error}</p>}

            <div className="modal-actions">
              <button type="button" onClick={onClose}>
                {t("cancel")}
              </button>
              <button disabled={!canSave} type="submit">
                {busy ? t("saving") : t("save")}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );

  async function setSpritesheet(file: File) {
    setError("");
    try {
      await validateSpritesheetFile(file);
      setSpritesheetFile(file);
      if (!displayName.trim()) {
        setDisplayName(getInitialDisplayName(file));
      }
    } catch (validationError) {
      setSpritesheetFile(undefined);
      setError(formatValidationError(validationError));
    }
  }

  async function setPortrait(file: File) {
    setError("");
    try {
      await validatePortraitFile(file);
      setPortraitFile(file);
    } catch (validationError) {
      setPortraitFile(undefined);
      setError(formatValidationError(validationError));
    }
  }

  async function handleSave() {
    if (!spritesheetFile) return;
    setBusy(true);
    setError("");
    try {
      await validateSpritesheetFile(spritesheetFile);
      if (portraitFile) await validatePortraitFile(portraitFile);
      const character = await uploadCharacter({
        displayName: displayName.trim(),
        spritesheet: spritesheetFile,
        portrait: portraitFile,
      });
      await Promise.all([
        waitForServableAsset(character.spritesheetPath),
        waitForServableAsset(character.portraitPath),
      ]);
      await onUploadCharacter(character);
    } catch (saveError) {
      setError(formatValidationError(saveError));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(character: CharacterAsset) {
    setBusy(true);
    setError("");
    try {
      await deleteCustomCharacter(character.id);
      await onDeleteCharacter(character.id);
    } catch (deleteError) {
      setError(formatValidationError(deleteError));
    } finally {
      setBusy(false);
    }
  }
}

async function waitForServableAsset(path: string | undefined): Promise<void> {
  if (!path) return;

  const url = `/assets/characters/${path}`;
  const deadline = Date.now() + ASSET_READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: "HEAD", cache: "no-store" });
      const contentType = response.headers.get("content-type") ?? "";
      if (response.ok && contentType.startsWith("image/")) {
        return;
      }
    } catch {
      // The dev server may briefly miss newly written public files.
    }

    await sleep(ASSET_READY_POLL_MS);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function formatValidationError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function CharacterThumb({ character }: { character: CharacterAsset }) {
  if (character.portraitPath) {
    return (
      <img
        alt=""
        className="character-thumb"
        src={`/assets/characters/${character.portraitPath}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="character-thumb character-thumb-sprite"
      style={{
        backgroundImage: character.spritesheetPath
          ? `url(/assets/characters/${character.spritesheetPath})`
          : undefined,
      }}
    />
  );
}
