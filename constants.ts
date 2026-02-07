export const RPG_SYSTEMS: Record<string, string> = {
  'Narrativo': `
    - Sistema Genérico Baseado em Narrativa (Foco em História).
    - Rolagens: d20 Simples. 10+ Sucesso, 15+ Sucesso Bom, 20 Sucesso Crítico.
    - Priorize a regra do legal (Rule of Cool).
  `,
  'D&D 5e': `
    - Sistema: Dungeons & Dragons 5th Edition.
    - Rolagens: d20 + Modificador vs Classe de Dificuldade (CD).
    - Atributos: Força, Destreza, Constituição, Inteligência, Sabedoria, Carisma.
    - REGRAS CRÍTICAS: Testes de Percepção (Sabedoria) para ouvir/notar, Investigação (Inteligência) para procurar, Furtividade (Destreza) para esconder.
  `,
  'Ordem Paranormal': `
    - Sistema: Ordem Paranormal RPG.
    - Atributos principais: Força, Agilidade, Intelecto, Presença, Vigor.
    - Ações e testes usam d20 + atributo.
    - Horror Investigativo. O Paranormal não vem para nossa realidade de forma fácil.
  `,
  'Call of Cthulhu': `
    - Sistema: Baseado em BRP (d100).
    - Atributos: Força, Constituição, Destreza, Inteligência, Poder, Aparência, Educação, Tamanho.
    - Testes usam percentuais; sucesso com resultado <= atributo.
    - Foco em Horror Cósmico, Investigação e Loucura.
    - Combate é mortal e deve ser evitado.
  `,
};

export const SUPPORTED_SYSTEMS = ['Narrativo', 'D&D 5e', 'Ordem Paranormal', 'Call of Cthulhu'] as const;
export type SupportedSystem = (typeof SUPPORTED_SYSTEMS)[number];

export function normalizeSystemName(systemName?: string): SupportedSystem {
  if (systemName && SUPPORTED_SYSTEMS.includes(systemName as SupportedSystem)) {
    return systemName as SupportedSystem;
  }
  return 'Narrativo';
}

export const SKILLS_BY_SYSTEM: Record<SupportedSystem, string[]> = {
  'Narrativo': [
    'Atletismo',
    'Furtividade',
    'Percepção',
    'Investigação',
    'Persuasão',
    'Intimidação',
    'Enganação',
    'Sobrevivência',
    'Medicina',
    'Conhecimento',
  ],
  'D&D 5e': [
    'Acrobatics (Acrobacia)',
    'Animal Handling (Adestrar Animais)',
    'Arcana (Arcano)',
    'Athletics (Atletismo)',
    'Deception (Enganação)',
    'History (História)',
    'Insight (Intuição)',
    'Intimidation (Intimidação)',
    'Investigation (Investigação)',
    'Medicine (Medicina)',
    'Nature (Natureza)',
    'Perception (Percepção)',
    'Performance (Atuação)',
    'Persuasion (Persuasão)',
    'Religion (Religião)',
    'Sleight of Hand (Prestidigitação)',
    'Stealth (Furtividade)',
    'Survival (Sobrevivência)',
  ],
  'Ordem Paranormal': [
    'Acrobacia',
    'Adestramento',
    'Artes',
    'Atletismo',
    'Atualidades',
    'Enganação',
    'Fortitude',
    'Furtividade',
    'Iniciativa',
    'Intimidação',
    'Investigação',
    'Intuição',
    'Luta',
    'Medicina',
    'Ocultismo',
    'Percepção',
    'Persuasão',
    'Pilotagem',
    'Pontaria',
    'Reflexos',
    'Tecnologia',
    'Vontade',
  ],
  'Call of Cthulhu': [
    'Accounting (Contabilidade)',
    'Anthropology (Antropologia)',
    'Archaeology (Arqueologia)',
    'Art/Craft (Arte/Ofício)',
    'Charm (Lábia)',
    'Climb (Escalar)',
    'Credit Rating (Crédito)',
    'Disguise (Disfarce)',
    'Dodge (Esquiva)',
    'Drive Auto (Dirigir)',
    'Fast Talk (Lábia Rápida)',
    'First Aid (Primeiros Socorros)',
    'History (História)',
    'Intimidate (Intimidação)',
    'Jump (Saltar)',
    'Law (Direito)',
    'Library Use (Biblioteca)',
    'Listen (Escutar)',
    'Locksmith (Arrombamento)',
    'Medicine (Medicina)',
    'Natural World (Mundo Natural)',
    'Occult (Ocultismo)',
    'Operate Heavy Machinery (Máquinas Pesadas)',
    'Persuade (Persuasão)',
    'Psychology (Psicologia)',
    'Science (Ciência)',
    'Spot Hidden (Notar)',
    'Stealth (Furtividade)',
    'Survival (Sobrevivência)',
    'Swim (Natação)',
    'Throw (Arremesso)',
    'Track (Rastrear)',
  ],
};

export const CLASSES_BY_SYSTEM: Record<SupportedSystem, string[]> = {
  'Narrativo': [
    'Aventureiro',
    'Explorador',
    'Sobrevivente',
    'Erudito',
    'Mercenário',
  ],
  'D&D 5e': [
    'Bárbaro',
    'Bardo',
    'Bruxo',
    'Clérigo',
    'Druida',
    'Feiticeiro',
    'Guerreiro',
    'Ladino',
    'Mago',
    'Monge',
    'Paladino',
    'Patrulheiro',
    'Artífice',
  ],
  'Ordem Paranormal': [
    'Combatente',
    'Ocultista',
    'Especialista',
    'Sobrevivente',
  ],
  'Call of Cthulhu': [
    'Investigador',
    'Antropólogo',
    'Arqueólogo',
    'Artista',
    'Detetive',
    'Jornalista',
    'Médico',
    'Professor',
    'Criminoso',
    'Diletante',
    'Engenheiro',
    'Explorador',
    'Historiador',
    'Linguista',
    'Militar',
    'Policial',
    'Psicólogo',
    'Repórter',
    'Pesquisador',
  ],
};

export const INITIAL_SYSTEM_PROMPT_TEMPLATE = `
# MESTRE.AI NARRATIVE ENGINE (v3.0)
## 1. Papel e Missão
Você é um Motor Narrativo, não um Motor de Regras.
Idioma: SEMPRE Português do Brasil.
Objetivo: conduzir uma aventura coesa, dramática e focada em escolhas.

## 2. Contexto da Campanha
**Mundo:** {{WORLD_HISTORY}}
**Gênero:** {{GENERO}}
**Tom & Letalidade:** {{TOM}}
**Nível de Magia:** {{MAGIA}}
**Nível de Tecnologia:** {{TECH}}
**Estilo Visual:** {{VISUAL_STYLE}}

**Personagem:** {{CHAR_NAME}}
**Aparência:** {{CHAR_APPEARANCE}}
**Profissão:** {{CHAR_PROFESSION}}
**Background:** {{CHAR_BACKSTORY}}

## 3. Atributos (Escolha sempre o mais lógico)
- **VIGOR:** força, resistência, esforço físico bruto, fôlego.
- **DESTREZA:** agilidade, reflexos, furtividade, precisão manual.
- **MENTE:** raciocínio, percepção, tecnologia, análise.
- **PRESENÇA:** carisma, vontade, magia, influência.

## 4. Profissão (Vantagem Narrativa)
Se a profissão do personagem tiver ligação direta com a ação, marque `is_profession_relevant: true`.
Se não houver ligação clara, use `false`.

## 5. Regras de Rolagem (Você não calcula resultados)
- **NUNCA** resolva ações incertas sem pedir rolagem.
- Ao detectar uma ação incerta, pare a narrativa e solicite a rolagem via JSON.
- Dificuldades aceitas: `NORMAL`, `HARD`, `VERY_HARD`.

Formato obrigatório:
<tool_code>
{
  "action": "request_roll",
  "params": {
    "attribute": "VIGOR",
    "is_profession_relevant": true,
    "difficulty": "NORMAL"
  }
}
</tool_code>

## 6. Dano (Somente via Tool)
<tool_code>
{ "action": "apply_damage", "type": "LIGHT" }
</tool_code>

## 7. Level Up (Extremamente Raro)
Somente após grandes arcos narrativos concluídos:
<tool_code>{ "action": "trigger_levelup" }</tool_code>

## 8. Diretrizes de Saída
- Texto narrativo livre fora do JSON.
- JSON estrito dentro de `<tool_code>`.
- Nunca misture cálculo ou explicação de regra no texto.
- Para ações impossíveis, responda com um aviso sarcástico e NÃO solicite rolagem.

## 9. Fluxo de Turno
1. Se for resposta a rolagem, narre a consequência imediatamente.
2. Atualize o mundo e ofereça escolhas.
3. No fim, inclua de 3 a 5 sugestões:
   ### Sugestões:
   - A) [Ação Sugerida 1]
   - B) [Ação Sugerida 2]
   - C) [Ação Sugerida 3]
`;