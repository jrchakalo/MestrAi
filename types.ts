export enum Role {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system',
}

export enum CampaignStatus {
  WAITING = 'waiting_for_players',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ARCHIVED = 'archived', // For dead campaigns
}

export interface UserProfile {
  id: string;
  username: string;
  apiKey?: string;
}

export interface Campaign {
  id: string;
  ownerId?: string;
  title: string;
  description?: string;
  
  // World Details
  worldHistory: string;
  genero: string;
  tom: string;
  magia: string;
  tech: string;
  visualStyle: string;
  
  // Character Details
  characterName: string;
  characterAppearance: string;
  characterBackstory: string;
  characterProfession?: string;
  characterData?: CharacterSheet;
  avatarUrl?: string;

  status: CampaignStatus;
  maxPlayers?: number;
  createdAt: number;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  type?: 'text' | 'image' | 'system' | 'death_event';
  metadata?: {
    imageUrl?: string;
    rollResult?: number;
    rollType?: string;
    type?: string;
    action?: string;
    turn_id?: string;
    order?: string[];
    order_names?: string[];
    current_index?: number;
    player_id?: string;
    player_name?: string;
    text?: string;
    roll?: number | null;
    reason?: string | null;
    dex_key?: string;
    sourceCallId?: string;
    prompt?: string;
  };
}

export interface DiceRollRequest {
  attribute: AttributeName;
  is_profession_relevant: boolean;
  difficulty: Difficulty;
}

export type Difficulty = "NORMAL" | "HARD" | "VERY_HARD";

export type AttributeName = "VIGOR" | "DESTREZA" | "MENTE" | "PRESENÇA";
export type HealthTier = "HEALTHY" | "INJURED" | "CRITICAL" | "DEAD";

export interface CharacterSheet {
  name: string;
  appearance: string;
  profession: string;
  backstory: string;
  attributes: {
    VIGOR: number;
    DESTREZA: number;
    MENTE: number;
    PRESENÇA: number;
  };
  health: {
    tier: HealthTier;
    lightDamageCounter: number;
  };
  inventory: InventoryItem[];
}

export interface InventoryItem {
  id: string;
  name: string;
  type: "consumable" | "equipment";
  quantity: number;
}