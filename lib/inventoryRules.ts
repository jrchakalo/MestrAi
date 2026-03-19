import type { CharacterSheet, InventoryItem } from '../types';

export type InventoryOperation = 'acquire' | 'consume' | 'drop' | 'break' | 'repair' | 'set_quantity';

export interface InventoryAction {
  operation: InventoryOperation;
  itemId?: string;
  amount?: number;
  item?: Partial<InventoryItem> & { name?: string; type?: 'consumable' | 'equipment' };
  reason?: string;
}

export interface InventoryChangeResult {
  changed: boolean;
  next: CharacterSheet;
  eventSummary: string;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const normalizeItem = (item: InventoryItem): InventoryItem => {
  const quantity = Number.isFinite(item.quantity) ? Math.max(0, Math.floor(item.quantity)) : 0;
  const durabilityMax = Number.isFinite(item.durabilityMax) ? Math.max(1, Math.floor(item.durabilityMax as number)) : undefined;
  const durabilityCurrent = Number.isFinite(item.durabilityCurrent)
    ? Math.max(0, Math.floor(item.durabilityCurrent as number))
    : durabilityMax;
  const broken = item.broken === true || (!!durabilityCurrent && durabilityCurrent <= 0);

  return {
    ...item,
    quantity,
    durabilityMax,
    durabilityCurrent,
    broken,
    tags: Array.isArray(item.tags) ? item.tags.filter(Boolean) : undefined,
    value: Number.isFinite(item.value) ? Number(item.value) : undefined,
  };
};

const normalizeInventory = (inventory: InventoryItem[]): InventoryItem[] => {
  return inventory
    .map((item) => normalizeItem({ ...item }))
    .filter((item) => {
      if (item.type === 'consumable') return item.quantity > 0;
      return true;
    });
};

const cloneCharacter = (character: CharacterSheet): CharacterSheet => ({
  ...character,
  attributes: { ...character.attributes },
  health: { ...character.health },
  inventory: character.inventory.map((item) => ({ ...item })),
});

const resolveItemId = (nextInventory: InventoryItem[], action: InventoryAction) => {
  if (action.itemId) return action.itemId;
  if (action.item?.id) return action.item.id;
  if (!action.item?.name) return null;
  const byName = nextInventory.find((entry) => entry.name.toLowerCase() === action.item?.name?.toLowerCase());
  return byName?.id || null;
};

const buildSummary = (operation: InventoryOperation, itemName: string, amount: number, reason?: string) => {
  const suffix = reason ? ` Motivo: ${reason}.` : '';
  switch (operation) {
    case 'acquire':
      return `Inventário atualizado: ${itemName} adquirido (${amount}).${suffix}`;
    case 'consume':
      return `Inventário atualizado: ${itemName} usado (${amount}).${suffix}`;
    case 'drop':
      return `Inventário atualizado: ${itemName} descartado (${amount}).${suffix}`;
    case 'break':
      return `Inventário atualizado: ${itemName} quebrado.${suffix}`;
    case 'repair':
      return `Inventário atualizado: ${itemName} reparado.${suffix}`;
    case 'set_quantity':
      return `Inventário atualizado: ${itemName} ajustado para ${amount}.${suffix}`;
    default:
      return `Inventário atualizado: ${itemName}.${suffix}`;
  }
};

export function applyInventoryAction(character: CharacterSheet, action: InventoryAction): InventoryChangeResult {
  const next = cloneCharacter(character);
  const nextInventory = normalizeInventory(next.inventory);
  const amount = Math.max(1, Math.floor(action.amount || 1));

  if (action.operation === 'acquire') {
    const itemData = action.item || {};
    const itemType = itemData.type || 'consumable';
    const itemName = itemData.name?.trim() || 'Item';

    const byId = itemData.id ? nextInventory.find((entry) => entry.id === itemData.id) : undefined;
    const byName = nextInventory.find((entry) => entry.name.toLowerCase() === itemName.toLowerCase() && entry.type === itemType);
    const existing = byId || byName;

    if (existing) {
      if (existing.type === 'consumable') {
        existing.quantity += amount;
      } else if (itemData.durabilityMax) {
        existing.durabilityMax = Math.max(existing.durabilityMax || 1, Math.floor(itemData.durabilityMax));
        existing.durabilityCurrent = existing.durabilityMax;
        existing.broken = false;
      }

      next.inventory = normalizeInventory(nextInventory);
      return {
        changed: true,
        next,
        eventSummary: buildSummary('acquire', existing.name, amount, action.reason),
      };
    }

    const newItem: InventoryItem = normalizeItem({
      id: itemData.id || crypto.randomUUID(),
      name: itemName,
      type: itemType,
      quantity: itemType === 'consumable' ? amount : 1,
      durabilityMax: itemType === 'equipment' ? Math.max(1, Math.floor(itemData.durabilityMax || 3)) : undefined,
      durabilityCurrent: itemType === 'equipment' ? Math.max(1, Math.floor(itemData.durabilityCurrent || itemData.durabilityMax || 3)) : undefined,
      broken: itemType === 'equipment' ? !!itemData.broken : false,
      value: Number.isFinite(itemData.value) ? Number(itemData.value) : undefined,
      tags: Array.isArray(itemData.tags) ? itemData.tags : undefined,
    });

    next.inventory = normalizeInventory([...nextInventory, newItem]);
    return {
      changed: true,
      next,
      eventSummary: buildSummary('acquire', newItem.name, newItem.quantity, action.reason),
    };
  }

  const targetId = resolveItemId(nextInventory, action);
  if (!targetId) {
    return {
      changed: false,
      next,
      eventSummary: 'Inventário sem mudanças: item não encontrado.',
    };
  }

  const index = nextInventory.findIndex((entry) => entry.id === targetId);
  if (index < 0) {
    return {
      changed: false,
      next,
      eventSummary: 'Inventário sem mudanças: item não encontrado.',
    };
  }

  const target = nextInventory[index];

  if (action.operation === 'consume') {
    if (target.type === 'consumable') {
      target.quantity = clamp(target.quantity - amount, 0, 9999);
      next.inventory = normalizeInventory(nextInventory);
      return {
        changed: true,
        next,
        eventSummary: buildSummary('consume', target.name, amount, action.reason),
      };
    }

    const maxDurability = Math.max(1, target.durabilityMax || 3);
    const currentDurability = Number.isFinite(target.durabilityCurrent) ? Number(target.durabilityCurrent) : maxDurability;
    const nextDurability = clamp(currentDurability - amount, 0, maxDurability);
    target.durabilityMax = maxDurability;
    target.durabilityCurrent = nextDurability;
    target.broken = nextDurability <= 0;

    next.inventory = normalizeInventory(nextInventory);
    return {
      changed: true,
      next,
      eventSummary: target.broken
        ? `Inventário atualizado: ${target.name} quebrou após uso.`
        : `Inventário atualizado: ${target.name} usado, durabilidade ${target.durabilityCurrent}/${target.durabilityMax}.`,
    };
  }

  if (action.operation === 'drop') {
    if (target.type === 'consumable') {
      target.quantity = clamp(target.quantity - amount, 0, 9999);
      next.inventory = normalizeInventory(nextInventory);
    } else {
      nextInventory.splice(index, 1);
      next.inventory = normalizeInventory(nextInventory);
    }

    return {
      changed: true,
      next,
      eventSummary: buildSummary('drop', target.name, amount, action.reason),
    };
  }

  if (action.operation === 'break') {
    if (target.type === 'equipment') {
      target.broken = true;
      target.durabilityCurrent = 0;
      target.durabilityMax = target.durabilityMax || 3;
      next.inventory = normalizeInventory(nextInventory);
      return {
        changed: true,
        next,
        eventSummary: buildSummary('break', target.name, 1, action.reason),
      };
    }

    return {
      changed: false,
      next,
      eventSummary: 'Inventário sem mudanças: apenas equipamentos podem quebrar.',
    };
  }

  if (action.operation === 'repair') {
    if (target.type === 'equipment') {
      const maxDurability = Math.max(1, target.durabilityMax || 3);
      target.durabilityMax = maxDurability;
      target.durabilityCurrent = maxDurability;
      target.broken = false;
      next.inventory = normalizeInventory(nextInventory);
      return {
        changed: true,
        next,
        eventSummary: buildSummary('repair', target.name, 1, action.reason),
      };
    }

    return {
      changed: false,
      next,
      eventSummary: 'Inventário sem mudanças: item não reparável.',
    };
  }

  if (action.operation === 'set_quantity') {
    if (target.type === 'consumable') {
      target.quantity = clamp(Math.floor(action.amount || 0), 0, 9999);
      next.inventory = normalizeInventory(nextInventory);
      return {
        changed: true,
        next,
        eventSummary: buildSummary('set_quantity', target.name, target.quantity, action.reason),
      };
    }

    return {
      changed: false,
      next,
      eventSummary: 'Inventário sem mudanças: quantidade fixa para equipamento.',
    };
  }

  return {
    changed: false,
    next,
    eventSummary: 'Inventário sem mudanças.',
  };
}

export function inventorySummary(inventory: InventoryItem[]): string {
  const normalized = normalizeInventory(inventory);
  if (normalized.length === 0) return 'Inventário vazio.';

  const rows = normalized.map((item) => {
    if (item.type === 'consumable') {
      return `- ${item.name} (consumível) x${item.quantity}`;
    }

    const durability = typeof item.durabilityCurrent === 'number' && typeof item.durabilityMax === 'number'
      ? `, durabilidade ${item.durabilityCurrent}/${item.durabilityMax}`
      : '';
    const broken = item.broken ? ', quebrado' : '';
    return `- ${item.name} (equipamento${durability}${broken})`;
  });

  return rows.join('\n');
}
