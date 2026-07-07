export type AmbientRestAction =
  | "idle"
  | "waving"
  | "waiting"
  | "review"
  | "jumping";

/**
 * How a character picks its next destination inside its roam range.
 * - "wander": random spots around the desk (the default stroll).
 * - "patrol": paces edge to edge, back and forth.
 * - "hop": busy little steps close to where it stands.
 */
export type MovePattern = "wander" | "patrol" | "hop";

export interface MotionPersonality {
  /** Multiplier on the base walk speed. 1 = the previous shared pace. */
  speedFactor: number;
  /** How far (in stage % units) the character roams from home. */
  wanderRangeX: number;
  /** Vertical drift allowed around home (stage % units). */
  wanderRangeY: number;
  /** Pause between strolls, in milliseconds. */
  pauseMsMin: number;
  pauseMsMax: number;
  /** How the next destination is chosen. */
  movePattern: MovePattern;
  /** Relative weights for the rest action picked when a stroll ends. */
  restActionWeights: Record<AmbientRestAction, number>;
  /** How long a non-idle rest action plays, in milliseconds. */
  restMsMin: number;
  restMsMax: number;
  /** Chance to chain into another gesture while still resting at the desk. */
  restChainChance: number;
}

const BUILTIN_PERSONALITIES: Record<string, MotionPersonality> = {
  // Boss: patrols her corner briskly, waving at everyone she passes.
  miko: {
    speedFactor: 1.2,
    wanderRangeX: 10,
    wanderRangeY: 2.5,
    pauseMsMin: 2000,
    pauseMsMax: 3600,
    movePattern: "patrol",
    restActionWeights: {
      idle: 2,
      waving: 5,
      review: 1,
      waiting: 0.5,
      jumping: 1,
    },
    restMsMin: 1600,
    restMsMax: 3000,
    restChainChance: 0.5,
  },
  // Gentle: mostly stands quietly by her desk, the occasional slow drift.
  mai: {
    speedFactor: 0.7,
    wanderRangeX: 5,
    wanderRangeY: 1.5,
    pauseMsMin: 6000,
    pauseMsMax: 10000,
    movePattern: "wander",
    restActionWeights: {
      idle: 6,
      waving: 1.5,
      review: 0.5,
      waiting: 2,
      jumping: 0,
    },
    restMsMin: 1600,
    restMsMax: 2800,
    restChainChance: 0.25,
  },
  // Lively: constant busy little hops, jumps all the time.
  haya: {
    speedFactor: 1.7,
    wanderRangeX: 8,
    wanderRangeY: 2.5,
    pauseMsMin: 700,
    pauseMsMax: 1600,
    movePattern: "hop",
    restActionWeights: {
      idle: 2,
      waving: 1.5,
      review: 0.5,
      waiting: 0.5,
      jumping: 5,
    },
    restMsMin: 900,
    restMsMax: 1600,
    restChainChance: 0.7,
  },
  // Calm: practically a statue, sunk deep into long reviews.
  suzu: {
    speedFactor: 0.55,
    wanderRangeX: 2.5,
    wanderRangeY: 0.8,
    pauseMsMin: 9000,
    pauseMsMax: 16000,
    movePattern: "wander",
    restActionWeights: {
      idle: 2,
      waving: 0.3,
      review: 6,
      waiting: 1.5,
      jumping: 0,
    },
    restMsMin: 3000,
    restMsMax: 6000,
    restChainChance: 0.5,
  },
  // Friendly: strolls around and waves at coworkers constantly.
  kii: {
    speedFactor: 1,
    wanderRangeX: 8,
    wanderRangeY: 2,
    pauseMsMin: 2400,
    pauseMsMax: 4800,
    movePattern: "wander",
    restActionWeights: {
      idle: 2.5,
      waving: 6,
      review: 0.5,
      waiting: 1,
      jumping: 0.5,
    },
    restMsMin: 1600,
    restMsMax: 3000,
    restChainChance: 0.6,
  },
  // Bright: quick fidgety steps with upbeat hops and waves.
  rin: {
    speedFactor: 1.4,
    wanderRangeX: 7,
    wanderRangeY: 2,
    pauseMsMin: 1200,
    pauseMsMax: 2600,
    movePattern: "hop",
    restActionWeights: {
      idle: 2,
      waving: 3.5,
      review: 0.5,
      waiting: 0.5,
      jumping: 3.5,
    },
    restMsMin: 1000,
    restMsMax: 2000,
    restChainChance: 0.6,
  },
  // Composed: barely walks, settles into long deliberate reviews.
  nao: {
    speedFactor: 0.8,
    wanderRangeX: 5,
    wanderRangeY: 1.5,
    pauseMsMin: 4800,
    pauseMsMax: 8400,
    movePattern: "wander",
    restActionWeights: {
      idle: 2,
      waving: 0.5,
      review: 6,
      waiting: 1.5,
      jumping: 0,
    },
    restMsMin: 2400,
    restMsMax: 4200,
    restChainChance: 0.5,
  },
  // Warm: relaxed drifts, often just waits with a patient smile.
  mio: {
    speedFactor: 0.75,
    wanderRangeX: 6,
    wanderRangeY: 1.8,
    pauseMsMin: 3600,
    pauseMsMax: 7000,
    movePattern: "wander",
    restActionWeights: {
      idle: 3,
      waving: 2,
      review: 0.5,
      waiting: 4.5,
      jumping: 0,
    },
    restMsMin: 2000,
    restMsMax: 3600,
    restChainChance: 0.45,
  },
  // Steady: methodically paces her area end to end, checking as she goes.
  sora: {
    speedFactor: 0.9,
    wanderRangeX: 7.5,
    wanderRangeY: 1.2,
    pauseMsMin: 3000,
    pauseMsMax: 5000,
    movePattern: "patrol",
    restActionWeights: {
      idle: 2,
      waving: 0.5,
      review: 4,
      waiting: 2.5,
      jumping: 0,
    },
    restMsMin: 1800,
    restMsMax: 3200,
    restChainChance: 0.4,
  },
};

export function getMotionPersonality(characterId: string): MotionPersonality {
  return BUILTIN_PERSONALITIES[characterId] ?? derivePersonality(characterId);
}

export function pickRestAction(
  weights: Record<AmbientRestAction, number>,
): AmbientRestAction {
  let total = 0;
  for (const weight of Object.values(weights)) {
    total += Math.max(weight, 0);
  }
  if (total <= 0) return "idle";

  let roll = Math.random() * total;
  for (const [action, weight] of Object.entries(weights) as Array<
    [AmbientRestAction, number]
  >) {
    roll -= Math.max(weight, 0);
    if (roll <= 0) return action;
  }
  return "idle";
}

const DERIVED_MOVE_PATTERNS: readonly MovePattern[] = [
  "wander",
  "wander",
  "patrol",
  "hop",
];

/**
 * Custom characters get a personality derived from their id, so every
 * uploaded character moves in its own consistent way across sessions.
 */
function derivePersonality(characterId: string): MotionPersonality {
  const random = createSeededRandom(hashString(characterId));
  const pauseMsMin = 1200 + random() * 6000;
  const signature = pickSignatureGesture(random());

  return {
    speedFactor: 0.6 + random() * 1,
    wanderRangeX: 3 + random() * 7,
    wanderRangeY: 0.8 + random() * 1.7,
    pauseMsMin,
    pauseMsMax: pauseMsMin + 1400 + random() * 4200,
    movePattern:
      DERIVED_MOVE_PATTERNS[
        Math.floor(random() * DERIVED_MOVE_PATTERNS.length)
      ],
    restActionWeights: {
      idle: 2 + random() * 2,
      waving: (signature === "waving" ? 4 : 0.5) + random(),
      review: (signature === "review" ? 4 : 0.5) + random(),
      waiting: (signature === "waiting" ? 4 : 0.5) + random(),
      jumping: (signature === "jumping" ? 4 : 0) + random() * 0.5,
    },
    restMsMin: 1200 + random() * 1400,
    restMsMax: 2600 + random() * 2400,
    restChainChance: 0.3 + random() * 0.4,
  };
}

function pickSignatureGesture(
  roll: number,
): Exclude<AmbientRestAction, "idle"> {
  if (roll < 0.25) return "waving";
  if (roll < 0.5) return "review";
  if (roll < 0.75) return "waiting";
  return "jumping";
}

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let result = state;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}
