import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'groq-sdk/resources/chat/completions';
import { z } from 'zod';
import { pickApiKey } from '../../../lib/ai/keyPool';
import { buildSystemPrompt } from '../../../lib/ai/systemPrompt';
import { isRateLimited } from '../../../lib/ai/rateLimit';
import { withModelFallback } from '../../../lib/ai/modelPool';
import { Campaign, Message, Role } from '../../../types';
import { createAdminClient, createServerClient } from '../../../lib/supabase/server';

// shared rate limiter in lib/ai/rateLimit
const STREAMING_ENABLED = false;

const requestRollSchema = {
  type: 'object',
  properties: {
    attribute: { type: 'string' },
    is_profession_relevant: { type: 'boolean' },
    difficulty: { type: 'string', enum: ['NORMAL', 'HARD', 'VERY_HARD'] },
  },
  required: ['attribute', 'is_profession_relevant', 'difficulty'],
};

const applyDamageSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['LIGHT', 'HEAVY'] },
  },
  required: ['type'],
};

const generateImageSchema = {
  type: 'object',
  properties: {
    prompt: { type: 'string' },
  },
  required: ['prompt'],
};

const triggerGameOverSchema = {
  type: 'object',
  properties: {
    causeOfDeath: { type: 'string' },
    worldFuture: { type: 'string' },
  },
  required: ['causeOfDeath', 'worldFuture'],
};

const updateCharacterSchema = {
  type: 'object',
  properties: {
    profession: { type: 'string' },
    inventory: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string', enum: ['consumable', 'equipment'] },
          quantity: { type: 'number' },
        },
      },
    },
  },
  required: [],
};

function safeParseArgs(args: unknown): Record<string, any> {
  if (!args) return {};
  if (typeof args === 'object') return args as Record<string, any>;
  if (typeof args === 'string') {
    try {
      return JSON.parse(args) as Record<string, any>;
    } catch {
      return {};
    }
  }
  return {};
}

function normalizeToolCalls(rawCalls: any[] | undefined) {
  const calls = Array.isArray(rawCalls) ? rawCalls : [];
  return calls.map((call) => ({
    id: call?.id,
    name: call?.function?.name || call?.name,
    args: safeParseArgs(call?.function?.arguments ?? call?.args),
  }));
}

function extractRetryAfterSeconds(error: any): number | null {
  if (!error) return null;
  const headerVal =
    error?.response?.headers?.['retry-after'] ||
    error?.response?.headers?.get?.('retry-after') ||
    error?.headers?.['retry-after'];
  if (typeof headerVal === 'string') {
    const parsed = Number(headerVal);
    if (Number.isFinite(parsed)) return parsed;
  }
  const details = error?.details || error?.error?.details;
  if (Array.isArray(details)) {
    const retry = details.find((d) => String(d?.['@type'] || '').includes('RetryInfo'));
    const delay = retry?.retryDelay || retry?.['retryDelay'];
    if (typeof delay === 'string') {
      const match = delay.match(/(\d+)s/);
      if (match) return Number(match[1]);
    }
  }
  const msg = typeof error?.message === 'string' ? error.message : '';
  const msgMatch = msg.match(/"retryDelay"\s*:\s*"(\d+)s"/);
  if (msgMatch) return Number(msgMatch[1]);
  return null;
}

const bodySchema = z.object({
  campaign: z.custom<Campaign>(),
  messages: z.array(z.custom<Message>()),
  input: z.string().optional(),
  toolResponse: z
    .object({
      name: z.string(),
      result: z.any(),
      callId: z.string().optional(),
      args: z.record(z.any()).optional(),
    })
    .optional(),
});

function mapRole(role: Role): 'user' | 'assistant' | 'system' {
  if (role === Role.USER) return 'user';
  if (role === Role.MODEL) return 'assistant';
  return 'system';
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { campaign, messages, input, toolResponse } = parsed.data;
    const userKey = req.headers.get('x-custom-api-key') || undefined;
    let apiKey: string;
    try {
      apiKey = pickApiKey(userKey);
    } catch {
      return NextResponse.json({ error: 'Missing API key' }, { status: 401 });
    }
    const ai = new Groq({ apiKey });

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return NextResponse.json({ error: 'Missing auth token' }, { status: 401 });
    }

    const sb = createServerClient(token);
    const { data: userData } = await sb.auth.getUser(token);
    if (!userData.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateKey = `chat:${userData.user.id}:${campaign.id}`;
    if (await isRateLimited(rateKey)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { data: campaignRow } = await sb
      .from('campaigns')
      .select('status, owner_id')
      .eq('id', campaign.id)
      .maybeSingle();

    const { data: membership } = await sb
      .from('campaign_players')
      .select('status,is_dead,character_data_json')
      .eq('campaign_id', campaign.id)
      .eq('player_id', userData.user.id)
      .maybeSingle();

    if (!membership && campaignRow?.owner_id !== userData.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (membership?.is_dead) {
      return NextResponse.json({ error: 'Character is dead' }, { status: 403 });
    }

    if (!campaignRow) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const effectiveStatus = campaignRow.status || campaign.status;
    if (effectiveStatus === 'waiting_for_players' || effectiveStatus === 'paused') {
      return NextResponse.json({ text: '[SISTEMA] Mesa em espera.', toolCalls: [] });
    }

    const admin = createAdminClient();
    let roster: Array<{ id: string; name: string }> = [];
    if (admin) {
      const { data: rosterRows } = await admin
        .from('campaign_players')
        .select('player_id, character_name')
        .eq('campaign_id', campaign.id)
        .eq('status', 'accepted');
      roster = (rosterRows || []).map((row: any) => ({
        id: row.player_id,
        name: row.character_name || 'Jogador',
      }));
    }

    const system = buildSystemPrompt(campaign)
      .concat(
        roster.length > 1
          ? `\n\n## 8. Multiplayer POV\nJogadores ativos: ${roster.map((p) => p.name).join(', ')}.\n- Narre a mesma cena para todos, mas escreva um bloco de POV para cada jogador no formato:\n  "POV - <Nome>: ..."\n- As acoes de um jogador impactam o estado e as consequencias para os demais.\n- Mantenha coesao entre os POVs, evitando contradicoes.\n`
          : ''
      );

    const toChatMessage = (role: 'user' | 'assistant', content: string): ChatCompletionMessageParam => ({
      role,
      content,
    });

    const history: ChatCompletionMessageParam[] = messages
      .filter((m) => m.role !== Role.SYSTEM)
      .map((m) => toChatMessage(m.role === Role.USER ? 'user' : 'assistant', m.content || ''));

    const tools: ChatCompletionTool[] = [
      {
        type: 'function' as const,
        function: {
          name: 'request_roll',
          description: 'Request a dice roll from the player.',
          parameters: requestRollSchema as any,
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'apply_damage',
          description: 'Apply light or heavy damage to the character.',
          parameters: applyDamageSchema as any,
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'generate_image',
          description: 'Generate an image prompt for the story.',
          parameters: generateImageSchema as any,
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'trigger_game_over',
          description: 'Trigger a game over when the player dies.',
          parameters: triggerGameOverSchema as any,
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'update_character',
          description: 'Update character fields like profession, hp, or inventory when the story changes.',
          parameters: updateCharacterSchema as any,
        },
      },
    ];

    const baseMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: system },
      ...history,
    ];

    const buildMessages = (): ChatCompletionMessageParam[] => {
      if (toolResponse) {
        const toolCallId = toolResponse.callId || `call_${toolResponse.name}`;
        const toolArgs = toolResponse.args || {};
        return [
          ...baseMessages,
          {
            role: 'assistant',
            content: '',
            tool_calls: [
              {
                id: toolCallId,
                type: 'function',
                function: {
                  name: toolResponse.name,
                  arguments: JSON.stringify(toolArgs),
                },
              },
            ],
          } as ChatCompletionMessageParam,
          {
            role: 'tool',
            tool_call_id: toolCallId,
            content: JSON.stringify(toolResponse.result ?? ''),
          } as ChatCompletionMessageParam,
        ];
      }

      if (input && input.trim().length > 0) {
        return [...baseMessages, { role: 'user', content: input }];
      }

      return baseMessages;
    };

    const wantsStream =
      req.headers.get('accept')?.includes('text/event-stream') ||
      req.headers.get('x-stream') === '1';

    if (wantsStream && STREAMING_ENABLED) {
      let streamResult: any;
      try {
        streamResult = await withModelFallback(
          (model) =>
            ai.chat.completions.create({
              model,
              messages: buildMessages(),
              tools,
              tool_choice: 'auto',
              temperature: 0.8,
              stream: true,
            }),
          { key: `chat:${campaign.id}` }
        );
      } catch (err: any) {
        const status = err?.status || err?.code || 500;
        if (status === 429) {
          const retryAfter = extractRetryAfterSeconds(err);
          return NextResponse.json(
            { error: 'Rate limit exceeded', retryAfter },
            {
              status: 429,
              headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined,
            }
          );
        }
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          let fullText = '';
          const toolCallMap = new Map<string, { id: string; name?: string; argsText: string }>();
          try {
            for await (const chunk of streamResult) {
              const delta = chunk?.choices?.[0]?.delta || {};
              const textChunk = delta?.content || '';
              const deltaToolCalls = Array.isArray(delta?.tool_calls) ? delta.tool_calls : [];

              for (const call of deltaToolCalls) {
                const callId = call?.id || `call_${call?.function?.name || call?.index || 'tool'}`;
                const existing = toolCallMap.get(callId) || { id: callId, name: call?.function?.name, argsText: '' };
                if (call?.function?.name) {
                  existing.name = call.function.name;
                }
                if (call?.function?.arguments) {
                  existing.argsText += call.function.arguments;
                }
                toolCallMap.set(callId, existing);
              }

              if (textChunk) {
                fullText += textChunk;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'token', value: textChunk })}\n\n`)
                );
              }
            }

            const toolCalls = Array.from(toolCallMap.values()).map((call) => ({
              id: call.id,
              name: call.name,
              args: safeParseArgs(call.argsText),
            }));

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'done', text: fullText || '', toolCalls })}\n\n`
              )
            );
          } catch (err) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'stream_error' })}\n\n`)
            );
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      });
    }

    const response = await withModelFallback(
      (model) =>
        ai.chat.completions.create({
          model,
          messages: buildMessages(),
          tools,
          tool_choice: 'auto',
          temperature: 0.8,
        }),
      { key: `chat:${campaign.id}` }
    );

    const message = response.choices?.[0]?.message;
    const text = message?.content || '';
    const toolCalls = normalizeToolCalls(message?.tool_calls);

    return NextResponse.json({
      text: text || '',
      toolCalls,
    });
  } catch (error: any) {
    const status = error?.status || error?.code || 500;
    console.error('Chat API error:', error);
    if (status === 429) {
      const retryAfter = extractRetryAfterSeconds(error);
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter },
        { status: 429, headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined }
      );
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
