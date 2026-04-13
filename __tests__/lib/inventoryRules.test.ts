import { applyInventoryAction, inventorySummary } from '@/lib/inventoryRules'
import type { CharacterSheet, InventoryItem } from '@/types'

describe('inventoryRules - applyInventoryAction', () => {
  const createBaseCharacter = (): CharacterSheet => ({
    name: 'Hero',
    appearance: 'Strong',
    profession: 'Warrior',
    backstory: 'Brave warrior',
    attributes: { VIGOR: 3, DESTREZA: 3, MENTE: 2, PRESENÇA: 2 },
    health: { tier: 'HEALTHY', lightDamageCounter: 0 },
    inventory: [],
  })

  describe('acquire operation', () => {
    it('should acquire a new consumable item', () => {
      const char = createBaseCharacter()
      const result = applyInventoryAction(char, {
        operation: 'acquire',
        item: { name: 'Potion', type: 'consumable' },
        amount: 3,
      })

      expect(result.changed).toBe(true)
      expect(result.next.inventory).toHaveLength(1)
      expect(result.next.inventory[0].name).toBe('Potion')
      expect(result.next.inventory[0].quantity).toBe(3)
      expect(result.next.inventory[0].type).toBe('consumable')
    })

    it('should acquire a new equipment item', () => {
      const char = createBaseCharacter()
      const result = applyInventoryAction(char, {
        operation: 'acquire',
        item: {
          name: 'Sword',
          type: 'equipment',
          durabilityMax: 5,
        },
      })

      expect(result.changed).toBe(true)
      expect(result.next.inventory).toHaveLength(1)
      const item = result.next.inventory[0]
      expect(item.name).toBe('Sword')
      expect(item.type).toBe('equipment')
      expect(item.durabilityMax).toBe(5)
      expect(item.durabilityCurrent).toBe(5)
      expect(item.broken).toBe(false)
    })

    it('should stack consumables of same type', () => {
      const char = createBaseCharacter()
      char.inventory.push({
        id: 'potion-1',
        name: 'Potion',
        type: 'consumable',
        quantity: 2,
      })

      const result = applyInventoryAction(char, {
        operation: 'acquire',
        item: { name: 'Potion', type: 'consumable' },
        amount: 5,
      })

      expect(result.changed).toBe(true)
      expect(result.next.inventory).toHaveLength(1)
      expect(result.next.inventory[0].quantity).toBe(7)
    })

    it('should handle equipment durability upgrade', () => {
      const char = createBaseCharacter()
      const sword: InventoryItem = {
        id: 'sword-1',
        name: 'Sword',
        type: 'equipment',
        quantity: 1,
        durabilityMax: 3,
        durabilityCurrent: 1,
        broken: false,
      }
      char.inventory.push(sword)

      const result = applyInventoryAction(char, {
        operation: 'acquire',
        item: { id: 'sword-1', durabilityMax: 5 },
      })

      expect(result.changed).toBe(true)
      expect(result.next.inventory[0].durabilityMax).toBe(5)
      expect(result.next.inventory[0].durabilityCurrent).toBe(5)
      expect(result.next.inventory[0].broken).toBe(false)
    })
  })

  describe('consume operation', () => {
    it('should consume consumable items', () => {
      const char = createBaseCharacter()
      char.inventory.push({
        id: 'potion-1',
        name: 'Health Potion',
        type: 'consumable',
        quantity: 5,
      })

      const result = applyInventoryAction(char, {
        operation: 'consume',
        itemId: 'potion-1',
        amount: 2,
      })

      expect(result.changed).toBe(true)
      expect(result.next.inventory[0].quantity).toBe(3)
    })

    it('should remove consumed items when quantity reaches 0', () => {
      const char = createBaseCharacter()
      char.inventory.push({
        id: 'potion-1',
        name: 'Health Potion',
        type: 'consumable',
        quantity: 2,
      })

      const result = applyInventoryAction(char, {
        operation: 'consume',
        itemId: 'potion-1',
        amount: 2,
      })

      expect(result.changed).toBe(true)
      expect(result.next.inventory).toHaveLength(0)
    })

    it('should reduce equipment durability when consumed', () => {
      const char = createBaseCharacter()
      char.inventory.push({
        id: 'sword-1',
        name: 'Sword',
        type: 'equipment',
        quantity: 1,
        durabilityMax: 5,
        durabilityCurrent: 3,
        broken: false,
      })

      const result = applyInventoryAction(char, {
        operation: 'consume',
        itemId: 'sword-1',
        amount: 2,
      })

      expect(result.changed).toBe(true)
      expect(result.next.inventory[0].durabilityCurrent).toBe(1)
      expect(result.next.inventory[0].broken).toBe(false)
    })

    it('should mark equipment as broken when durability reaches 0', () => {
      const char = createBaseCharacter()
      char.inventory.push({
        id: 'sword-1',
        name: 'Sword',
        type: 'equipment',
        quantity: 1,
        durabilityMax: 2,
        durabilityCurrent: 1,
        broken: false,
      })

      const result = applyInventoryAction(char, {
        operation: 'consume',
        itemId: 'sword-1',
        amount: 2,
      })

      expect(result.changed).toBe(true)
      expect(result.next.inventory[0].broken).toBe(true)
      expect(result.next.inventory[0].durabilityCurrent).toBe(0)
    })
  })

  describe('drop operation', () => {
    it('should drop consumable items', () => {
      const char = createBaseCharacter()
      char.inventory.push({
        id: 'potion-1',
        name: 'Health Potion',
        type: 'consumable',
        quantity: 5,
      })

      const result = applyInventoryAction(char, {
        operation: 'drop',
        itemId: 'potion-1',
        amount: 2,
      })

      expect(result.changed).toBe(true)
      expect(result.next.inventory[0].quantity).toBe(3)
    })

    it('should drop entire equipment item', () => {
      const char = createBaseCharacter()
      char.inventory.push({
        id: 'sword-1',
        name: 'Sword',
        type: 'equipment',
        quantity: 1,
        durabilityMax: 5,
        durabilityCurrent: 5,
        broken: false,
      })

      const result = applyInventoryAction(char, {
        operation: 'drop',
        itemId: 'sword-1',
      })

      expect(result.changed).toBe(true)
      expect(result.next.inventory).toHaveLength(0)
    })
  })

  describe('break operation', () => {
    it('should break equipment item', () => {
      const char = createBaseCharacter()
      char.inventory.push({
        id: 'sword-1',
        name: 'Sword',
        type: 'equipment',
        quantity: 1,
        durabilityMax: 5,
        durabilityCurrent: 3,
        broken: false,
      })

      const result = applyInventoryAction(char, {
        operation: 'break',
        itemId: 'sword-1',
      })

      expect(result.changed).toBe(true)
      expect(result.next.inventory[0].broken).toBe(true)
      expect(result.next.inventory[0].durabilityCurrent).toBe(0)
    })

    it('should not break consumable items', () => {
      const char = createBaseCharacter()
      char.inventory.push({
        id: 'potion-1',
        name: 'Potion',
        type: 'consumable',
        quantity: 5,
      })

      const result = applyInventoryAction(char, {
        operation: 'break',
        itemId: 'potion-1',
      })

      expect(result.changed).toBe(false)
      expect(result.eventSummary).toContain('apenas equipamentos podem quebrar')
    })

    it('should handle already broken items', () => {
      const char = createBaseCharacter()
      char.inventory.push({
        id: 'sword-1',
        name: 'Sword',
        type: 'equipment',
        quantity: 1,
        durabilityMax: 5,
        durabilityCurrent: 0,
        broken: true,
      })

      const result = applyInventoryAction(char, {
        operation: 'break',
        itemId: 'sword-1',
      })

      expect(result.changed).toBe(true)
      expect(result.next.inventory[0].broken).toBe(true)
    })
  })

  describe('repair operation', () => {
    it('should repair broken equipment', () => {
      const char = createBaseCharacter()
      char.inventory.push({
        id: 'sword-1',
        name: 'Sword',
        type: 'equipment',
        quantity: 1,
        durabilityMax: 5,
        durabilityCurrent: 0,
        broken: true,
      })

      const result = applyInventoryAction(char, {
        operation: 'repair',
        itemId: 'sword-1',
      })

      expect(result.changed).toBe(true)
      expect(result.next.inventory[0].broken).toBe(false)
      expect(result.next.inventory[0].durabilityCurrent).toBe(5)
    })

    it('should not repair consumable items', () => {
      const char = createBaseCharacter()
      char.inventory.push({
        id: 'potion-1',
        name: 'Potion',
        type: 'consumable',
        quantity: 1,
      })

      const result = applyInventoryAction(char, {
        operation: 'repair',
        itemId: 'potion-1',
      })

      expect(result.changed).toBe(false)
      expect(result.eventSummary).toContain('item não reparável')
    })
  })

  describe('set_quantity operation', () => {
    it('should set quantity for consumable items', () => {
      const char = createBaseCharacter()
      char.inventory.push({
        id: 'potion-1',
        name: 'Health Potion',
        type: 'consumable',
        quantity: 5,
      })

      const result = applyInventoryAction(char, {
        operation: 'set_quantity',
        itemId: 'potion-1',
        amount: 10,
      })

      expect(result.changed).toBe(true)
      expect(result.next.inventory[0].quantity).toBe(10)
    })

    it('should clamp quantity between 0 and 9999', () => {
      const char = createBaseCharacter()
      char.inventory.push({
        id: 'potion-1',
        name: 'Potion',
        type: 'consumable',
        quantity: 5,
      })

      const resultNegative = applyInventoryAction(char, {
        operation: 'set_quantity',
        itemId: 'potion-1',
        amount: -10,
      })
      // Item is removed when quantity reaches 0
      expect(resultNegative.next.inventory.length).toBe(0)

      // Create new character for second test
      const char2 = createBaseCharacter()
      char2.inventory.push({
        id: 'potion-2',
        name: 'Potion',
        type: 'consumable',
        quantity: 5,
      })

      const resultLarge = applyInventoryAction(char2, {
        operation: 'set_quantity',
        itemId: 'potion-2',
        amount: 100000,
      })
      expect(resultLarge.next.inventory[0].quantity).toBe(9999)
    })

    it('should not set quantity for equipment', () => {
      const char = createBaseCharacter()
      char.inventory.push({
        id: 'sword-1',
        name: 'Sword',
        type: 'equipment',
        quantity: 1,
        durabilityMax: 5,
        durabilityCurrent: 5,
        broken: false,
      })

      const result = applyInventoryAction(char, {
        operation: 'set_quantity',
        itemId: 'sword-1',
        amount: 5,
      })

      expect(result.changed).toBe(false)
    })
  })

  describe('error handling', () => {
    it('should return unchanged if item not found', () => {
      const char = createBaseCharacter()

      const result = applyInventoryAction(char, {
        operation: 'consume',
        itemId: 'nonexistent',
      })

      expect(result.changed).toBe(false)
      expect(result.eventSummary).toContain('item não encontrado')
    })

    it('should resolve item by name when ID not provided', () => {
      const char = createBaseCharacter()
      char.inventory.push({
        id: 'potion-1',
        name: 'Health Potion',
        type: 'consumable',
        quantity: 5,
      })

      const result = applyInventoryAction(char, {
        operation: 'consume',
        item: { name: 'Health Potion' },
        amount: 2,
      })

      expect(result.changed).toBe(true)
      expect(result.next.inventory[0].quantity).toBe(3)
    })
  })
})

describe('inventoryRules - inventorySummary', () => {
  it('should return empty message for empty inventory', () => {
    const summary = inventorySummary([])
    expect(summary).toContain('vazio')
  })

  it('should format consumable items correctly', () => {
    const inventory: InventoryItem[] = [
      { id: '1', name: 'Potion', type: 'consumable', quantity: 3 },
      { id: '2', name: 'Arrow', type: 'consumable', quantity: 20 },
    ]
    const summary = inventorySummary(inventory)
    expect(summary).toContain('Potion')
    expect(summary).toContain('x3')
    expect(summary).toContain('Arrow')
    expect(summary).toContain('x20')
  })

  it('should format equipment items correctly', () => {
    const inventory: InventoryItem[] = [
      {
        id: '1',
        name: 'Sword',
        type: 'equipment',
        quantity: 1,
        durabilityMax: 5,
        durabilityCurrent: 3,
        broken: false,
      },
      {
        id: '2',
        name: 'Shield',
        type: 'equipment',
        quantity: 1,
        durabilityMax: 4,
        durabilityCurrent: 0,
        broken: true,
      },
    ]
    const summary = inventorySummary(inventory)
    expect(summary).toContain('Sword')
    expect(summary).toContain('durabilidade 3/5')
    expect(summary).toContain('Shield')
    expect(summary).toContain('quebrado')
  })

  it('should filter out broken consumables with 0 quantity', () => {
    const inventory: InventoryItem[] = [
      { id: '1', name: 'Potion', type: 'consumable', quantity: 0 },
      { id: '2', name: 'Arrow', type: 'consumable', quantity: 5 },
    ]
    const summary = inventorySummary(inventory)
    expect(summary).not.toContain('Potion')
    expect(summary).toContain('Arrow')
  })
})
