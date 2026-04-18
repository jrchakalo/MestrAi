import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generatePlayerAction, type AiPlayerCampaignContext, type AiPlayerRecentMessage } from '../../../../lib/ai-player';
import type { Campaign, Message } from '../../../../types';
import { Role } from '../../../../types';
import { createAdminClient } from '../../../../lib/supabase/server';
import { createOpenRouterClient } from '../../../../lib/ai/openRouter';

interface MemoryProbe {
  turn: number;
  instruction: string;
}

interface SimulationResult {
  campaignId: string;
  ownerId: string;
  generatedCampaignId?: string;
  generated_campaign_id?: string;
  startTurn: number;
  endTurn: number;
  targetTurns: number;
  executedTurns: number;
  probesTriggered: number;
  abortedReason?: string;
}

interface CampaignSetupPayload {
  campaign: {
    title: string;
    description: string;
    genre: string;
    tone: string;
    magic_level: string;
    tech_level: string;
    world_history: string;
  };
  character: {
    name: string;
    backstory: string;
    appearance: string;
    profession: string;
  };
}

interface CampaignSeedResult {
  campaignId: string;
  generated: boolean;
}

const memoryProbes: MemoryProbe[] = [
  { turn: 25, instruction: "Pause your current action. Explicitly ask the Master to explain how the 'Critical Failure' (rolling a natural 1) mechanic works in this specific system." },
  { turn: 50, instruction: "Pause your current action. Explicitly ask the Master what was the exact name of the first NPC you met in this campaign." },
  { turn: 75, instruction: "Pause your current narrative action. Ask the Master to remind you what is your character's main background goal or profession, which was established at the very beginning." },
  { turn: 100, instruction: 'Pause your current action. Ask the Master what was the name of the starting location, town, or room where this adventure began.' },
  { turn: 120, instruction: 'Pause your current action. Ask the Master to explicitly list all the items currently in your inventory.' },
  { turn: 140, instruction: 'Pause your current action. Pick the oldest item in your inventory and ask the Master exactly how, where, or from whom you acquired it.' },
  { turn: 160, instruction: 'Pause your current action. Ask the Master about the status of the very first enemy or obstacle you overcame in this campaign. Are they dead, destroyed, or still around?' },
  { turn: 175, instruction: 'Pause your current action. Ask the Master to explicitly state your current health tier (e.g., HEALTHY, INJURED) and exactly how many light damage points you have accumulated so far.' },
  { turn: 190, instruction: 'Pause your current action. Ask the Master to recall a specific piece of lore established in the world bible, such as the name of a major faction, law, or deity of this world.' },
  { turn: 195, instruction: 'Pause your current action. Ask the Master to summarize exactly what was the very first action you took in Turn 1 of this campaign.' }
];

const requestSchema = z.object({
  campaign_id: z.string().uuid().optional(),
  owner_id: z.string().uuid().optional(),
  target_turns: z.number().int().min(1).max(1000).default(200),
  min_delay_ms: z.number().int().min(2000).max(120000).optional(),
  max_runtime_seconds: z.number().int().min(30).max(7200).default(600),
  api_key_override: z.string().min(1).optional(),
});

const RATE_LIMIT_WAIT_MS = 60000;
const MAX_RATE_LIMIT_RETRIES = 5;
const MASTER_CHAT_TIMEOUT_MS = 60000;
const AI_PLAYER_TIMEOUT_MS = 30000;
const CAMPAIGN_SETUP_CALL_TIMEOUT_MS = 25000;

const campaignSetupSchema = z.object({
  campaign: z.object({
    title: z.string().min(3),
    description: z.string().min(10),
    genre: z.string().min(2),
    tone: z.string().min(2),
    magic_level: z.string().min(2),
    tech_level: z.string().min(2),
    world_history: z.string().min(120).refine(
      (value) => value.split(/\n\s*\n/).filter((part) => part.trim().length > 0).length >= 2,
      { message: 'world_history must contain at least two paragraphs.' }
    ),
  }),
  character: z.object({
    name: z.string().min(2),
    backstory: z.string().min(20),
    appearance: z.string().min(10),
    profession: z.string().min(2),
  }),
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function toMessageRole(role: string): Role {
  if (role === 'assistant') return Role.MODEL;
  if (role === 'system' || role === 'tool') return Role.SYSTEM;
  return Role.USER;
}

function inferCoreGoal(characterDataJson: any): string {
  const backstory = String(characterDataJson?.backstory || '').trim();
  if (!backstory) return 'Survive and achieve your character objective.';
  const firstSentence = backstory.split(/[.!?]/).map((part) => part.trim()).find(Boolean);
  return firstSentence || 'Survive and achieve your character objective.';
}

function buildFixedFacts(characterDataJson: any): [string, string, string] {
  const profession = String(
    characterDataJson?.inferred?.profession ||
    characterDataJson?.profession ||
    'No profession was explicitly set yet.'
  );
  const appearance = String(characterDataJson?.appearance || 'Appearance details were established in turn 1.');
  const origin = String(characterDataJson?.backstory || 'Character backstory was established in turn 1.');

  return [
    `My profession/background is: ${profession}`,
    `My appearance baseline is: ${appearance}`,
    `My origin baseline is: ${origin}`,
  ];
}

function resolveOpenRouterApiKey(apiKeyOverride?: string): string {
  const key = apiKeyOverride?.trim() || process.env.OPENROUTER_API_KEY?.trim() || '';
  if (!key) {
    throw new Error('Missing OpenRouter API key. Set OPENROUTER_API_KEY or provide api_key_override.');
  }
  return key;
}

function isRateLimitError(error: any): boolean {
  const status = error?.status || error?.response?.status || error?.code;
  return status === 429;
}

function parseJsonFromText<T>(text: string): T | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // fall through
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]) as T;
    } catch {
      // fall through
    }
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as T;
    } catch {
      return null;
    }
  }
  return null;
}

function ensureTwoParagraphs(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  const existing = normalized.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  if (existing.length >= 2) {
    return existing.join('\n\n');
  }

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (sentences.length >= 4) {
    const midpoint = Math.ceil(sentences.length / 2);
    const p1 = sentences.slice(0, midpoint).join(' ');
    const p2 = sentences.slice(midpoint).join(' ');
    return `${p1}\n\n${p2}`.trim();
  }

  const duplicated = `${normalized} ${normalized}`.trim();
  const splitAt = Math.max(60, Math.floor(duplicated.length / 2));
  return `${duplicated.slice(0, splitAt).trim()}\n\n${duplicated.slice(splitAt).trim()}`.trim();
}

function normalizeCampaignSetup(input: any): CampaignSetupPayload {
  const campaign = input?.campaign || {};
  const character = input?.character || {};

  const normalized: CampaignSetupPayload = {
    campaign: {
      title: String(campaign.title || 'Campanha da Fronteira Sombria').trim(),
      description: String(campaign.description || 'Uma jornada perigosa por terras antigas onde escolhas custam caro.').trim(),
      genre: String(campaign.genre || 'Fantasia Sombria').trim(),
      tone: String(campaign.tone || 'Tenso e dramático').trim(),
      magic_level: String(campaign.magic_level || 'Médio').trim(),
      tech_level: String(campaign.tech_level || 'Baixo').trim(),
      world_history: ensureTwoParagraphs(
        String(
          campaign.world_history ||
            'Após a queda de um império arcano, pequenos reinos disputam rotas antigas e relíquias proibidas. Juramentos quebrados moldaram uma era de desconfiança entre cidades muradas e ordens militares privadas.\n\nNas fronteiras, rumores sobre cultos e ruínas vivas atraem aventureiros e oportunistas. Cada vitória cobra um preço político e espiritual, e a memória do mundo é fragmentada por guerras e versões conflitantes da verdade.'
        ).trim()
      ),
    },
    character: {
      name: String(character.name || 'Iria Voss').trim(),
      backstory: String(
        character.backstory ||
          'Filha de cartógrafos de guerra, sobreviveu a um cerco e jurou mapear passagens esquecidas para impedir novos massacres. Carrega culpas antigas e busca redenção ao proteger quem não pode se defender.'
      ).trim(),
      appearance: String(
        character.appearance ||
          'Cabelos escuros curtos, cicatriz fina na sobrancelha esquerda, capa de viagem surrada e olhar atento de quem mede rotas e riscos.'
      ).trim(),
      profession: String(character.profession || 'Batedora').trim(),
    },
  };

  return normalized;
}

function resolvePaidModel(model: string) {
  return model.replace(/:free$/, '');
}

async function generateRandomCampaignSetup(apiKey: string, deadlineAt: number): Promise<CampaignSetupPayload> {
  const ai = createOpenRouterClient(apiKey);
  let rateLimitRetries = 0;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (Date.now() >= deadlineAt) {
      return normalizeCampaignSetup({});
    }

    try {
      const response = await Promise.race([
        ai.chat.completions.create({
          model: resolvePaidModel('qwen/qwen3-next-80b-a3b-instruct:free'),
          temperature: attempt === 1 ? 0.8 : 0.6,
          messages: [
            {
              role: 'system',
              content:
                'Return strictly valid JSON only. No markdown, no backticks, no explanations, no comments.',
            },
            {
              role: 'user',
              content:
                'Crie UM setup de campanha de RPG em português do Brasil e retorne EXATAMENTE este JSON: {"campaign":{"title":"...","description":"...","genre":"...","tone":"...","magic_level":"...","tech_level":"...","world_history":"..."},"character":{"name":"...","backstory":"...","appearance":"...","profession":"..."}}. world_history deve ter no mínimo dois parágrafos separados por linha em branco.',
            },
          ],
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Campaign setup generation timeout.')), CAMPAIGN_SETUP_CALL_TIMEOUT_MS);
        }),
      ]);

      const text = response.choices?.[0]?.message?.content || '';
      const parsed = parseJsonFromText<CampaignSetupPayload>(text);
      const normalized = normalizeCampaignSetup(parsed || {});
      const validated = campaignSetupSchema.safeParse(normalized);
      if (validated.success) {
        return validated.data;
      }
    } catch (error: any) {
      if (isRateLimitError(error)) {
        rateLimitRetries += 1;
        if (rateLimitRetries >= MAX_RATE_LIMIT_RETRIES) {
          break;
        }
        const remaining = deadlineAt - Date.now();
        if (remaining <= 0) {
          return normalizeCampaignSetup({});
        }
        await delay(Math.min(RATE_LIMIT_WAIT_MS, remaining));
        continue;
      }
      throw error;
    }
  }

  return normalizeCampaignSetup({});
}

async function resolveSimulationOwnerId(admin: NonNullable<ReturnType<typeof createAdminClient>>): Promise<string> {
  const fromProfiles = await admin
    .from('profiles')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const profileId = fromProfiles.data?.id;
  if (typeof profileId === 'string' && profileId.length > 0) {
    return profileId;
  }

  const fromPlayers = await admin
    .from('campaign_players')
    .select('player_id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const playerId = fromPlayers.data?.player_id;
  if (typeof playerId === 'string' && playerId.length > 0) {
    return playerId;
  }

  throw new Error('No valid user found to seed simulation campaign owner_id/player_id.');
}

async function ensureCampaignForSimulation(params: {
  admin: NonNullable<ReturnType<typeof createAdminClient>>;
  campaignId?: string;
  ownerId?: string;
  apiKey: string;
  deadlineAt: number;
}): Promise<CampaignSeedResult> {
  const { admin, campaignId, ownerId, apiKey, deadlineAt } = params;
  if (campaignId) {
    const campaignOwner = await admin
      .from('campaigns')
      .select('owner_id')
      .eq('id', campaignId)
      .maybeSingle();

    return {
      campaignId,
      ownerId: String(campaignOwner.data?.owner_id || ownerId || ''),
      generated: false,
    };
  }

  const setup = await generateRandomCampaignSetup(apiKey, deadlineAt);
  const ownerIdResolved = ownerId || await resolveSimulationOwnerId(admin);

  const campaignInsert = await admin
    .from('campaigns')
    .insert({
      owner_id: ownerIdResolved,
      title: setup.campaign.title,
      description: setup.campaign.description,
      genero: setup.campaign.genre,
      tom: setup.campaign.tone,
      magia: setup.campaign.magic_level,
      tech: setup.campaign.tech_level,
      visual_style: 'Narrative simulation, text-first, cinematic realism',
      world_bible_json: {
        worldHistory: setup.campaign.world_history,
      },
      status: 'active',
      max_players: 1,
    })
    .select('id')
    .single();

  if (campaignInsert.error || !campaignInsert.data?.id) {
    throw campaignInsert.error || new Error('Failed to create simulation campaign.');
  }

  const createdCampaignId = campaignInsert.data.id as string;

  const characterDataJson = {
    appearance: setup.character.appearance,
    backstory: setup.character.backstory,
    profession: setup.character.profession,
    inferred: {
      name: setup.character.name,
      profession: setup.character.profession,
      backstory: setup.character.backstory,
      appearance: setup.character.appearance,
      health: {
        tier: 'HEALTHY',
        lightDamageCounter: 0,
      },
      inventory: [],
    },
  };

  const playerInsert = await admin.from('campaign_players').insert({
    campaign_id: createdCampaignId,
    player_id: ownerIdResolved,
    character_name: setup.character.name,
    character_data_json: characterDataJson,
    status: 'accepted',
    is_dead: false,
  });
  if (playerInsert.error) {
    throw playerInsert.error;
  }

  const messageInsert = await admin.from('messages').insert({
    campaign_id: createdCampaignId,
    role: 'system',
    content: 'A campanha começou. O personagem acaba de chegar ao cenário.',
    metadata: {
      type: 'system',
      source: 'sim-loop-seed',
    },
  });
  if (messageInsert.error) {
    throw messageInsert.error;
  }

  return {
    campaignId: createdCampaignId,
    ownerId: ownerIdResolved,
    generated: true,
  };
}

async function getSimulationState(admin: NonNullable<ReturnType<typeof createAdminClient>>, campaignId: string) {
  const [campaignRes, playerRes, messagesRes] = await Promise.all([
    admin
      .from('campaigns')
      .select('id,owner_id,title,description,genero,tom,magia,tech,visual_style,world_bible_json,status,max_players,created_at')
      .eq('id', campaignId)
      .maybeSingle(),
    admin
      .from('campaign_players')
      .select('player_id,character_name,character_data_json,status,is_dead')
      .eq('campaign_id', campaignId)
      .eq('status', 'accepted')
      .eq('is_dead', false)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    admin
      .from('messages')
      .select('id,role,content,metadata,created_at')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true }),
  ]);

  if (campaignRes.error) throw campaignRes.error;
  if (playerRes.error) throw playerRes.error;
  if (messagesRes.error) throw messagesRes.error;

  return {
    campaignRow: campaignRes.data,
    playerRow: playerRes.data,
    messageRows: messagesRes.data || [],
  };
}

function buildCampaignPayload(campaignRow: any, playerRow: any): Campaign {
  const characterData = playerRow?.character_data_json?.inferred;

  return {
    id: campaignRow.id,
    ownerId: campaignRow.owner_id,
    title: campaignRow.title || 'Simulation Campaign',
    description: campaignRow.description || '',
    worldHistory: campaignRow.world_bible_json?.worldHistory || '',
    genero: campaignRow.genero || '',
    tom: campaignRow.tom || '',
    magia: campaignRow.magia || '',
    tech: campaignRow.tech || '',
    visualStyle: campaignRow.visual_style || '',
    characterName: playerRow?.character_name || 'Simulated Player',
    characterAppearance: playerRow?.character_data_json?.appearance || '',
    characterBackstory: playerRow?.character_data_json?.backstory || '',
    characterProfession: characterData?.profession || playerRow?.character_data_json?.profession || '',
    characterData: characterData,
    status: campaignRow.status || 'active',
    maxPlayers: campaignRow.max_players || 5,
    createdAt: campaignRow.created_at ? new Date(campaignRow.created_at).getTime() : Date.now(),
  } as Campaign;
}

function toPayloadMessages(messageRows: any[]): Message[] {
  return messageRows.map((row) => ({
    id: row.id,
    role: toMessageRole(row.role),
    content: row.content || '',
    timestamp: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    metadata: row.metadata || {},
  }));
}

function toAiPlayerRecentMessages(messageRows: any[]): AiPlayerRecentMessage[] {
  return messageRows
    .filter((row) => row.role === 'user' || row.role === 'assistant' || row.role === 'system')
    .slice(-16)
    .map((row) => ({
      role: row.role === 'assistant' ? 'assistant' : row.role === 'system' ? 'system' : 'user',
      content: String(row.content || ''),
    }));
}

function getToolResponse(call: { id?: string; name?: string; args?: Record<string, any> }) {
  const args = call.args || {};
  switch (call.name) {
    case 'request_roll': {
      const total = Math.floor(Math.random() * 20) + 1;
      return {
        name: 'request_roll',
        result: {
          total,
          dice: total,
          attribute: args.attribute || 'MENTE',
          difficulty: args.difficulty || 'NORMAL',
          is_profession_relevant: !!args.is_profession_relevant,
        },
        callId: call.id,
        args,
      };
    }
    case 'apply_damage':
    case 'apply_rest':
    case 'trigger_levelup':
    case 'generate_image':
    case 'trigger_game_over':
    case 'update_character':
    case 'manage_inventory':
      return {
        name: call.name,
        result: { ok: true, args },
        callId: call.id,
        args,
      };
    default:
      return {
        name: call.name || 'unknown_tool',
        result: { ok: true, args },
        callId: call.id,
        args,
      };
  }
}

function buildFallbackPlayerAction(turnNumber: number): string {
  return `Turn ${turnNumber}: I take a cautious step forward, scan the scene for threats and opportunities, and ask what immediate risk or clue I notice.`;
}

async function postToMasterChatWithRetry(params: {
  requestUrl: string;
  payload: {
    campaign: Campaign;
    messages: Message[];
    input?: string;
    toolResponse?: { name: string; result: unknown; callId?: string; args?: Record<string, any> };
    sim_mode: boolean;
  };
  simSecret: string;
  apiKey: string;
  deadlineAt: number;
}) {
  let rateLimitRetries = 0;
  for (;;) {
    if (Date.now() >= params.deadlineAt) {
      throw new Error('Simulation runtime exceeded while waiting for /api/chat response.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MASTER_CHAT_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(params.requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sim-secret': params.simSecret,
          'x-custom-api-key': params.apiKey,
        },
        body: JSON.stringify(params.payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 429) {
      rateLimitRetries += 1;
      if (rateLimitRetries >= MAX_RATE_LIMIT_RETRIES) {
        throw new Error('Master chat hit repeated 429 rate limits; aborting simulation request.');
      }
      const remaining = params.deadlineAt - Date.now();
      if (remaining <= 0) {
        throw new Error('Simulation runtime exceeded while waiting for rate limit cooldown.');
      }
      await delay(Math.min(RATE_LIMIT_WAIT_MS, remaining));
      continue;
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(`Master chat failed (${response.status}): ${JSON.stringify(body)}`);
    }

    return response.json();
  }
}

export async function POST(req: Request) {
  try {
    const expectedSecret = process.env.SIM_LOOP_SECRET || '';
    const providedSecret = req.headers.get('x-sim-secret') || '';

    if (!expectedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.flatten() }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Supabase admin client unavailable' }, { status: 503 });
    }

    const apiKey = resolveOpenRouterApiKey(parsed.data.api_key_override);
    const startedAt = Date.now();
    const deadlineAt = startedAt + parsed.data.max_runtime_seconds * 1000;

    const ensuredCampaign = await ensureCampaignForSimulation({
      admin,
      campaignId: parsed.data.campaign_id,
      ownerId: parsed.data.owner_id,
      apiKey,
      deadlineAt,
    });
    const campaignId = ensuredCampaign.campaignId;
    const { target_turns: targetTurns } = parsed.data;
    const minDelayMs = Math.max(2000, parsed.data.min_delay_ms || 2000);

    const initialState = await getSimulationState(admin, campaignId);
    if (!initialState.campaignRow) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    if (!initialState.playerRow) {
      return NextResponse.json({ error: 'No active player available for simulation' }, { status: 400 });
    }

    const startedTurn = initialState.messageRows.filter((row) => row.role === 'user').length;
    let probesTriggered = 0;
    let executedTurns = 0;
    let timedOut = false;
    let abortedReason: string | undefined;

    for (;;) {
      if (Date.now() >= deadlineAt) {
        timedOut = true;
        if (!abortedReason) {
          abortedReason = 'Simulation runtime limit reached before completing remaining turns.';
        }
        break;
      }

      const state = await getSimulationState(admin, campaignId);
      if (!state.campaignRow || !state.playerRow) break;

      const currentTurn = state.messageRows.filter((row) => row.role === 'user').length;
      if (currentTurn >= targetTurns) {
        break;
      }

      const nextTurn = currentTurn + 1;
      const probe = memoryProbes.find((item) => item.turn === nextTurn);
      if (probe) probesTriggered += 1;

      const campaignPayload = buildCampaignPayload(state.campaignRow, state.playerRow);
      const payloadMessages = toPayloadMessages(state.messageRows);
      const aiRecentMessages = toAiPlayerRecentMessages(state.messageRows);

      const playerContext: AiPlayerCampaignContext = {
        campaignId,
        worldSummary: campaignPayload.worldHistory,
        apiKeyOverride: apiKey,
        simMode: true,
        priorityInstruction: probe?.instruction,
        characterJournal: {
          characterName: state.playerRow.character_name || campaignPayload.characterName,
          coreGoal: inferCoreGoal(state.playerRow.character_data_json),
          fixedFacts: buildFixedFacts(state.playerRow.character_data_json),
        },
      };

      try {
        let playerAction;
        try {
          playerAction = await Promise.race([
            generatePlayerAction(playerContext, aiRecentMessages),
            new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('AI player action timeout.')), AI_PLAYER_TIMEOUT_MS);
            }),
          ]);
        } catch {
          playerAction = {
            action: buildFallbackPlayerAction(nextTurn),
            model: 'fallback/local-policy',
          };
        }

        const finalPlayerAction = playerAction.action || 'I keep observing carefully and ask what changed in the environment.';

        const userInsert = await admin.from('messages').insert({
          campaign_id: campaignId,
          role: 'user',
          content: finalPlayerAction,
          metadata: {
            type: 'text',
            source: 'sim-loop',
            turn_number: nextTurn,
            probe_instruction: probe?.instruction || null,
            ai_player_model: playerAction.model,
          },
        });
        if (userInsert.error) {
          throw userInsert.error;
        }

        let masterReply = await postToMasterChatWithRetry({
          requestUrl: new URL('/api/chat', req.url).toString(),
          simSecret: providedSecret,
          apiKey,
          deadlineAt,
          payload: {
            sim_mode: true,
            campaign: campaignPayload,
            messages: [...payloadMessages, {
              id: crypto.randomUUID(),
              role: Role.USER,
              content: finalPlayerAction,
              timestamp: Date.now(),
            }],
          },
        });

        const masterText = String(masterReply?.text || '').trim();
        if (masterText) {
          const assistantInsert = await admin.from('messages').insert({
            campaign_id: campaignId,
            role: 'assistant',
            content: masterText,
            metadata: {
              type: 'text',
              source: 'sim-loop',
              turn_number: nextTurn,
            },
          });
          if (assistantInsert.error) {
            throw assistantInsert.error;
          }
        }
      } catch (turnError: any) {
        abortedReason = turnError?.message || 'Simulation aborted during turn processing.';
        break;
      }

      executedTurns += 1;
      const remaining = deadlineAt - Date.now();
      if (remaining <= 0) {
        timedOut = true;
        if (!abortedReason) {
          abortedReason = 'Simulation runtime limit reached after executing the current turn.';
        }
        break;
      }
      await delay(Math.min(minDelayMs, remaining));
    }

    const finalState = await getSimulationState(admin, campaignId);
    const finalTurn = finalState.messageRows.filter((row) => row.role === 'user').length;

    const result: SimulationResult = {
      campaignId,
      ownerId: ensuredCampaign.ownerId,
      generatedCampaignId: ensuredCampaign.generated ? campaignId : undefined,
      generated_campaign_id: ensuredCampaign.generated ? campaignId : undefined,
      startTurn: startedTurn,
      endTurn: finalTurn,
      targetTurns: targetTurns,
      executedTurns,
      probesTriggered,
      abortedReason,
    };

    return NextResponse.json({
      ok: true,
      timed_out: timedOut,
      aborted_reason: abortedReason || null,
      owner_id_used: ensuredCampaign.ownerId,
      max_runtime_seconds: parsed.data.max_runtime_seconds,
      generated_campaign_id: ensuredCampaign.generated ? campaignId : null,
      result,
    });
  } catch (error: any) {
    console.error('sim-loop error:', error);
    return NextResponse.json(
      { error: 'Simulation failed', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
