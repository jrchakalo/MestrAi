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
  genre: string;
  systemName: string;
  visualStyle: string;
  
  // Character Details
  characterName: string;
  characterAppearance: string;
  characterBackstory: string;
  characterProfession?: string;
  characterData?: Record<string, any>;
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
  };
}

export interface DiceRollRequest {
  attribute: string;
  difficulty_class: number;
  description: string;
}