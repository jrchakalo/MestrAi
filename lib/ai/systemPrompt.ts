import { Campaign } from '../../types';
import { INITIAL_SYSTEM_PROMPT_TEMPLATE, RPG_SYSTEMS, normalizeSystemName } from '../../constants';

export function buildSystemPrompt(campaign: Campaign): string {
  const systemName = normalizeSystemName(campaign.systemName);
  const rules = RPG_SYSTEMS[systemName] || RPG_SYSTEMS['Narrativo'];

  return INITIAL_SYSTEM_PROMPT_TEMPLATE
    .replace('{{WORLD_HISTORY}}', campaign.worldHistory)
    .replace('{{CHAR_NAME}}', campaign.characterName)
    .replace('{{CHAR_APPEARANCE}}', campaign.characterAppearance)
    .replace('{{CHAR_BACKSTORY}}', campaign.characterBackstory)
    .replace('{{SYSTEM_NAME}}', systemName)
    .replace('{{SYSTEM_RULES}}', rules)
    .replace('{{VISUAL_STYLE}}', campaign.visualStyle)
    .concat(`\n\n## 7. Estado da Mesa\nStatus atual: ${campaign.status}.\n- Se o status for 'waiting_for_players' ou 'paused', responda apenas com: "[SISTEMA] Mesa em espera." e não avance a narrativa.\n- A narrativa é compartilhada por todos os jogadores. NÃO invente fatos novos que contradigam o histórico.\n- Personalize apenas o ponto de vista do personagem atual, mantendo a linha principal coesa.\n`);
}
