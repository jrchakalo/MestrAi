import {
  sanitizeAttributes,
  calculateRoll,
  applyDamage,
  applyRest,
  applyHealthStateEvent,
  type RollOutcome,
  type HealthEvent,
  type Difficulty,
  type DamageSeverity,
} from '@/lib/gameRules'
import type { CharacterSheet, AttributeName, HealthTier } from '@/types'

describe('gameRules - Attribute Sanitization', () => {
  it('should clamp attributes between 0 and 5', () => {
    const attributes = {
      VIGOR: 10,
      DESTREZA: -5,
      MENTE: 3,
      PRESENÇA: 2,
    }
    const result = sanitizeAttributes(attributes)
    expect(result.VIGOR).toBe(5)
    expect(result.DESTREZA).toBe(0)
    expect(result.MENTE).toBe(3)
    expect(result.PRESENÇA).toBe(2)
  })

  it('should ensure total attributes equal 10', () => {
    const attributes = {
      VIGOR: 5,
      DESTREZA: 3,
      MENTE: 1,
      PRESENÇA: 0,
    }
    const result = sanitizeAttributes(attributes)
    const total = result.VIGOR + result.DESTREZA + result.MENTE + result.PRESENÇA
    expect(total).toBe(10)
  })

  it('should reduce attributes if total exceeds 10', () => {
    const attributes = {
      VIGOR: 5,
      DESTREZA: 4,
      MENTE: 3,
      PRESENÇA: 2,
    }
    const result = sanitizeAttributes(attributes)
    const total = result.VIGOR + result.DESTREZA + result.MENTE + result.PRESENÇA
    expect(total).toBe(10)
  })

  it('should increase attributes if total is less than 10', () => {
    const attributes = {
      VIGOR: 2,
      DESTREZA: 1,
      MENTE: 1,
      PRESENÇA: 0,
    }
    const result = sanitizeAttributes(attributes)
    const total = result.VIGOR + result.DESTREZA + result.MENTE + result.PRESENÇA
    expect(total).toBe(10)
  })

  it('should preserve valid balanced attributes', () => {
    const attributes = {
      VIGOR: 3,
      DESTREZA: 3,
      MENTE: 2,
      PRESENÇA: 2,
    }
    const result = sanitizeAttributes(attributes)
    expect(result).toEqual(attributes)
  })
})

describe('gameRules - Dice Rolling', () => {
  const createTestCharacter = (): CharacterSheet => ({
    name: 'Test Character',
    appearance: 'Generic',
    profession: 'Warrior',
    backstory: 'Test backstory',
    attributes: {
      VIGOR: 3,
      DESTREZA: 3,
      MENTE: 2,
      PRESENÇA: 2,
    },
    health: {
      tier: 'HEALTHY',
      lightDamageCounter: 0,
    },
    inventory: [],
  })

  it('should return CRITICAL_FAILURE on natural roll of 1', () => {
    const result = calculateRoll({
      attribute: 'VIGOR',
      attributeValue: 5,
      isProfessionRelevant: true,
      difficulty: 'NORMAL',
      healthTier: 'HEALTHY',
      naturalRoll: 1,
    })
    expect(result.outcome).toBe('CRITICAL_FAILURE')
    expect(result.naturalRoll).toBe(1)
  })

  it('should return CRITICAL_SUCCESS on natural roll of 20', () => {
    const result = calculateRoll({
      attribute: 'VIGOR',
      attributeValue: 2,
      isProfessionRelevant: false,
      difficulty: 'VERY_HARD',
      healthTier: 'CRITICAL',
      naturalRoll: 20,
    })
    expect(result.outcome).toBe('CRITICAL_SUCCESS')
    expect(result.naturalRoll).toBe(20)
  })

  it('should mark as skipped when marked impossible', () => {
    const result = calculateRoll({
      attribute: 'VIGOR',
      attributeValue: 5,
      isProfessionRelevant: true,
      difficulty: 'NORMAL',
      healthTier: 'HEALTHY',
      naturalRoll: 15,
      isImpossible: true,
      impossibleReason: 'Never gonna happen',
    })
    expect(result.skipped).toBe(true)
    expect(result.outcome).toBe('IMPOSSIVEL')
  })

  it('should apply attribute bonus correctly', () => {
    // Attribute 5 -> bonus 3, roll has 10, diff 0
    // Total = 10 + 3 = 13, which is <= 15: SUCESSO_COM_CUSTO
    const result = calculateRoll({
      attribute: 'VIGOR',
      attributeValue: 5,
      isProfessionRelevant: false,
      difficulty: 'NORMAL',
      healthTier: 'HEALTHY',
      naturalRoll: 10,
    })
    expect(result.total).toBe(13)
    expect(result.outcome).toBe('SUCESSO_COM_CUSTO')
  })

  it('should apply profession bonus when relevant', () => {
    const resultWithBonus = calculateRoll({
      attribute: 'VIGOR',
      attributeValue: 3,
      isProfessionRelevant: true,
      difficulty: 'NORMAL',
      healthTier: 'HEALTHY',
      naturalRoll: 8,
    })
    const resultWithoutBonus = calculateRoll({
      attribute: 'VIGOR',
      attributeValue: 3,
      isProfessionRelevant: false,
      difficulty: 'NORMAL',
      healthTier: 'HEALTHY',
      naturalRoll: 8,
    })
    expect(resultWithBonus.total! - resultWithoutBonus.total!).toBe(2)
  })

  it('should apply health penalty', () => {
    const healthy = calculateRoll({
      attribute: 'VIGOR',
      attributeValue: 3,
      isProfessionRelevant: false,
      difficulty: 'NORMAL',
      healthTier: 'HEALTHY',
      naturalRoll: 10,
    })
    const injured = calculateRoll({
      attribute: 'VIGOR',
      attributeValue: 3,
      isProfessionRelevant: false,
      difficulty: 'NORMAL',
      healthTier: 'INJURED',
      naturalRoll: 10,
    })
    expect(healthy.total! - injured.total!).toBe(2)
  })

  it('should apply difficulty penalty', () => {
    const normal = calculateRoll({
      attribute: 'VIGOR',
      attributeValue: 3,
      isProfessionRelevant: false,
      difficulty: 'NORMAL',
      healthTier: 'HEALTHY',
      naturalRoll: 10,
    })
    const hard = calculateRoll({
      attribute: 'VIGOR',
      attributeValue: 3,
      isProfessionRelevant: false,
      difficulty: 'HARD',
      healthTier: 'HEALTHY',
      naturalRoll: 10,
    })
    expect(normal.total! - hard.total!).toBe(2)
  })

  it('should produce correct outcomes for different totals', () => {
    // Mock low total
    const lowTotal = calculateRoll({
      attribute: 'VIGOR',
      attributeValue: 1,
      isProfessionRelevant: false,
      difficulty: 'VERY_HARD',
      healthTier: 'CRITICAL',
      naturalRoll: 2,
    })
    expect(lowTotal.outcome).toBe('FALHA_GRAVE')

    // Mock mid-low total
    // Need total between 6-10 for FALHA_LEVE
    // attribute 2 -> bonus 1, natural 10, no prof = 10 + 1 = 11, too high
    // attribute 1 -> bonus 1, natural 10, no prof, hard (-2) = 10 + 1 - 2 = 9 ✓
    const midLowTotal = calculateRoll({
      attribute: 'VIGOR',
      attributeValue: 1,
      isProfessionRelevant: false,
      difficulty: 'HARD',
      healthTier: 'HEALTHY',
      naturalRoll: 10,
    })
    expect(midLowTotal.outcome).toBe('FALHA_LEVE')

    // Mock mid total
    const midTotal = calculateRoll({
      attribute: 'VIGOR',
      attributeValue: 2,
      isProfessionRelevant: false,
      difficulty: 'NORMAL',
      healthTier: 'HEALTHY',
      naturalRoll: 10,
    })
    expect(midTotal.outcome).toBe('SUCESSO_COM_CUSTO')

    // Mock high total
    const highTotal = calculateRoll({
      attribute: 'VIGOR',
      attributeValue: 5,
      isProfessionRelevant: true,
      difficulty: 'NORMAL',
      healthTier: 'HEALTHY',
      naturalRoll: 18,
    })
    expect(highTotal.outcome).toBe('SUCESSO_TOTAL')
  })
})

describe('gameRules - Health System', () => {
  const createHealthyCharacter = (): CharacterSheet => ({
    name: 'Test',
    appearance: 'Test',
    profession: 'Test',
    backstory: 'Test',
    attributes: { VIGOR: 3, DESTREZA: 3, MENTE: 2, PRESENÇA: 2 },
    health: { tier: 'HEALTHY', lightDamageCounter: 0 },
    inventory: [],
  })

  it('should apply light damage and increment counter', () => {
    const character = createHealthyCharacter()
    const result = applyHealthStateEvent(character, 'DAMAGE_LIGHT')
    expect(result.transition.fromTier).toBe('HEALTHY')
    expect(result.transition.toLightDamageCounter).toBe(1)
    expect(result.transition.changed).toBe(true)
  })

  it('should downgrade tier after 3 light damages', () => {
    const character = createHealthyCharacter()
    let current = character
    for (let i = 0; i < 3; i++) {
      const result = applyHealthStateEvent(current, 'DAMAGE_LIGHT')
      current = result.next
    }
    expect(current.health.tier).toBe('INJURED')
    expect(current.health.lightDamageCounter).toBe(0)
  })

  it('should apply heavy damage directly', () => {
    const character = createHealthyCharacter()
    const result = applyHealthStateEvent(character, 'DAMAGE_HEAVY')
    expect(result.transition.toTier).toBe('INJURED')
    expect(result.transition.toLightDamageCounter).toBe(0)
  })

  it('should restore light damage counter on SHORT rest', () => {
    const character = createHealthyCharacter()
    character.health.lightDamageCounter = 2
    const result = applyHealthStateEvent(character, 'REST_SHORT')
    expect(result.next.health.lightDamageCounter).toBe(0)
    expect(result.next.health.tier).toBe('HEALTHY')
  })

  it('should upgrade tier on LONG rest', () => {
    const character = createHealthyCharacter()
    character.health.tier = 'INJURED'
    const result = applyHealthStateEvent(character, 'REST_LONG')
    expect(result.next.health.tier).toBe('HEALTHY')
  })

  it('should detect death transition', () => {
    const character = createHealthyCharacter()
    character.health.tier = 'CRITICAL'
    character.health.lightDamageCounter = 2
    const result = applyHealthStateEvent(character, 'DAMAGE_LIGHT')
    expect(result.transition.becameDead).toBe(true)
    expect(result.next.health.tier).toBe('DEAD')
  })

  it('should force death if specified', () => {
    const character = createHealthyCharacter()
    const result = applyHealthStateEvent(character, 'FORCE_DEAD')
    expect(result.next.health.tier).toBe('DEAD')
    expect(result.next.health.lightDamageCounter).toBe(0)
  })

  it('should not change health when DEAD', () => {
    const character = createHealthyCharacter()
    character.health.tier = 'DEAD'
    const result = applyHealthStateEvent(character, 'DAMAGE_LIGHT')
    expect(result.transition.changed).toBe(false)
    expect(result.next.health.tier).toBe('DEAD')
  })

  it('should use applyDamage helper correctly', () => {
    const character = createHealthyCharacter()
    const lighter = applyDamage(character, 'LIGHT')
    expect(lighter.health.lightDamageCounter).toBe(1)

    const heavy = applyDamage(character, 'HEAVY')
    expect(heavy.health.tier).toBe('INJURED')
  })

  it('should use applyRest helper correctly', () => {
    const character = createHealthyCharacter()
    character.health.tier = 'INJURED'
    character.health.lightDamageCounter = 2

    const afterShort = applyRest(character, 'SHORT')
    expect(afterShort.health.tier).toBe('INJURED')
    expect(afterShort.health.lightDamageCounter).toBe(0)

    const afterLong = applyRest(character, 'LONG')
    expect(afterLong.health.tier).toBe('HEALTHY')
  })
})

describe('gameRules - Health Progression Edge Cases', () => {
  const createCharacterAt = (tier: HealthTier, counter: number = 0): CharacterSheet => ({
    name: 'Test',
    appearance: 'Test',
    profession: 'Test',
    backstory: 'Test',
    attributes: { VIGOR: 3, DESTREZA: 3, MENTE: 2, PRESENÇA: 2 },
    health: { tier, lightDamageCounter: counter },
    inventory: [],
  })

  it('should handle full health progression: HEALTHY -> INJURED -> CRITICAL -> DEAD', () => {
    let char = createCharacterAt('HEALTHY')

    // HEALTHY to INJURED: 3 light damages
    for (let i = 0; i < 3; i++) {
      const result = applyHealthStateEvent(char, 'DAMAGE_LIGHT')
      char = result.next
    }
    expect(char.health.tier).toBe('INJURED')

    // INJURED to CRITICAL: 1 heavy damage
    const result2 = applyHealthStateEvent(char, 'DAMAGE_HEAVY')
    char = result2.next
    expect(char.health.tier).toBe('CRITICAL')

    // CRITICAL to DEAD: 3 light damages
    for (let i = 0; i < 3; i++) {
      const result = applyHealthStateEvent(char, 'DAMAGE_LIGHT')
      char = result.next
    }
    expect(char.health.tier).toBe('DEAD')
  })

  it('should handle multiple LONG rests correctly', () => {
    let char = createCharacterAt('CRITICAL')

    const result1 = applyHealthStateEvent(char, 'REST_LONG')
    char = result1.next
    expect(char.health.tier).toBe('INJURED')

    const result2 = applyHealthStateEvent(char, 'REST_LONG')
    char = result2.next
    expect(char.health.tier).toBe('HEALTHY')

    // Another LONG rest should not go above HEALTHY
    const result3 = applyHealthStateEvent(char, 'REST_LONG')
    char = result3.next
    expect(char.health.tier).toBe('HEALTHY')
  })

  it('should not allow health changes when dead', () => {
    let char = createCharacterAt('DEAD')

    const events: HealthEvent[] = ['DAMAGE_LIGHT', 'DAMAGE_HEAVY', 'REST_SHORT', 'REST_LONG']
    for (const event of events) {
      const result = applyHealthStateEvent(char, event)
      expect(result.next.health.tier).toBe('DEAD')
      expect(result.transition.changed).toBe(false)
    }
  })
})
