import type { AttributeName, CharacterSheet, HealthTier } from "../types";

export type Difficulty = "NORMAL" | "HARD" | "VERY_HARD";
export type DamageSeverity = "LIGHT" | "HEAVY";
export type RestType = "SHORT" | "LONG";

export type RollOutcome =
  | "CRITICAL_FAILURE"
  | "CRITICAL_SUCCESS"
  | "FALHA_GRAVE"
  | "FALHA_LEVE"
  | "SUCESSO_COM_CUSTO"
  | "SUCESSO_TOTAL"
  | "IMPOSSIVEL";

export interface RollResult {
  skipped: boolean;
  naturalRoll?: number;
  total?: number;
  outcome: RollOutcome;
  labelPtBr: string;
  message?: string;
}

const HEALTH_PENALTY: Record<HealthTier, number> = {
  HEALTHY: 0,
  INJURED: 2,
  CRITICAL: 5,
  DEAD: 999,
};

const DIFFICULTY_MOD: Record<Difficulty, number> = {
  NORMAL: 0,
  HARD: 2,
  VERY_HARD: 5,
};

const HEALTH_DOWNGRADE: HealthTier[] = ["HEALTHY", "INJURED", "CRITICAL", "DEAD"];

const OUTCOME_LABEL: Record<Exclude<RollOutcome, "IMPOSSIVEL">, string> = {
  CRITICAL_FAILURE: "FALHA CRITICA",
  CRITICAL_SUCCESS: "SUCESSO CRITICO",
  FALHA_GRAVE: "FALHA GRAVE",
  FALHA_LEVE: "FALHA LEVE",
  SUCESSO_COM_CUSTO: "SUCESSO COM CUSTO",
  SUCESSO_TOTAL: "SUCESSO TOTAL",
};

const IMPOSSIBLE_LABEL = "IMPOSSIVEL";

const ATTR_NAMES: AttributeName[] = ["VIGOR", "DESTREZA", "MENTE", "PRESENÇA"];

export function sanitizeAttributes(attributes: Record<AttributeName, number>): Record<AttributeName, number> {
  const normalized: Record<AttributeName, number> = {
    VIGOR: clamp(attributes.VIGOR, 0, 5),
    DESTREZA: clamp(attributes.DESTREZA, 0, 5),
    MENTE: clamp(attributes.MENTE, 0, 5),
    PRESENÇA: clamp(attributes.PRESENÇA, 0, 5),
  };

  let total = sumAttributes(normalized);
  if (total === 10) {
    return normalized;
  }

  if (total > 10) {
    while (total > 10) {
      const target = getHighestAttribute(normalized, (value) => value > 0);
      if (!target) {
        break;
      }
      normalized[target] -= 1;
      total -= 1;
    }
    return normalized;
  }

  while (total < 10) {
    const target = getHighestAttribute(normalized, (value) => value < 5);
    if (!target) {
      break;
    }
    normalized[target] += 1;
    total += 1;
  }

  return normalized;
}

export function calculateRoll(params: {
  attribute: AttributeName;
  attributeValue: number;
  isProfessionRelevant: boolean;
  difficulty: Difficulty;
  healthTier: HealthTier;
  naturalRoll: number;
  isImpossible?: boolean;
  impossibleReason?: string;
}): RollResult {
  if (params.isImpossible) {
    return {
      skipped: true,
      outcome: "IMPOSSIVEL",
      labelPtBr: IMPOSSIBLE_LABEL,
      message:
        params.impossibleReason ||
        "Boa tentativa, mas nem o mestre consegue dobrar a realidade desse jeito.",
    };
  }

  const naturalRoll = clamp(Math.floor(params.naturalRoll), 1, 20);
  if (naturalRoll === 1) {
    return {
      skipped: false,
      naturalRoll,
      total: 1,
      outcome: "CRITICAL_FAILURE",
      labelPtBr: OUTCOME_LABEL.CRITICAL_FAILURE,
    };
  }

  if (naturalRoll === 20) {
    return {
      skipped: false,
      naturalRoll,
      total: 20,
      outcome: "CRITICAL_SUCCESS",
      labelPtBr: OUTCOME_LABEL.CRITICAL_SUCCESS,
    };
  }

  const attributeBonus = Math.ceil(clamp(params.attributeValue, 0, 5) / 2);
  const professionBonus = params.isProfessionRelevant ? 2 : 0;
  const healthPenalty = HEALTH_PENALTY[params.healthTier] ?? 0;
  const difficultyPenalty = DIFFICULTY_MOD[params.difficulty] ?? 0;

  const total =
    naturalRoll + attributeBonus + professionBonus - healthPenalty - difficultyPenalty;

  if (total <= 5) {
    return {
      skipped: false,
      naturalRoll,
      total,
      outcome: "FALHA_GRAVE",
      labelPtBr: OUTCOME_LABEL.FALHA_GRAVE,
    };
  }

  if (total <= 10) {
    return {
      skipped: false,
      naturalRoll,
      total,
      outcome: "FALHA_LEVE",
      labelPtBr: OUTCOME_LABEL.FALHA_LEVE,
    };
  }

  if (total <= 15) {
    return {
      skipped: false,
      naturalRoll,
      total,
      outcome: "SUCESSO_COM_CUSTO",
      labelPtBr: OUTCOME_LABEL.SUCESSO_COM_CUSTO,
    };
  }

  return {
    skipped: false,
    naturalRoll,
    total,
    outcome: "SUCESSO_TOTAL",
    labelPtBr: OUTCOME_LABEL.SUCESSO_TOTAL,
  };
}

export function applyDamage(character: CharacterSheet, severity: DamageSeverity): CharacterSheet {
  const next = cloneCharacter(character);

  if (next.health.tier === "DEAD") {
    return next;
  }

  if (severity === "LIGHT") {
    next.health.lightDamageCounter = clamp(next.health.lightDamageCounter + 1, 0, 3);
    if (next.health.lightDamageCounter >= 3) {
      next.health.lightDamageCounter = 0;
      next.health.tier = downgradeTier(next.health.tier);
    }
    return next;
  }

  next.health.lightDamageCounter = 0;
  next.health.tier = downgradeTier(next.health.tier);
  return next;
}

export function applyRest(character: CharacterSheet, type: RestType): CharacterSheet {
  const next = cloneCharacter(character);

  if (type === "SHORT") {
    next.health.lightDamageCounter = 0;
    return next;
  }

  next.health.lightDamageCounter = 0;
  next.health.tier = upgradeTier(next.health.tier);
  return next;
}

function downgradeTier(tier: HealthTier): HealthTier {
  const index = HEALTH_DOWNGRADE.indexOf(tier);
  if (index === -1 || index === HEALTH_DOWNGRADE.length - 1) {
    return tier;
  }
  return HEALTH_DOWNGRADE[index + 1];
}

function upgradeTier(tier: HealthTier): HealthTier {
  const index = HEALTH_DOWNGRADE.indexOf(tier);
  if (index <= 0) {
    return tier;
  }
  return HEALTH_DOWNGRADE[index - 1];
}

function sumAttributes(attributes: Record<AttributeName, number>): number {
  return ATTR_NAMES.reduce((total, attr) => total + attributes[attr], 0);
}

function getHighestAttribute(
  attributes: Record<AttributeName, number>,
  predicate: (value: number) => boolean,
): AttributeName | null {
  let best: AttributeName | null = null;
  let bestValue = -Infinity;

  for (const attr of ATTR_NAMES) {
    const value = attributes[attr];
    if (!predicate(value)) {
      continue;
    }
    if (value > bestValue) {
      best = attr;
      bestValue = value;
    }
  }

  return best;
}

function cloneCharacter(character: CharacterSheet): CharacterSheet {
  return {
    ...character,
    attributes: { ...character.attributes },
    health: { ...character.health },
    inventory: character.inventory.map((item) => ({ ...item })),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
