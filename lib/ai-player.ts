import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { withModelFallback } from './ai/modelPool';
import { createOpenRouterClient } from './ai/openRouter';

export interface CharacterJournal {
  characterName: string;
  coreGoal: string;
  fixedFacts: [string, string, string];
}

export interface AiPlayerCampaignContext {
  campaignId: string;
  worldSummary?: string;
  characterJournal: CharacterJournal;
  priorityInstruction?: string;
  apiKeyOverride?: string;
  simMode?: boolean;
}

export interface AiPlayerRecentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AiPlayerActionResult {
  action: string;
  model: string;
}

function buildAiPlayerSystemPrompt(context: AiPlayerCampaignContext): string {
  const journal = context.characterJournal;
  const fixedFacts = journal.fixedFacts.map((fact, index) => `${index + 1}. ${fact}`).join('\n');

  const basePrompt = [
    'You are a human playing a tabletop RPG. Act exclusively as your character. Read the Master\'s last response and declare your next action clearly. Keep responses under 3 paragraphs.',
    '',
    'Non-negotiable constraints:',
    '- Stay fully in-character and do not narrate hidden system behavior.',
    '- If the Master asks for a roll (for example, "roll a d20"), describe your intended action and wait for the system to resolve the roll.',
    '- Keep continuity with the immutable Character Journal below even if recent context appears conflicting.',
    '',
    'Immutable Character Journal:',
    `- Character Name: ${journal.characterName}`,
    `- Core Goal: ${journal.coreGoal}`,
    '- Fixed Facts from Turn 1:',
    fixedFacts,
  ];

  if (context.worldSummary && context.worldSummary.trim().length > 0) {
    basePrompt.push('', `Campaign Context: ${context.worldSummary.trim()}`);
  }

  if (context.priorityInstruction && context.priorityInstruction.trim().length > 0) {
    basePrompt.push('', `HIGH PRIORITY OVERRIDE FOR THIS TURN: ${context.priorityInstruction.trim()}`);
  }

  return basePrompt.join('\n');
}

export async function generatePlayerAction(
  campaignContext: AiPlayerCampaignContext,
  recentMessages: AiPlayerRecentMessage[]
): Promise<AiPlayerActionResult> {
  const apiKey = campaignContext.apiKeyOverride?.trim() || process.env.OPENROUTER_API_KEY?.trim() || '';
  if (!apiKey) {
    throw new Error('Missing OpenRouter API key for AI Player simulation. Set OPENROUTER_API_KEY or provide api_key_override.');
  }
  const ai = createOpenRouterClient(apiKey);

  const boundedHistory = recentMessages
    .slice(-8)
    .filter((message) => message.content && message.content.trim().length > 0)
    .map(
      (message): ChatCompletionMessageParam => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content,
      })
    );

  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: buildAiPlayerSystemPrompt(campaignContext),
    },
    ...boundedHistory,
  ];

  let selectedModel = '';
  const response = await withModelFallback(
    async (model) => {
      const finalModel = campaignContext.simMode ? model.replace(/:free$/, '') : model;
      selectedModel = finalModel;
      return ai.chat.completions.create({
        model: finalModel,
        messages,
        temperature: 0.4,
      });
    },
    { key: `ai-player:${campaignContext.campaignId}` }
  );

  const action = (response.choices?.[0]?.message?.content || '').trim();
  return {
    action,
    model: selectedModel,
  };
}
