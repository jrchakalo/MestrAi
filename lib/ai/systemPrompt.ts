import { Campaign } from '../../types';
import { INITIAL_SYSTEM_PROMPT_TEMPLATE } from '../../constants';

export function buildSystemPrompt(campaign: Campaign): string {
  return INITIAL_SYSTEM_PROMPT_TEMPLATE
    .replace('{{WORLD_HISTORY}}', campaign.worldHistory)
    .replace('{{GENERO}}', campaign.genero)
    .replace('{{TOM}}', campaign.tom)
    .replace('{{MAGIA}}', campaign.magia)
    .replace('{{TECH}}', campaign.tech)
    .replace('{{CHAR_NAME}}', campaign.characterName)
    .replace('{{CHAR_APPEARANCE}}', campaign.characterAppearance)
    .replace('{{CHAR_PROFESSION}}', campaign.characterProfession || 'Sem profissao definida')
    .replace('{{CHAR_BACKSTORY}}', campaign.characterBackstory)
    .replace('{{VISUAL_STYLE}}', campaign.visualStyle)
    .concat(`\n\n## 7. Estado da Mesa\nStatus atual: ${campaign.status}.\n- Se o status for 'waiting_for_players' ou 'paused', responda apenas com: "[SISTEMA] Mesa em espera." e não avance a narrativa.\n- A narrativa é compartilhada por todos os jogadores. NÃO invente fatos novos que contradigam o histórico.\n- Personalize apenas o ponto de vista do personagem atual, mantendo a linha principal coesa.\n`);
}
