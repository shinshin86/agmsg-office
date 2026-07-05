export type AmbientRestAction =
  | "idle"
  | "waving"
  | "waiting"
  | "review"
  | "jumping";

export interface MotionPersonality {
  /** Multiplier on the base walk speed. 1 = the previous shared pace. */
  speedFactor: number;
  /** How far (in stage % units) the character roams from home on a stroll. */
  wanderRangeX: number;
  /** Vertical drift allowed around home (stage % units). */
  wanderRangeY: number;
  /** Pause between strolls, in milliseconds. */
  pauseMsMin: number;
  pauseMsMax: number;
  /** Relative weights for the rest action picked when a stroll ends. */
  restActionWeights: Record<AmbientRestAction, number>;
  /** How long a non-idle rest action plays, in milliseconds. */
  restMsMin: number;
  restMsMax: number;
  /** Chance to chain into another gesture while still resting at the desk. */
  restChainChance: number;
}

const BUILTIN_PERSONALITIES: Record<string, MotionPersonality> = {
  // Boss: cheerful, makes lively rounds of her own corner and greets everyone.
  miko: {
    speedFactor: 1.15,
    wanderRangeX: 10,
    wanderRangeY: 2.5,
    pauseMsMin: 2200,
    pauseMsMax: 5200,
    restActionWeights: {
      idle: 4,
      waving: 3,
      review: 1,
      waiting: 1,
      jumping: 1,
    },
    restMsMin: 1200,
    restMsMax: 2600,
    restChainChance: 0.5,
  },
  // Gentle: stays close to her desk, unhurried short strolls.
  mai: {
    speedFactor: 0.8,
    wanderRangeX: 6,
    wanderRangeY: 1.5,
    pauseMsMin: 4200,
    pauseMsMax: 8000,
    restActionWeights: {
      idle: 6,
      waving: 2,
      review: 1,
      waiting: 2,
      jumping: 0,
    },
    restMsMin: 1400,
    restMsMax: 2600,
    restChainChance: 0.3,
  },
  // Lively: fidgety around her desk, jumps when pleased.
  haya: {
    speedFactor: 1.45,
    wanderRangeX: 9,
    wanderRangeY: 2.5,
    pauseMsMin: 1400,
    pauseMsMax: 3200,
    restActionWeights: {
      idle: 3,
      waving: 2,
      review: 1,
      waiting: 0.5,
      jumping: 3,
    },
    restMsMin: 900,
    restMsMax: 1800,
    restChainChance: 0.65,
  },
  // Calm: rarely leaves her spot, sinks into long reviews.
  suzu: {
    speedFactor: 0.7,
    wanderRangeX: 4,
    wanderRangeY: 1,
    pauseMsMin: 5200,
    pauseMsMax: 9600,
    restActionWeights: {
      idle: 5,
      waving: 0.5,
      review: 3,
      waiting: 2,
      jumping: 0,
    },
    restMsMin: 1800,
    restMsMax: 3400,
    restChainChance: 0.35,
  },
  // Friendly: easy pace around her desk, waves at coworkers a lot.
  kii: {
    speedFactor: 1,
    wanderRangeX: 8,
    wanderRangeY: 2,
    pauseMsMin: 2600,
    pauseMsMax: 5600,
    restActionWeights: {
      idle: 4,
      waving: 4,
      review: 1,
      waiting: 1,
      jumping: 0.5,
    },
    restMsMin: 1200,
    restMsMax: 2400,
    restChainChance: 0.55,
  },
  // Bright: quick on her feet, upbeat little hops between errands.
  rin: {
    speedFactor: 1.25,
    wanderRangeX: 8.5,
    wanderRangeY: 2,
    pauseMsMin: 1800,
    pauseMsMax: 4200,
    restActionWeights: {
      idle: 3,
      waving: 3,
      review: 0.5,
      waiting: 0.5,
      jumping: 2,
    },
    restMsMin: 1000,
    restMsMax: 2000,
    restChainChance: 0.6,
  },
  // Composed: deliberate walks, often pauses to review her notes.
  nao: {
    speedFactor: 0.9,
    wanderRangeX: 7,
    wanderRangeY: 1.5,
    pauseMsMin: 3600,
    pauseMsMax: 7000,
    restActionWeights: {
      idle: 4,
      waving: 0.5,
      review: 4,
      waiting: 1.5,
      jumping: 0,
    },
    restMsMin: 1600,
    restMsMax: 3000,
    restChainChance: 0.45,
  },
  // Warm: relaxed strolls around her own corner of the office.
  mio: {
    speedFactor: 0.85,
    wanderRangeX: 6.5,
    wanderRangeY: 1.8,
    pauseMsMin: 3000,
    pauseMsMax: 6400,
    restActionWeights: {
      idle: 5,
      waving: 2.5,
      review: 1,
      waiting: 2,
      jumping: 0,
    },
    restMsMin: 1400,
    restMsMax: 2600,
    restChainChance: 0.4,
  },
  // Steady: keeps a regular rhythm, methodical rounds of her area.
  sora: {
    speedFactor: 0.95,
    wanderRangeX: 7.5,
    wanderRangeY: 1.2,
    pauseMsMin: 3200,
    pauseMsMax: 6000,
    restActionWeights: {
      idle: 4,
      waving: 1,
      review: 2.5,
      waiting: 2,
      jumping: 0,
    },
    restMsMin: 1400,
    restMsMax: 2600,
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

/**
 * Custom characters get a personality derived from their id, so every
 * uploaded character moves in its own consistent way across sessions.
 */
function derivePersonality(characterId: string): MotionPersonality {
  const random = createSeededRandom(hashString(characterId));
  const pauseMsMin = 1600 + random() * 3200;

  return {
    speedFactor: 0.75 + random() * 0.65,
    wanderRangeX: 4 + random() * 6,
    wanderRangeY: 1 + random() * 1.5,
    pauseMsMin,
    pauseMsMax: pauseMsMin + 1800 + random() * 3000,
    restActionWeights: {
      idle: 3 + random() * 3,
      waving: random() * 3,
      review: random() * 3,
      waiting: random() * 2,
      jumping: random() * 2,
    },
    restMsMin: 1000 + random() * 800,
    restMsMax: 2000 + random() * 1400,
    restChainChance: 0.3 + random() * 0.35,
  };
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
