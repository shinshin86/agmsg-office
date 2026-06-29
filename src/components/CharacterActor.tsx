import { useEffect, useRef, useState } from "react";
import type { CharacterState, StageCharacter } from "../types";

type PetAction =
  | "idle"
  | "running-right"
  | "running-left"
  | "waving"
  | "jumping"
  | "failed"
  | "waiting"
  | "running"
  | "review";

type AmbientRestAction = "idle" | "waving" | "waiting" | "review";

interface CharacterActorProps {
  ambientMotion: boolean;
  character: StageCharacter;
}

interface SpriteRow {
  row: number;
  frames: number;
  frameMs: number;
}

interface MotionState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  direction: 1 | -1;
  targetX: number;
  targetY: number;
  pausedUntil: number;
  walking: boolean;
  restAction: AmbientRestAction;
  restActionUntil: number;
}

const ASSET_BASE = "/assets/";
const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const ATLAS_COLUMNS = 8;
const ATLAS_ROWS = 9;
const MAX_BUBBLE_CHARS = 92;
const AMBIENT_REST_ACTIONS: readonly AmbientRestAction[] = [
  "waving",
  "review",
  "waiting",
];

const SPRITE_ROWS: Record<PetAction, SpriteRow> = {
  idle: { row: 0, frames: 6, frameMs: 320 },
  "running-right": { row: 1, frames: 8, frameMs: 190 },
  "running-left": { row: 2, frames: 8, frameMs: 190 },
  waving: { row: 3, frames: 4, frameMs: 240 },
  jumping: { row: 4, frames: 5, frameMs: 220 },
  failed: { row: 5, frames: 8, frameMs: 240 },
  waiting: { row: 6, frames: 6, frameMs: 300 },
  running: { row: 7, frames: 6, frameMs: 200 },
  review: { row: 8, frames: 6, frameMs: 260 },
};

function actionForState(
  state: CharacterState,
  isActiveSpeaker: boolean,
): PetAction {
  switch (state) {
    case "speaking":
      return isActiveSpeaker ? "running" : "idle";
    case "thinking":
      return "review";
    case "waiting":
      return "waiting";
    case "error":
      return "failed";
    default:
      return "idle";
  }
}

function useSpriteFrame(action: PetAction) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const row = SPRITE_ROWS[action];
    const intervalId = window.setInterval(() => {
      setFrame((current) => (current + 1) % row.frames);
    }, row.frameMs);

    return () => window.clearInterval(intervalId);
  }, [action]);

  return frame;
}

function getMotionStagger(character: StageCharacter) {
  const idOffset = [...character.characterId].reduce(
    (total, value) => total + value.charCodeAt(0),
    0,
  );
  return (idOffset % 900) + character.entranceDelayMs * 0.45;
}

function getRandomAmbientRestAction(): AmbientRestAction {
  if (Math.random() > 0.38) return "idle";
  return AMBIENT_REST_ACTIONS[
    Math.floor(Math.random() * AMBIENT_REST_ACTIONS.length)
  ];
}

function useActorMotion(
  character: StageCharacter,
  action: PetAction,
  ambientMotionEnabled: boolean,
) {
  const { x: homeX, y: homeY } = character.position;
  const initialStagger = getMotionStagger(character);
  const [motion, setMotion] = useState<MotionState>({
    x: homeX,
    y: homeY,
    vx: 0.08,
    vy: 0,
    direction: 1,
    targetX: homeX,
    targetY: homeY,
    pausedUntil: 0,
    walking: false,
    restAction: "idle",
    restActionUntil: 0,
  });
  const actionRef = useRef(action);
  const ambientMotionRef = useRef(ambientMotionEnabled);
  const homeRef = useRef(character.position);
  const staggerRef = useRef(initialStagger);

  useEffect(() => {
    actionRef.current = action;
  }, [action]);

  useEffect(() => {
    ambientMotionRef.current = ambientMotionEnabled;
  }, [ambientMotionEnabled]);

  useEffect(() => {
    homeRef.current = { x: homeX, y: homeY };
  }, [homeX, homeY]);

  useEffect(() => {
    let frameId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const elapsed = Math.min((now - lastTime) / 16.67, 2);
      lastTime = now;

      setMotion((current) => {
        const currentAction = actionRef.current;
        const ambientMoving =
          ambientMotionRef.current && currentAction === "idle";
        const home = homeRef.current;
        const moving =
          ambientMoving ||
          currentAction === "running" ||
          currentAction === "running-left" ||
          currentAction === "running-right";
        const speed = moving ? 0.008 : 0;
        let direction = current.direction;
        let vx = current.vx;
        let vy = current.vy;
        let x = current.x;
        let y = current.y;
        let targetX = current.targetX;
        let targetY = current.targetY;
        let pausedUntil = current.pausedUntil;
        let walking = current.walking;
        let restAction = current.restAction;
        let restActionUntil = current.restActionUntil;
        const minX = Math.max(5, home.x - 12);
        const maxX = Math.min(94, home.x + 12);
        const minY = Math.max(18, home.y - 1.2);
        const maxY = Math.min(72, home.y + 1.2);

        if (moving) {
          const distanceX = targetX - x;
          const distanceY = targetY - y;
          const distance = Math.hypot(distanceX, distanceY);

          if (distance < 0.32) {
            walking = false;
            if (pausedUntil === 0) {
              pausedUntil =
                now +
                3200 +
                Math.random() * 2600 +
                (ambientMoving ? staggerRef.current : 0);
              if (ambientMoving) {
                restAction = getRandomAmbientRestAction();
                restActionUntil =
                  restAction === "idle" ? 0 : now + 1100 + Math.random() * 1400;
              }
            }
            if (restActionUntil > 0 && now > restActionUntil) {
              restAction = "idle";
              restActionUntil = 0;
            }
            if (now > pausedUntil) {
              const nextX = ambientMoving
                ? minX + Math.random() * (maxX - minX)
                : home.x + (Math.random() * 2 - 1) * 5.5;
              targetX = Math.min(Math.max(nextX, minX), maxX);
              targetY = home.y;
              direction = targetX >= x ? 1 : -1;
              pausedUntil = 0;
              walking = true;
              restAction = "idle";
              restActionUntil = 0;
            }
          } else {
            walking = true;
            restAction = "idle";
            restActionUntil = 0;
            direction = distanceX >= 0 ? 1 : -1;
            vx = (distanceX / distance) * speed;
            vy = (distanceY / distance) * speed;
            x += vx * elapsed;
            y += vy * elapsed;
          }
        } else {
          walking = false;
          pausedUntil = 0;
          targetX = home.x;
          targetY = home.y;
          vx = (home.x - x) * 0.03;
          vy = (home.y - y) * 0.03;
          restAction = "idle";
          restActionUntil = 0;
          x += vx * elapsed;
          y += vy * elapsed;
        }

        if (x < minX || x > maxX) {
          direction = direction === 1 ? -1 : 1;
          x = Math.min(Math.max(x, minX), maxX);
        }
        y = Math.min(Math.max(y, minY), maxY);

        return {
          x,
          y,
          vx,
          vy,
          direction,
          targetX,
          targetY,
          pausedUntil,
          walking,
          restAction,
          restActionUntil,
        };
      });

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return motion;
}

function getMovementAction(
  action: PetAction,
  direction: 1 | -1,
  walking: boolean,
): PetAction {
  if (action === "running" && walking) {
    return direction >= 0 ? "running-right" : "running-left";
  }
  return action;
}

function getSpriteBackgroundPosition(row: number, frame: number) {
  const x = (frame / (ATLAS_COLUMNS - 1)) * 100;
  const y = (row / (ATLAS_ROWS - 1)) * 100;
  return `${x}% ${y}%`;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}

export function CharacterActor({
  ambientMotion,
  character,
}: CharacterActorProps) {
  const baseAction = actionForState(character.state, character.isActiveSpeaker);
  const ambientMotionEnabled =
    ambientMotion && character.state === "idle" && character.richMotion;
  const motion = useActorMotion(character, baseAction, ambientMotionEnabled);
  const displayAction = ambientMotionEnabled
    ? motion.walking
      ? "running"
      : motion.restAction
    : baseAction;
  const action = getMovementAction(
    displayAction,
    motion.direction,
    motion.walking,
  );
  const rawFrame = useSpriteFrame(action);
  const row = SPRITE_ROWS[action];
  const frame = rawFrame % row.frames;
  const line = character.currentLine
    ? truncateText(character.currentLine, MAX_BUBBLE_CHARS)
    : "";
  const bubbleBelow = character.position.y < 50;

  return (
    <div
      className={`character slot-${character.id} character-${toCssClassToken(character.characterId)} character-${character.state}${
        bubbleBelow ? " character-bubble-below" : ""
      }`}
      style={{
        left: `${motion.x}%`,
        top: `${motion.y}%`,
      }}
    >
      <div
        className="character-enter"
        style={{ animationDelay: `${character.entranceDelayMs}ms` }}
      >
        {line && (
          <div className="speech-bubble">
            <strong>{character.displayName}</strong>
            <span>{line}</span>
          </div>
        )}
        <div
          aria-label={character.displayName}
          className="character-sprite"
          role="img"
          style={
            character.spritesheetPath
              ? {
                  backgroundImage: `url(${ASSET_BASE}characters/${character.spritesheetPath})`,
                  backgroundPosition: getSpriteBackgroundPosition(
                    row.row,
                    frame,
                  ),
                  backgroundSize: `${ATLAS_COLUMNS * 100}% ${ATLAS_ROWS * 100}%`,
                  aspectRatio: `${CELL_WIDTH} / ${CELL_HEIGHT}`,
                }
              : undefined
          }
        >
          {!character.spritesheetPath && character.portraitPath && (
            <img
              alt={character.displayName}
              className="character-portrait"
              src={`${ASSET_BASE}characters/${character.portraitPath}`}
            />
          )}
        </div>
        <span className="character-name">{character.displayName}</span>
      </div>
    </div>
  );
}

function toCssClassToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}
