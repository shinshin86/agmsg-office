import type { CharacterAsset } from "../types";

export const SPRITESHEET_WIDTH = 1536;
export const SPRITESHEET_HEIGHT = 1872;
export const SPRITESHEET_COLUMNS = 8;
export const SPRITESHEET_ROWS = 9;

const MAX_SPRITESHEET_BYTES = 3 * 1024 * 1024;
const MAX_PORTRAIT_BYTES = 2 * 1024 * 1024;

export interface CharacterUploadInput {
  displayName: string;
  role?: string;
  spritesheet: File;
  portrait?: File;
}

interface EncodedUploadFile {
  name: string;
  mimeType: string;
  dataBase64: string;
}

export async function validateSpritesheetFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".webp")) {
    throw new Error("Spritesheet must be a .webp file.");
  }
  if (file.type !== "image/webp") {
    throw new Error("Spritesheet MIME type must be image/webp.");
  }
  if (file.size > MAX_SPRITESHEET_BYTES) {
    throw new Error("Spritesheet must be 3 MB or smaller.");
  }

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!isWebpHeader(header)) {
    throw new Error("The selected spritesheet is not a valid WEBP file.");
  }

  const bitmap = await createImageBitmap(file);
  try {
    if (
      bitmap.width !== SPRITESHEET_WIDTH ||
      bitmap.height !== SPRITESHEET_HEIGHT
    ) {
      throw new Error(
        `Spritesheet must be ${SPRITESHEET_WIDTH}x${SPRITESHEET_HEIGHT} (${SPRITESHEET_COLUMNS}x${SPRITESHEET_ROWS}).`,
      );
    }
  } finally {
    bitmap.close();
  }
}

export async function validatePortraitFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".png")) {
    throw new Error("Portrait must be a .png file.");
  }
  if (file.type !== "image/png") {
    throw new Error("Portrait MIME type must be image/png.");
  }
  if (file.size > MAX_PORTRAIT_BYTES) {
    throw new Error("Portrait must be 2 MB or smaller.");
  }

  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (!isPngHeader(header)) {
    throw new Error("The selected portrait is not a valid PNG file.");
  }
}

export async function uploadCharacter({
  displayName,
  role,
  spritesheet,
  portrait,
}: CharacterUploadInput): Promise<CharacterAsset> {
  const response = await fetch("/api/characters", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      displayName,
      role,
      spritesheet: await encodeUploadFile(spritesheet),
      portrait: portrait ? await encodeUploadFile(portrait) : undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as CharacterAsset;
}

export async function deleteCustomCharacter(id: string) {
  const response = await fetch(`/api/characters/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
}

export function getInitialDisplayName(file: File | undefined): string {
  if (!file) return "";
  return file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function encodeUploadFile(file: File): Promise<EncodedUploadFile> {
  return {
    name: file.name,
    mimeType: file.type,
    dataBase64: await fileToBase64(file),
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

async function readApiError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || response.statusText;
  } catch {
    return response.statusText;
  }
}

function isWebpHeader(header: Uint8Array): boolean {
  return (
    header.length >= 12 &&
    ascii(header, 0, 4) === "RIFF" &&
    ascii(header, 8, 12) === "WEBP"
  );
}

function isPngHeader(header: Uint8Array): boolean {
  return (
    header.length >= 8 &&
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47 &&
    header[4] === 0x0d &&
    header[5] === 0x0a &&
    header[6] === 0x1a &&
    header[7] === 0x0a
  );
}

function ascii(buffer: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...buffer.slice(start, end));
}
